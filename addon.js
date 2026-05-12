//===============
// NEXIO NAGARE STREMIO ADDON - CORE LOGIC
// English-only direct-stream anime addon. Catalogs and metadata via AniList.
// Provider layer (lib/providers/) is wired in Wave 2.
//===============

const { addonBuilder } = require("stremio-addon-sdk");
const axios = require("axios");
const {
    searchAnime,
    getAnimeMeta,
    getTrendingAnime,
    getTopAnime,
    getAiringAnime,
    getSeasonalAnime,
    fetchEpisodeDetails
} = require("./lib/anilist");
const { fromBase64Safe, parseConfig, toBase64Safe } = require("./lib/config");
const { REGISTRY, REGISTRY_BY_ID, getActiveProviders } = require("./lib/providers");
const { attachDirectFileSizes, buildProviderStreams } = require("./lib/stream-builder");
const { resolveCanonical } = require("./lib/identity/resolver");
const { dispatchProviders, invalidateCachedSlug, markSlugSucceeded } = require("./lib/dispatch");

let BASE_URL = process.env.BASE_URL || "http://127.0.0.1:7002";
BASE_URL = BASE_URL.replace(/\/+$/, "");

const STREAM_HANDLER_TIMEOUT_MS = 14_000;

function withTimeout(promise, ms, fallback) {
    return Promise.race([
        promise,
        new Promise(resolve => setTimeout(() => resolve(fallback), ms))
    ]);
}

//===============
// TITLE PREFERENCE APPLIER
//===============
function applyTitlePreference(metas, userConfig) {
    if (userConfig.useEnglishTitles === false || !metas) return metas;
    return metas.map(m => ({ ...m, name: m.englishName || m.name }));
}

//===============
// STREMIO ADDON MANIFEST
//===============
const manifest = {
    "id": "org.community.nexionagare",
    "version": "0.1.0",
    "name": "Nexio Nagare",
    "logo": BASE_URL + "/favicon.png",
    "description": "English direct streams for anime, sourced from public providers (123anime, Anizone, Anichi, Animenosub, Animexin and more).",
    "stremioAddonsConfig": {
        "issuer": "https://stremio-addons.net",
        "signature": "eyJhbGciOiJkaXIiLCJlbmMiOiJBMTI4Q0JDLUhTMjU2In0..JXQKygN9S1YfPjhQMPMnjA.OilkniXFkGVAwEuIEvQ4XmqzcJS5g9ExPpnngeKExSGZMXNI5_vMBDz5UOJ3N9c0B1ofYF2Ym8SXZCLS8u-Ih0lFVWujHJ7IlMdQEG2fstsdX4CKujAtmRnSoIr5qp7L.SG6iSf9qj6PIWcCnlZC9_w"
    },
    "types": ["anime", "movie", "series"],
    "resources": [
        "catalog",
        {
            "name": "meta",
            "types": ["anime", "movie", "series"],
            "idPrefixes": ["anilist:", "nexio_raw:"]
        },
        {
            "name": "stream",
            "types": ["anime", "movie", "series"],
            "idPrefixes": ["anilist:", "kitsu:", "tt", "nexio_raw:"]
        }
    ],
    "catalogs": [
        { "id": "nexio_seasonal_series", "type": "anime", "name": "Nexio Nagare Current Season" },
        { "id": "nexio_airing_series", "type": "anime", "name": "Nexio Nagare Currently Airing" },
        { "id": "nexio_trending_series", "type": "anime", "name": "Nexio Nagare Trending Series" },
        { "id": "nexio_top_series", "type": "anime", "name": "Nexio Nagare Top Rated Series" },
        { "id": "nexio_trending_movie", "type": "movie", "name": "Nexio Nagare Trending Movies" },
        { "id": "nexio_top_movie", "type": "movie", "name": "Nexio Nagare Top Rated Movies" },
        { "id": "nexio_search", "type": "anime", "name": "Nexio Nagare Search", "extra": [{ "name": "search", "isRequired": true }] },
        { "id": "nexio_search", "type": "movie", "name": "Nexio Nagare Search", "extra": [{ "name": "search", "isRequired": true }] },
        { "id": "nexio_search", "type": "series", "name": "Nexio Nagare Search", "extra": [{ "name": "search", "isRequired": true }] }
    ],
    "config": [{ "key": "NexioNagare", "type": "text", "title": "Nexio Nagare Internal Payload" }],
    "behaviorHints": { "configurable": true, "configurationRequired": false }
};

const builder = new addonBuilder(manifest);

//===============
// CATALOG HANDLER
//===============
builder.defineCatalogHandler(async ({ type, id, extra, config }) => {
    try {
        const userConfig = parseConfig(config);

        if (id === "nexio_seasonal_series" && userConfig.showSeasonalSeries !== false) {
            const results = await getSeasonalAnime("anime");
            return { "metas": applyTitlePreference(results.filter(m => m.type === type), userConfig), "cacheMaxAge": 14400 };
        }
        if (id === "nexio_airing_series" && userConfig.showAiringSeries !== false) {
            const results = await getAiringAnime("anime");
            return { "metas": applyTitlePreference(results.filter(m => m.type === type), userConfig), "cacheMaxAge": 14400 };
        }
        if (id === "nexio_trending_series" && userConfig.showTrendingSeries !== false) {
            const results = await getTrendingAnime("anime");
            return { "metas": applyTitlePreference(results.filter(m => m.type === type), userConfig), "cacheMaxAge": 21600 };
        }
        if (id === "nexio_top_series" && userConfig.showTopSeries !== false) {
            const results = await getTopAnime("anime");
            return { "metas": applyTitlePreference(results.filter(m => m.type === type), userConfig), "cacheMaxAge": 86400 };
        }
        if (id === "nexio_trending_movie" && userConfig.showTrendingMovies !== false) {
            const results = await getTrendingAnime("movie");
            return { "metas": applyTitlePreference(results.filter(m => m.type === type), userConfig), "cacheMaxAge": 21600 };
        }
        if (id === "nexio_top_movie" && userConfig.showTopMovies !== false) {
            const results = await getTopAnime("movie");
            return { "metas": applyTitlePreference(results.filter(m => m.type === type), userConfig), "cacheMaxAge": 86400 };
        }

        if (id === "nexio_search" && extra.search) {
            const [anilistRes, cinemetaRes] = await Promise.all([
                searchAnime(extra.search).catch(() => []),
                axios.get(`https://v3-cinemeta.strem.io/catalog/${type}/top/search=${encodeURIComponent(extra.search)}.json`, { timeout: 4000 })
                    .then(res => res.data.metas || [])
                    .catch(() => [])
            ]);

            const results = [];
            const seenIds = new Set();

            applyTitlePreference(anilistRes.filter(m => m.type === type), userConfig).forEach(m => {
                results.push(m);
                seenIds.add(m.id);
            });
            cinemetaRes.forEach(m => {
                if (!seenIds.has(m.id)) {
                    results.push(m);
                    seenIds.add(m.id);
                }
            });

            return { "metas": results, "cacheMaxAge": 86400 };
        }

        return { "metas": [] };
    } catch (e) {
        return { "metas": [] };
    }
});

//===============
// META HANDLER
//===============
builder.defineMetaHandler(async ({ type, id, config }) => {
    try {
        const userConfig = parseConfig(config);

        if (id.startsWith("nexio_raw:")) {
            const parts = id.split(":");
            const mType = parts[1];
            const query = fromBase64Safe(parts[2]);
            const rawMeta = {
                "id": id,
                "type": mType,
                "name": query + " (Raw Search)",
                "poster": `https://dummyimage.com/600x900/1a1a1a/42a5f5.png?text=${encodeURIComponent(query)}\nRaw+Search`,
                "background": `https://dummyimage.com/1920x1080/1a1a1a/42a5f5.png?text=${encodeURIComponent(query)}`,
                "description": `Dynamically generated metadata for "${query}".`
            };
            if (mType === "series" || mType === "anime") {
                rawMeta.videos = [];
                for (let s = 1; s <= 10; s++) {
                    for (let e = 1; e <= 100; e++) {
                        rawMeta.videos.push({
                            "id": `${id}-${e}`,
                            "title": `Episode ${e}`,
                            "season": s,
                            "episode": e
                        });
                    }
                }
            } else if (mType === "movie") {
                rawMeta.videos = [{
                    "id": id,
                    "title": query || "Movie",
                    "released": new Date().toISOString()
                }];
                rawMeta.behaviorHints = { "defaultVideoId": id };
            }
            return { "meta": rawMeta, "cacheMaxAge": 86400 };
        }

        if (!id.startsWith("anilist:")) return { "meta": null };
        const aniListId = id.split(":")[1];
        if (!aniListId || isNaN(aniListId)) return { "meta": null };

        const rawMeta = await getAnimeMeta(aniListId);
        if (!rawMeta) return { "meta": null };

        const meta = { ...rawMeta };
        if (userConfig.useEnglishTitles !== false && meta.englishName) {
            meta.name = meta.englishName;
        }
        meta.id = id;

        if (meta.type === "anime" || meta.type === "series") {
            meta.type = "anime";
            const jikanEps = meta.idMal ? await fetchEpisodeDetails(meta.idMal).catch(() => ({})) : {};
            const epMeta = meta.epMeta || {};
            const defaultThumb = meta.background || meta.poster || "https://dummyimage.com/600x337/1a1a1a/42a5f5.png?text=NEXIO+NAGARE+EPISODE";
            meta.videos = Array.from({ "length": meta.episodes || 12 }, (_, i) => {
                const epNum = i + 1;
                const jData = jikanEps[epNum] || {};
                const epData = epMeta[epNum] || {};
                return {
                    "id": `${id}-${epNum}`,
                    "title": jData.title || epData.title || `Episode ${epNum}`,
                    "season": 1,
                    "episode": epNum,
                    "thumbnail": epData.thumbnail || defaultThumb
                };
            });
        } else if (meta.type === "movie") {
            meta.videos = [{
                "id": id,
                "title": meta.name || "Movie",
                "released": meta.released || new Date().toISOString(),
                "thumbnail": meta.poster
            }];
            meta.behaviorHints = { "defaultVideoId": id };
        }

        return { "meta": meta, "cacheMaxAge": 604800 };
    } catch (e) {
        return { "meta": null };
    }
});

//===============
// STREAM HANDLER
//
//   1. Resolve any Stremio id (anilist:/kitsu:/tt/mal:/anidb:) to a canonical
//      identity blob via the offline anime-map plus AniList metadata.
//   2. Dispatch to all enabled providers in parallel: each runs query
//      generation → search → score+gate against canonical → returns matched
//      slug or null. Slug cache + override file handle the warm-path cases.
//   3. For each surviving slug, call provider.getStreams(slug, episode) and
//      emit Stremio stream objects (proxyHeaders carry Referer/Origin so the
//      player fetches directly — no addon-side data path).
//   4. If a provider returns zero streams for a cached slug, auto-invalidate
//      the cache so a stale slug doesn't poison subsequent requests.
//===============
builder.defineStreamHandler(async ({ type, id, config }) => {
    try {
        const userConfig = parseConfig(config);
        const providers = getActiveProviders(userConfig);
        if (providers.length === 0) return { "streams": [] };

        const resolved = await resolveCanonical(id);
        if (!resolved) return { "streams": [] };
        const { canonical, episode, season } = resolved;

        const matches = await withTimeout(
            dispatchProviders({
                canonical,
                providers,
                opts: { preferDub: Boolean(userConfig.preferDub) }
            }),
            STREAM_HANDLER_TIMEOUT_MS,
            []
        );

        // Each provider with a matched slug emits its own stream entries in parallel.
        const streamJobs = matches.map(async m => {
            if (!m || !m.slug) return [];
            const provider = REGISTRY_BY_ID.get(m.providerId);
            if (!provider) return [];
            try {
                const adjustedEpisode = episode + (Number.isFinite(m.episodeOffset) ? m.episodeOffset : 0);
                const providerStreams = await withTimeout(
                    provider.getStreams(m.slug, adjustedEpisode),
                    8000,
                    []
                );
                if (Array.isArray(providerStreams) && providerStreams.length === 0 && m.source !== "match") {
                    // Cached/override slug returned no streams — likely stale. Invalidate cache.
                    invalidateCachedSlug({ canonical, providerId: m.providerId, opts: { preferDub: Boolean(userConfig.preferDub) } });
                }
                if (Array.isArray(providerStreams) && providerStreams.length > 0) {
                    markSlugSucceeded({ canonical, providerId: m.providerId, opts: { preferDub: Boolean(userConfig.preferDub) } });
                }
                const sizedProviderStreams = await attachDirectFileSizes(providerStreams);
                return buildProviderStreams({
                    providerStreams: sizedProviderStreams,
                    provider,
                    canonical,
                    episode: adjustedEpisode,
                    season: season || 1,
                    match: {
                        score: m.debug?.score ?? null,
                        confidence: m.confidence || "MEDIUM",
                        reasons: m.debug?.reasons || [m.source || "match"],
                        source: m.source || "match"
                    },
                    baseUrl: BASE_URL
                });
            } catch (e) {
                console.error(`[stream] provider=${m.providerId} getStreams failed: ${e.message}`);
                return [];
            }
        });

        const all = await Promise.all(streamJobs);
        const streams = all.flat();

        return { "streams": streams, "cacheMaxAge": streams.length > 0 ? 1800 : 60 };
    } catch (e) {
        console.error("[stream] handler error", e);
        return { "streams": [] };
    }
});

module.exports = { "addonInterface": builder.getInterface(), manifest, parseConfig };
