//===============
// Vtbe (vtbe.to) extractor — used by Animenosub and Animexin.
// Algorithm (matches Phisher's Vtbe.kt verbatim):
//   1. GET the embed URL with Referer = mainUrl.
//   2. Pick the <script> containing `function(p,a,c,k,e,d)`, unpack it.
//   3. Regex-extract `sources:[{file:"..."}]` → M3U8.
//===============

const http = require("../providers/http");
const { unpackFromHtml } = require("./jsunpacker");
const { extractSources } = require("./jwplayer-config");

const MAIN_URL = "https://vtbe.to";

async function vtbe(url, { referer } = {}) {
    if (!url) return [];

    let html;
    try {
        const r = await http.get(url, {
            headers: { "Referer": MAIN_URL + "/" },
            timeout: 10000
        });
        html = String(r.data || "");
    } catch (e) {
        return [];
    }

    const unpacked = unpackFromHtml(html);
    if (!unpacked) return [];
    const sources = extractSources(unpacked);
    if (sources.length === 0) return [];

    const proxyHeaders = { Referer: referer || MAIN_URL + "/" };
    return sources.map(s => ({
        url: s.url,
        server: "Vtbe",
        quality: s.label || s.quality || "auto",
        dub: null,
        headers: proxyHeaders
    }));
}

module.exports = { vtbe, MAIN_URL };
