//===============
// Animenosub AES-CBC source extractor.
// Animenosub.to's primary path returns AES/CBC/PKCS5-encrypted JSON from
// `https://animenosub.upn.one/api/v1/video?id={hash}` with hardcoded key+iv.
// Decoded payload contains `"source":"<m3u8>"`.
//
// Reference: Phisher's Extractor.kt:62-92 — the key/iv are hardcoded constants.
//===============

const crypto = require("node:crypto");
const http = require("../providers/http");

const API_URL = "https://animenosub.upn.one/api/v1/video";
const AES_KEY = "kiemtienmua911ca";
const AES_IV = "0123456789abcdef";

const FIREFOX_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:134.0) Gecko/20100101 Firefox/134.0";

function decryptAesCbc(hexCipher, key, iv) {
    const decipher = crypto.createDecipheriv(
        "aes-128-cbc",
        Buffer.from(key, "utf8"),
        Buffer.from(iv, "utf8")
    );
    const enc = Buffer.from(hexCipher, "hex");
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

async function animenosubAes(url, { referer } = {}) {
    if (!url) return [];
    // hash is appended after the # of the embed URL
    const hash = String(url).split("#").pop();
    if (!hash || hash === url) return [];

    let cipher;
    try {
        const r = await http.get(`${API_URL}?id=${encodeURIComponent(hash)}`, {
            headers: { "User-Agent": FIREFOX_UA },
            timeout: 10000
        });
        cipher = (typeof r.data === "string" ? r.data : JSON.stringify(r.data)).trim();
    } catch (e) {
        return [];
    }

    let plain;
    try {
        plain = decryptAesCbc(cipher, AES_KEY, AES_IV);
    } catch (e) {
        return [];
    }

    const m = /"source"\s*:\s*"([^"]+)"/.exec(plain);
    if (!m) return [];
    const m3u8 = m[1].replace(/\\\//g, "/");

    return [{
        url: m3u8,
        server: "Animenosub",
        quality: "1080p",
        dub: null,
        headers: { Referer: referer || url }
    }];
}

module.exports = { animenosubAes, decryptAesCbc };
