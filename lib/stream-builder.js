//===============
// Stream-builder for direct-stream providers.
// Delegates name/description rendering to the lib/stream-formatter module
// (Nexio universal-formatter integration). Keeps subtitle/sub-proxy mapping
// here since those are top-level Stremio stream fields, not derived from the
// EnrichedDirectStream shape.
//===============

const { encodeSubProxyUrl } = require("./sub-proxy");
const { enrichDirectStream, formatNagareStream } = require("./stream-formatter");

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

module.exports = { buildProviderStreams, languageCode, mapSubtitle };
