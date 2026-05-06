//===============
// Byse video host extractor.
//
// Animenosub's primary iframe target migrated from the old Phisher list to a
// "Byse Frontend" Vite SPA hosted at rotating domains (bysesayeveum.com is one
// example — there are typically 2-3 mirrors active at any time). The SPA loads
// every per-video JSON blob from the host's own /api/videos/<id>/ endpoint and
// decrypts the playback section client-side with AES-256-GCM.
//
// We replicate the SPA's decrypt path with Node's built-in crypto:
//   1. extract video id from /e/<id> in the embed URL
//   2. GET <host>/api/videos/<id>/ → JSON metadata + encrypted `playback`
//   3. AES-256-GCM decrypt:
//        key = concat(base64url-decoded(playback.key_parts))    // 32 bytes
//        iv  = base64url-decoded(playback.iv)                    // 12 bytes
//        ct+tag = base64url-decoded(playback.payload)            // last 16 = tag
//   4. Plaintext is JSON `{sources:[{url, label, mime_type, ...}], tracks:[]}`.
//
// The token in the M3U8 query string expires after 15 minutes — we always
// extract on-demand at stream-click time, so freshness is automatic.
//===============

const crypto = require("node:crypto");
const http = require("../providers/http");

function b64urlDecode(s) {
    if (!s) return Buffer.alloc(0);
    const norm = String(s).replace(/-/g, "+").replace(/_/g, "/");
    const padded = norm + "=".repeat((4 - norm.length % 4) % 4);
    return Buffer.from(padded, "base64");
}

function decryptPlayback(playback) {
    if (!playback || !Array.isArray(playback.key_parts) || playback.key_parts.length === 0) return null;
    const key = Buffer.concat(playback.key_parts.map(b64urlDecode));
    const iv = b64urlDecode(playback.iv);
    const ctAndTag = b64urlDecode(playback.payload);
    if (key.length !== 32) return null;
    if (iv.length !== 12) return null;
    if (ctAndTag.length < 16) return null;

    const tag = ctAndTag.subarray(ctAndTag.length - 16);
    const ciphertext = ctAndTag.subarray(0, ctAndTag.length - 16);

    try {
        const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
        decipher.setAuthTag(tag);
        const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
        return JSON.parse(plain.toString("utf8"));
    } catch (e) {
        return null;
    }
}

function extractVideoId(url) {
    if (!url) return null;
    try {
        const u = new URL(url);
        const m = u.pathname.match(/^\/e\/([^/?#]+)/);
        return m ? m[1] : null;
    } catch (e) {
        return null;
    }
}

async function byse(url, { referer } = {}) {
    if (!url) return [];
    let host;
    try { host = new URL(url).origin; } catch (e) { return []; }
    const videoId = extractVideoId(url);
    if (!videoId) return [];

    let meta;
    try {
        const r = await http.get(`${host}/api/videos/${encodeURIComponent(videoId)}/`, {
            timeout: 10000,
            headers: {
                "Referer": referer || `${host}/e/${videoId}`,
                "X-Requested-With": "XMLHttpRequest"
            }
        });
        meta = r.data;
    } catch (e) {
        return [];
    }

    if (!meta || !meta.playback) return [];

    const decoded = decryptPlayback(meta.playback);
    if (!decoded || !Array.isArray(decoded.sources)) return [];

    const proxyHeaders = {
        Referer: `${host}/`,
        Origin: host
    };

    return decoded.sources
        .filter(s => s && s.url)
        .map(s => ({
            url: s.url,
            server: "Byse",
            quality: s.label || (s.height ? `${s.height}p` : "auto"),
            dub: null,
            headers: proxyHeaders
        }));
}

module.exports = { byse, decryptPlayback, extractVideoId };
