//===============
// Stream-builder for direct-stream providers.
// Takes an array of provider results and produces Stremio stream objects.
// All requests use behaviorHints.proxyHeaders so the player sends the
// Referer/Origin/UA the host requires — we never proxy bytes through the addon.
//
// Subtitles attached to a provider StreamResult flow through as a top-level
// `subtitles` array on the Stremio stream. If a track sets `proxy: true` (host
// requires Referer that Stremio's track loader doesn't forward), the URL is
// rewritten to /sub/<payload>.<ext> served by lib/sub-proxy.js.
//===============

const { encodeSubProxyUrl } = require("./sub-proxy");

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

function qualityEmoji(quality) {
    if (!quality) return "📺";
    const q = String(quality).toLowerCase();
    if (q.includes("4k") || q.includes("2160")) return "🎞️ 4K";
    if (q.includes("1080")) return "🎞️ 1080p";
    if (q.includes("720")) return "🎞️ 720p";
    if (q.includes("auto")) return "🎞️ AUTO";
    return `🎞️ ${quality}`;
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

function buildProviderStreams({ providerStreams, providerDisplayName, animeTitle, episode, baseUrl }) {
    if (!Array.isArray(providerStreams) || providerStreams.length === 0) return [];
    const streams = [];

    for (const s of providerStreams) {
        if (!s || !s.url) continue;

        const trackTag = s.dub ? "🎙️ DUB" : "📝 SUB";
        const lines = [
            `NEXIO NAGARE [${providerDisplayName}]`,
            `${qualityEmoji(s.quality)} | ${trackTag}`
        ];
        const description = [
            `🎬 ${animeTitle || "Anime"} · EP ${episode}`,
            `🛰️ Server: ${s.server || "unknown"}`
        ].join("\n");

        const stream = {
            name: lines.join("\n"),
            description,
            url: s.url,
            behaviorHints: {
                bingeGroup: `nexio_nagare_${providerDisplayName}_${s.server || "default"}`,
                notWebReady: true
            }
        };
        if (s.headers && Object.keys(s.headers).length > 0) {
            stream.behaviorHints.proxyHeaders = {
                request: s.headers,
                response: s.headers
            };
        }
        if (Array.isArray(s.subtitles) && s.subtitles.length > 0) {
            const subs = s.subtitles.map(t => mapSubtitle(t, baseUrl)).filter(Boolean);
            if (subs.length > 0) stream.subtitles = subs;
        }
        streams.push(stream);
    }

    return streams;
}

module.exports = { buildProviderStreams, languageCode, mapSubtitle };
