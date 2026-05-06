//===============
// Filemoon (Filesim) family extractor — covers filemoon.sx, filemoon.to,
// files.im, guccihide.com, ahvsh.com, moviesm4u.com, streamhide.com,
// streamhide.to, movhide.pro, ztreamhub.com.
//
// Algorithm (matches CloudStream's Filesim.kt):
//   1. Replace `/download/` with `/e/` in the URL.
//   2. GET the embed page.
//   3. If it contains an iframe, follow it (Filemoon often wraps the real
//      player in a child iframe).
//   4. Find packed JS, unpack, then regex `sources:[{file:"..."}]`.
//===============

const cheerio = require("cheerio");
const http = require("../providers/http");
const { unpackFromHtml } = require("./jsunpacker");
const { extractSources } = require("./jwplayer-config");

async function filemoon(url, { referer } = {}) {
    if (!url) return [];
    const embedUrl = url.replace("/download/", "/e/");
    let host;
    try { host = new URL(embedUrl).origin; } catch (e) { return []; }

    const baseHeaders = {
        "Accept": "*/*",
        "Accept-Language": "en-US,en;q=0.5",
        "Sec-Fetch-Dest": "iframe",
        "Referer": referer || `${host}/`
    };

    let response;
    try {
        response = await http.get(embedUrl, { headers: baseHeaders, timeout: 10000 });
    } catch (e) {
        return [];
    }
    let html = String(response.data || "");
    let finalUrl = embedUrl;

    // Some Filemoon mirrors wrap the player in a child iframe — follow once.
    const $ = cheerio.load(html);
    const iframe = $("iframe").first().attr("src");
    if (iframe) {
        try {
            const r2 = await http.get(iframe, {
                headers: { ...baseHeaders, "Referer": finalUrl },
                timeout: 10000
            });
            html = String(r2.data || "");
            finalUrl = iframe;
        } catch (e) {
            // fall through with the original page contents
        }
    }

    const unpacked = unpackFromHtml(html) || html;
    const sources = extractSources(unpacked);
    if (sources.length === 0) return [];

    const proxyHeaders = { Referer: `${host}/`, Origin: host };
    return sources.map(s => ({
        url: s.url,
        server: "Filemoon",
        quality: s.label || s.quality || "auto",
        dub: null,
        headers: proxyHeaders
    }));
}

module.exports = { filemoon };
