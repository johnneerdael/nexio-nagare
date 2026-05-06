//===============
// 123anime episode → direct M3U8 extractor.
// Adapted from 123anime-api/scrapeanime/SingleEpisode/scrapeSingleEpisode.js.
// Returns provider-shaped StreamResult objects (see lib/providers/base.js).
// We only return entries when a direct M3U8 is extractable — embed-only iframes
// cannot be played by Stremio without browser-side execution.
//===============

const { get } = require("../http");

const BASE_URL = "https://123anime.la";
const STREAM_CACHE_TTL_MS = 5 * 60 * 1000;
const streamCache = new Map();

async function extractDirectM3u8(streamingLink) {
    if (!streamingLink || !streamingLink.includes("echovideo.ru/embed-3/")) return null;

    try {
        const e1 = await get(streamingLink, { timeout: 6000 });
        const zrMatch = e1.data.match(/var zrpart2\s*=\s*'([^']+)'/);
        if (!zrMatch) return null;
        const zrpart2 = zrMatch[1];
        const baseUrl = streamingLink.split("/").slice(0, 3).join("/");
        const hsUrl = `${baseUrl}/hs/${zrpart2}`;

        const e2 = await get(hsUrl, { headers: { Referer: streamingLink }, timeout: 6000 });
        const idMatch = e2.data.match(/data-id="([^"]+)"/);
        if (!idMatch) return null;
        const dataId = idMatch[1];

        const sourcesUrl = `${baseUrl}/hs/getSources?id=${dataId}`;
        const e3 = await get(sourcesUrl, {
            headers: {
                Referer: hsUrl,
                "X-Requested-With": "XMLHttpRequest"
            },
            timeout: 6000
        });

        if (!e3.data || !e3.data.sources) return null;

        return {
            url: e3.data.sources,
            headers: {
                Referer: baseUrl + "/",
                Origin: baseUrl
            }
        };
    } catch (e) {
        return null;
    }
}

async function getStreams123anime(slug, episodeNumber) {
    if (!slug || !episodeNumber) return [];

    const ep = parseInt(episodeNumber, 10);
    if (!Number.isFinite(ep) || ep < 1) return [];

    const cacheKey = `${slug}|${ep}`;
    const cached = streamCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.streams;

    const apiUrl = `${BASE_URL}/ajax/episode/info?epr=${slug}%2F${ep}%2Fvidstreaming.io&ts=001`;
    const refererPadded = `${BASE_URL}/anime/${slug}/episode/${String(ep).padStart(3, "0")}`;

    let streamingLink = null;
    try {
        const response = await get(apiUrl, {
            headers: {
                "X-Requested-With": "XMLHttpRequest",
                Referer: refererPadded
            },
            timeout: 8000
        });
        streamingLink = response.data && response.data.target ? response.data.target : null;
    } catch (e) {
        return [];
    }

    if (!streamingLink) return [];

    const extracted = await extractDirectM3u8(streamingLink);
    if (!extracted) return [];

    const streams = [{
        url: extracted.url,
        server: "vidstreaming",
        quality: "auto",
        dub: /-dub(\b|$)/i.test(slug),
        headers: extracted.headers
    }];

    streamCache.set(cacheKey, { expiresAt: Date.now() + STREAM_CACHE_TTL_MS, streams });
    return streams;
}

module.exports = { getStreams123anime };
