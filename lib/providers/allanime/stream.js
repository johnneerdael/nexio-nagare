//===============
// AllAnime episode resolution.
//
// Two-step:
//   1. POST GraphQL `episode($showId, $translationType, $episodeString)` to
//      fetch sourceUrls — each is `--<hex>` representing a path on the host.
//   2. Decode each sourceUrl, GET allanime.day{decodedPath} → JSON `{links:[]}`
//      where each link is either an HLS m3u8 (with optional subtitle tracks)
//      or a direct MP4. Filter by an allow-list of source names that we know
//      return playable, durable URLs.
//
// We fetch BOTH sub and dub variants in parallel because user dub-preference
// is filtered downstream by the score module / stream-builder via the `dub`
// flag we tag onto each StreamResult.
//===============

const axios = require("axios");
const { decodeProviderId } = require("./hex-decoder");
const { API_URL, REFERER, UA } = require("./search");

const ALLANIME_HOST = "https://allanime.day";
const ALLOWED_PROVIDERS = new Set(["Default", "Yt-mp4", "S-mp4", "Luf-Mp4"]);

const EPISODE_QUERY = `
query ($showId: String!, $translationType: VaildTranslationTypeEnumType!, $episodeString: String!) {
    episode(showId: $showId, translationType: $translationType, episodeString: $episodeString) {
        episodeString
        sourceUrls
    }
}`;

async function fetchEncodedProviders(showId, translationType, episode) {
    if (!showId || !translationType) return [];
    const variables = { showId, translationType, episodeString: String(episode) };
    let payload;
    try {
        const r = await axios.post(API_URL, { query: EPISODE_QUERY, variables }, {
            timeout: 10000,
            headers: {
                "Content-Type": "application/json",
                "Referer": REFERER,
                "User-Agent": UA
            }
        });
        payload = r.data?.data?.episode?.sourceUrls;
    } catch (e) {
        return [];
    }
    if (!Array.isArray(payload)) return [];
    return payload
        .filter(s => s && ALLOWED_PROVIDERS.has(s.sourceName))
        .map(s => ({ name: s.sourceName, encodedId: String(s.sourceUrl || "").replace(/^--/, "") }));
}

async function fetchSourceLinks(decodedPath) {
    if (!decodedPath) return [];
    if (decodedPath.startsWith("https://tools.fast4speed.rsvp")) return [];
    const url = `${ALLANIME_HOST}${decodedPath}`;
    let payload;
    try {
        const r = await axios.get(url, {
            timeout: 10000,
            headers: {
                "Referer": REFERER,
                "User-Agent": UA
            }
        });
        payload = r.data?.links;
    } catch (e) {
        return [];
    }
    if (!Array.isArray(payload)) return [];
    return payload;
}

function shapeLink(link, isDub) {
    if (!link || !link.link) return null;
    const subs = Array.isArray(link.subtitles) ? link.subtitles
        .filter(s => s && s.src && s.lang)
        .map(s => ({ src: s.src, label: s.lang })) : [];
    const proxyHeaders = link.headers && typeof link.headers === "object" && Object.keys(link.headers).length > 0
        ? link.headers
        : { Referer: REFERER + "/", "User-Agent": UA };
    const isHls = Boolean(link.hls);
    const quality = isHls ? "auto" : "1080p";
    return {
        url: link.link,
        server: "AllAnime",
        quality,
        dub: Boolean(isDub),
        headers: proxyHeaders,
        subtitles: subs
    };
}

async function getStreamsAllAnime(slug, episode) {
    if (!slug) return [];
    const ep = parseInt(episode, 10);
    if (!Number.isFinite(ep) || ep < 1) return [];

    const [subProviders, dubProviders] = await Promise.all([
        fetchEncodedProviders(slug, "sub", ep),
        fetchEncodedProviders(slug, "dub", ep)
    ]);

    const all = [
        ...subProviders.map(p => ({ ...p, isDub: false })),
        ...dubProviders.map(p => ({ ...p, isDub: true }))
    ];
    if (all.length === 0) return [];

    const linksByProvider = await Promise.all(all.map(async p => {
        const path = decodeProviderId(p.encodedId);
        const links = await fetchSourceLinks(path);
        return links.map(l => shapeLink(l, p.isDub)).filter(Boolean);
    }));

    return linksByProvider.flat();
}

module.exports = { getStreamsAllAnime, fetchEncodedProviders, fetchSourceLinks, shapeLink };
