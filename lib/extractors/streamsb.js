//===============
// StreamSB family extractor — covers waaw.to plus sbplay/sblona/sbasian/sbnet/etc.
// (about 30 mirrors). Different from the other extractors: no JsUnpacker
// involved, just a hex-encoded path that returns JSON containing the M3U8.
//
// Algorithm (matches CloudStream's StreamSB.kt):
//   1. Extract the video id from the embed URL — pattern `(embed-X|/e/X)`.
//   2. Build a hex-encoded path: `{rand}||{id}||{rand}||streamsb` → hex → lowercase.
//   3. GET `${host}/375664356a494546326c4b797c7c6e756577776778623171737/{hex}`
//      with header `watchsb: sbstream` and Referer = embed URL.
//   4. Parse JSON, extract `stream_data.file` (M3U8). Subtitles in `stream_data.subs[]`.
//===============

const http = require("../providers/http");

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

function randomToken(len = 12) {
    let out = "";
    for (let i = 0; i < len; i++) {
        out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
    }
    return out;
}

function toHex(str) {
    let out = "";
    for (let i = 0; i < str.length; i++) {
        out += str.charCodeAt(i).toString(16);
    }
    return out;
}

function encodeId(id) {
    const code = `${randomToken()}||${id}||${randomToken()}||streamsb`;
    return toHex(code);
}

function extractId(url) {
    const m = /(?:embed-|\/e\/)([a-zA-Z0-9][a-zA-Z0-9_-]+)/.exec(String(url || ""));
    return m ? m[1] : null;
}

async function streamsb(url, { referer } = {}) {
    if (!url) return [];
    const id = extractId(url);
    if (!id) return [];

    let host;
    try { host = new URL(url).origin; } catch (e) { return []; }

    const masterUrl = `${host}/375664356a494546326c4b797c7c6e756577776778623171737/${encodeId(id).toLowerCase()}`;

    let payload;
    try {
        const r = await http.get(masterUrl, {
            headers: { "watchsb": "sbstream" },
            timeout: 10000
        });
        payload = r.data;
    } catch (e) {
        return [];
    }

    const data = (typeof payload === "string") ? safeParseJson(payload) : payload;
    const file = data && data.stream_data && data.stream_data.file;
    if (!file) return [];

    const proxyHeaders = { Referer: referer || `${host}/` };
    return [{
        url: file,
        server: "StreamSB",
        quality: "auto",
        dub: null,
        headers: proxyHeaders
    }];
}

function safeParseJson(text) {
    try { return JSON.parse(text); } catch (e) { return null; }
}

module.exports = { streamsb, encodeId, extractId };
