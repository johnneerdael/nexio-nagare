//===============
// StreamWish family extractor — covers streamwish.to, wishfast.top, embedwish.com,
// swiftplayers.com, sfastwish.com, hlswish.com, wishonly.site, mwish.pro, dwish.pro,
// kswplayer.info, strwish.xyz, flaswish.com, awish.pro, obeywish.com, jodwish.com,
// swhoi.com, multimovies.cloud, uqloads.xyz, doodporn.xyz, cdnwish.com, asnwish.com,
// nekowish.my.id, neko-stream.click, swdyu.com, playerwish.com, streamhls.to,
// streamwish.site (about 30 mirrors). All share the same player template.
//
// Algorithm:
//   1. Normalise embed URL (`/f/<id>` and `/e/<id>` both → `/<id>` on the same host).
//   2. GET embed page with browser-style headers + referer.
//   3. Find the packed JS payload, unpack it, then regex-extract `sources:[{file:"..."}]`.
//
// Returns an array of { url, server, quality, dub, headers } StreamResults
// matching lib/providers/base.js. Headers carry Referer/Origin so the
// player can hit the CDN directly — addon never proxies bytes.
//===============

const http = require("../providers/http");
const { unpackFromHtml } = require("./jsunpacker");
const { extractSources } = require("./jwplayer-config");

function normaliseEmbedUrl(url) {
    try {
        const u = new URL(url);
        const m = u.pathname.match(/^\/(?:f|e)\/(.+)$/);
        if (m) return `${u.origin}/${m[1]}`;
        return u.toString();
    } catch (e) {
        return url;
    }
}

async function streamwish(url, { referer } = {}) {
    if (!url) return [];
    const target = normaliseEmbedUrl(url);
    let host;
    try { host = new URL(target).origin; } catch (e) { return []; }

    const headers = {
        "Accept": "*/*",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "cross-site",
        "Referer": referer || `${host}/`,
        "Origin": host
    };

    let html;
    try {
        const r = await http.get(target, { headers, timeout: 10000 });
        html = String(r.data || "");
    } catch (e) {
        return [];
    }

    const unpacked = unpackFromHtml(html) || html;
    const sources = extractSources(unpacked);
    if (sources.length === 0) return [];

    const proxyHeaders = { Referer: `${host}/`, Origin: host };
    return sources.map(s => ({
        url: s.url,
        server: "StreamWish",
        quality: s.label || s.quality || "auto",
        dub: null,
        headers: proxyHeaders
    }));
}

module.exports = { streamwish, normaliseEmbedUrl };
