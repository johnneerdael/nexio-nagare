//===============
// Kwik (kwik.cx / kwik.si) extractor — host used exclusively by AnimePahe.
//
// Algorithm (matches animestream's Dart Kwik):
//   1. GET embed URL with Referer: https://animepahe.pw/ (origin domain).
//   2. Find the packed-JS script tag (`eval(function(p,a,c,k,e,d){...})`),
//      unpack with our shared JsUnpacker.
//   3. Regex `const source = '<m3u8 url>'` to pull the master playlist URL.
//   4. Return with Referer: https://kwik.cx/ — Kwik's CDN requires the kwik
//      origin specifically, NOT the animepahe one used for the embed page.
//===============

const http = require("../providers/http");
const { unpackFromHtml } = require("./jsunpacker");

const ANIMEPAHE_REFERER = "https://animepahe.pw/";
const KWIK_REFERER = "https://kwik.cx/";

const M3U8_REGEX = /const\s+source\s*=\s*['"]([^'"]+\.m3u8[^'"]*)['"]/;

async function kwik(url, { referer } = {}) {
    if (!url) return [];

    let html;
    try {
        const r = await http.get(url, {
            timeout: 12000,
            headers: { "Referer": referer || ANIMEPAHE_REFERER }
        });
        html = String(r.data || "");
    } catch (e) {
        return [];
    }

    const unpacked = unpackFromHtml(html);
    if (!unpacked) return [];

    const m = M3U8_REGEX.exec(unpacked);
    if (!m) return [];

    return [{
        url: m[1],
        server: "Kwik",
        quality: "auto",
        dub: null,
        headers: { Referer: KWIK_REFERER }
    }];
}

module.exports = { kwik, ANIMEPAHE_REFERER, KWIK_REFERER };
