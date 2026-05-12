//===============
// Stream-builder for direct-stream providers.
// Delegates name/description rendering to the lib/stream-formatter module
// (Nexio universal-formatter integration). Keeps subtitle/sub-proxy mapping
// here since those are top-level Stremio stream fields, not derived from the
// EnrichedDirectStream shape.
//===============

const { encodeSubProxyUrl } = require("./sub-proxy");
const { enrichDirectStream, formatNagareStream } = require("./stream-formatter");
const { DEFAULT_HEADERS, httpClient } = require("./providers/http");

const LANG_MAP = {
    english: "eng", en: "eng", "en-us": "eng", "en-gb": "eng",
    japanese: "jpn", jp: "jpn", ja: "jpn",
    spanish: "spa", es: "spa",
    french: "fre", fr: "fre",
    german: "ger", de: "ger",
    italian: "ita", it: "ita",
    portuguese: "por", "pt-br": "por", pt: "por",
    arabic: "ara", ar: "ara",
    russian: "rus", ru: "rus",
    chinese: "chi", "zh-cn": "chi", "zh-tw": "chi",
    korean: "kor", ko: "kor",
    indonesian: "ind", id: "ind",
    polish: "pol", pl: "pol",
    turkish: "tur", tr: "tur",
    dutch: "dut", nl: "dut"
};

function languageCode(label) {
    if (!label) return "und";
    const k = String(label).trim().toLowerCase().split(/[\s-_]/)[0];
    return LANG_MAP[k] || LANG_MAP[String(label).trim().toLowerCase()] || String(label).trim().toLowerCase().slice(0, 3) || "und";
}

function inferExt(src) {
    const m = String(src || "").match(/\.([a-z]{2,4})(?:\?|#|$)/i);
    if (!m) return "vtt";
    const ext = m[1].toLowerCase();
    if (["vtt", "srt", "ass", "ssa"].includes(ext)) return ext;
    return "vtt";
}

function mapSubtitle(track, baseUrl) {
    if (!track || !track.src) return null;
    const lang = languageCode(track.label || track.lang || "und");
    let url = track.src;
    if (track.proxy && baseUrl) {
        url = encodeSubProxyUrl({
            url: track.src,
            headers: track.headers || null,
            ext: inferExt(track.src),
            baseUrl
        }) || track.src;
    }
    return {
        id: `${lang}-${Buffer.from(track.src).toString("hex").slice(0, 8)}`,
        url,
        lang
    };
}

function isDirectFileUrl(url) {
    return /\.(?:mp4|mkv|webm|m4v|mov)(?:[?#]|$)/i.test(String(url || ""));
}

function parseContentLength(headers) {
    const contentRange = headers && (headers["content-range"] || headers["Content-Range"]);
    if (contentRange) {
        const match = String(contentRange).match(/\/(\d+)\s*$/);
        if (match) return Number(match[1]);
    }
    const contentLength = headers && (headers["content-length"] || headers["Content-Length"]);
    const parsed = Number(contentLength);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

async function probeContentLength(url, headers = {}) {
    const requestHeaders = { ...DEFAULT_HEADERS, ...headers };
    try {
        const head = await httpClient.head(url, {
            timeout: 1500,
            maxRedirects: 3,
            headers: requestHeaders,
            validateStatus: status => status >= 200 && status < 400
        });
        const size = parseContentLength(head.headers);
        if (size) return size;
    } catch (e) {}

    try {
        const ranged = await httpClient.get(url, {
            timeout: 1500,
            maxRedirects: 3,
            responseType: "arraybuffer",
            maxContentLength: 1024,
            headers: { ...requestHeaders, Range: "bytes=0-0" },
            validateStatus: status => status >= 200 && status < 400
        });
        return parseContentLength(ranged.headers);
    } catch (e) {
        return null;
    }
}

async function attachDirectFileSizes(providerStreams, options = {}) {
    if (!Array.isArray(providerStreams) || providerStreams.length === 0) return [];
    const probe = options.probe || probeContentLength;
    return Promise.all(providerStreams.map(async ps => {
        if (!ps || ps.sizeBytes || !isDirectFileUrl(ps.url)) return ps;
        const sizeBytes = await probe(ps.url, ps.headers || {});
        return Number.isFinite(sizeBytes) && sizeBytes > 0 ? { ...ps, sizeBytes } : ps;
    }));
}

function buildProviderStreams({ providerStreams, provider, canonical, episode, season, match, baseUrl }) {
    if (!Array.isArray(providerStreams) || providerStreams.length === 0) return [];
    if (!provider) return [];

    const streams = [];
    for (const ps of providerStreams) {
        if (!ps || !ps.url) continue;

        const enriched = enrichDirectStream({
            provider,
            providerStream: ps,
            canonical: canonical || {},
            episode,
            season: season || 1,
            match
        });
        const stream = formatNagareStream(enriched, {
            url: ps.url,
            headers: ps.headers || {}
        });

        if (Array.isArray(ps.subtitles) && ps.subtitles.length > 0) {
            const subs = ps.subtitles.map(t => mapSubtitle(t, baseUrl)).filter(Boolean);
            if (subs.length > 0) stream.subtitles = subs;
        }

        streams.push(stream);
    }
    return streams;
}

module.exports = { attachDirectFileSizes, buildProviderStreams, languageCode, mapSubtitle };
