//===============
// MegaPlay (megaplay.buzz, vidwish.live, …) extractor.
//
// Animenosub's older-episode iframes — and the AllWish provider's primary
// player — funnel through MegaPlay. Pure JSON API path, no headless browser
// required (the WebView fallback in the Phisher Kotlin code is only for
// fingerprinted regions; the primary path works for unauthenticated requests
// from anywhere we've tested).
//
// Algorithm (matches AllWish/Extractors.kt:24-72 verbatim):
//   1. GET embed URL with X-Requested-With + Referer headers.
//   2. Parse `<div id="megaplay-player" data-id="X">` — that's the internal id.
//   3. GET <host>/stream/getSources?id=<X> → JSON `{sources:{file},tracks:[]}`.
//   4. Emit one StreamResult with the m3u8 + Referer/Origin proxyHeaders, plus
//      any `kind: "captions"|"subtitles"` tracks as subtitles.
//===============

const cheerio = require("cheerio");
const http = require("../providers/http");

async function megaplay(url, { referer } = {}) {
    if (!url) return [];
    let host;
    try { host = new URL(url).origin; } catch (e) { return []; }

    let html;
    try {
        const r = await http.get(url, {
            timeout: 10000,
            headers: {
                "Accept": "*/*",
                "X-Requested-With": "XMLHttpRequest",
                "Referer": referer || `${host}/`
            }
        });
        html = String(r.data || "");
    } catch (e) {
        return [];
    }

    const $ = cheerio.load(html);
    const id = $("#megaplay-player").attr("data-id") || $("[data-id]").first().attr("data-id");
    if (!id) return [];

    let payload;
    try {
        const r = await http.get(`${host}/stream/getSources?id=${encodeURIComponent(id)}`, {
            timeout: 10000,
            headers: {
                "Accept": "*/*",
                "X-Requested-With": "XMLHttpRequest",
                "Referer": `${host}/`
            }
        });
        payload = typeof r.data === "string" ? safeParse(r.data) : r.data;
    } catch (e) {
        return [];
    }

    const file = payload && payload.sources && payload.sources.file;
    if (!file) return [];

    const proxyHeaders = { Referer: `${host}/`, Origin: host };
    const tracks = Array.isArray(payload.tracks) ? payload.tracks : [];
    const subtitles = tracks
        .filter(t => t && t.file && (t.kind === "captions" || t.kind === "subtitles"))
        .map(t => ({ label: t.label || "Unknown", src: t.file }));

    return [{
        url: file,
        server: "MegaPlay",
        quality: "auto",
        dub: null,
        headers: proxyHeaders,
        subtitles
    }];
}

function safeParse(text) {
    try { return JSON.parse(text); } catch (e) { return null; }
}

module.exports = { megaplay };
