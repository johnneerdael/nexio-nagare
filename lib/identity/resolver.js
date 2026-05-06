//===============
// CanonicalIdentity resolver.
//
//   resolveCanonical(stremioId, opts) → { canonical, episode, season } | null
//
// Accepts any Stremio id form we declare in the manifest:
//   anilist:<id>            (with optional -<ep> suffix)
//   anilist:<id>:<ep>
//   kitsu:<id>:<ep>
//   mal:<id>:<ep>
//   anidb:<id>:<ep>
//   tt<imdbid>:<season>:<ep>
//
// Strategy:
//   1. Parse the stremioId into {idKind, externalId, season, episode}.
//   2. Resolve to an AniList id via the identity map (offline, daily-refreshed).
//   3. Fetch AniList metadata (cached in-process for 6h).
//   4. Merge identity-map record + AniList result into one CanonicalIdentity blob
//      that includes everything the scorer needs (format, year, episodeCount,
//      mainTitle, englishTitle, synonyms, all cross-IDs, optional episodeMapping).
//
// Returns null if we can't resolve the id to an AniList record we can fetch.
// Drop > guess.
//===============

const {
    loadAnimeMap,
    emptyAnimeMap,
    recordByAnidb,
    recordByAnilist,
    recordByImdb,
    recordByKitsu,
    recordByMal,
    episodeMappingByAnidb
} = require("./anime-map");
const { getAnimeMeta } = require("../anilist");

let cachedMap = null;
function defaultMapLoader() {
    if (cachedMap) return cachedMap;
    try {
        cachedMap = loadAnimeMap();
    } catch (e) {
        cachedMap = emptyAnimeMap();
    }
    return cachedMap;
}

function reloadAnimeMap() {
    cachedMap = null;
}

//===============
// Convert Fribb's "type" string → CanonicalIdentity.format slot.
// Values seen in feed: "TV", "Movie", "OVA", "Special", "Web", "Music".
//===============
function normalizeFormat(sourceType) {
    if (!sourceType) return null;
    const u = String(sourceType).trim().toUpperCase();
    if (u === "MOVIE" || u === "FILM") return "MOVIE";
    if (u === "TV") return "TV";
    if (u === "OVA") return "OVA";
    if (u === "SPECIAL") return "SPECIAL";
    if (u === "WEB" || u === "ONA") return "ONA";
    if (u === "MUSIC") return "MUSIC";
    return null;
}

//===============
// Format inference from AniList format field, used as a fallback when the
// identity-map record didn't provide one.
//===============
function formatFromAnilistFormat(anilistFormat) {
    if (!anilistFormat) return null;
    const u = String(anilistFormat).trim().toUpperCase();
    if (u === "MOVIE") return "MOVIE";
    if (u === "TV" || u === "TV_SHORT") return "TV";
    if (u === "OVA") return "OVA";
    if (u === "SPECIAL") return "SPECIAL";
    if (u === "ONA") return "ONA";
    if (u === "MUSIC") return "MUSIC";
    return null;
}

function parseStremioId(stremioId) {
    if (!stremioId || typeof stremioId !== "string") return null;
    const id = stremioId.trim();

    // anilist:1234 | anilist:1234-5 | anilist:1234:5
    let m = id.match(/^anilist:(\d+)(?:[-:](\d+))?(?:[-:](\d+))?$/);
    if (m) {
        const externalId = m[1];
        const season = m[3] ? parseInt(m[2], 10) : 1;
        const episode = parseInt(m[3] || m[2] || "1", 10) || 1;
        return { idKind: "anilist", externalId, season, episode };
    }

    m = id.match(/^kitsu:(\d+)(?:[-:](\d+))?(?:[-:](\d+))?$/);
    if (m) {
        const externalId = m[1];
        const season = m[3] ? parseInt(m[2], 10) : 1;
        const episode = parseInt(m[3] || m[2] || "1", 10) || 1;
        return { idKind: "kitsu", externalId, season, episode };
    }

    m = id.match(/^mal:(\d+)(?:[-:](\d+))?(?:[-:](\d+))?$/);
    if (m) {
        const externalId = m[1];
        const season = m[3] ? parseInt(m[2], 10) : 1;
        const episode = parseInt(m[3] || m[2] || "1", 10) || 1;
        return { idKind: "mal", externalId, season, episode };
    }

    m = id.match(/^anidb:(\d+)(?:[-:](\d+))?(?:[-:](\d+))?$/);
    if (m) {
        const externalId = m[1];
        const season = m[3] ? parseInt(m[2], 10) : 1;
        const episode = parseInt(m[3] || m[2] || "1", 10) || 1;
        return { idKind: "anidb", externalId, season, episode };
    }

    // tt0388629:1:5 (IMDB form Stremio sometimes emits for cross-listed anime)
    m = id.match(/^(tt\d+)(?::(\d+))?(?::(\d+))?$/);
    if (m) {
        return {
            idKind: "imdb",
            externalId: m[1],
            season: m[2] ? parseInt(m[2], 10) : 1,
            episode: m[3] ? parseInt(m[3], 10) : 1
        };
    }

    return null;
}

function recordFromMap(map, idKind, externalId) {
    switch (idKind) {
        case "anilist": return recordByAnilist(map, externalId);
        case "kitsu":   return recordByKitsu(map, externalId);
        case "mal":     return recordByMal(map, externalId);
        case "anidb":   return recordByAnidb(map, externalId);
        case "imdb":    return recordByImdb(map, externalId);
        default:        return null;
    }
}

//===============
// Public entrypoint.
//===============
async function resolveCanonical(stremioId, opts = {}) {
    const parsed = parseStremioId(stremioId);
    if (!parsed) return null;

    const map = (opts.loadMap || defaultMapLoader)();
    const record = recordFromMap(map, parsed.idKind, parsed.externalId);

    // We require an AniList id either from the request itself or from the map.
    let anilistId = parsed.idKind === "anilist" ? parsed.externalId : (record && record.anilist) || null;
    if (!anilistId) return null;

    let anilistMeta = null;
    try {
        anilistMeta = await (opts.fetchAnilistMeta || getAnimeMeta)(anilistId);
    } catch (e) {
        anilistMeta = null;
    }
    if (!anilistMeta) return null;

    const format =
        normalizeFormat(record?.sourceType) ||
        formatFromAnilistFormat(anilistMeta.format) ||
        (anilistMeta.type === "movie" ? "MOVIE" : null);

    const year = anilistMeta.releaseInfo ? parseInt(anilistMeta.releaseInfo, 10) : null;
    const episodeCount = Number.isFinite(anilistMeta.episodes) && anilistMeta.episodes > 0
        ? anilistMeta.episodes
        : null;

    const synonyms = Array.isArray(anilistMeta.synonyms) ? anilistMeta.synonyms.slice() : [];
    if (anilistMeta.altName && !synonyms.includes(anilistMeta.altName)) synonyms.unshift(anilistMeta.altName);

    const canonical = {
        // IDs
        anilist: anilistId,
        anidb: record?.anidb || null,
        mal: record?.mal || (anilistMeta.idMal ? String(anilistMeta.idMal) : null),
        kitsu: record?.kitsu || null,
        tmdb: record?.tmdb || null,
        imdb: record?.imdb || null,
        tvdb: record?.tvdb || null,

        // Format / timing
        format,
        mediaType: record?.mediaType || (format === "MOVIE" ? "movie" : "series"),
        year: Number.isFinite(year) ? year : null,
        episodeCount,

        // Titles
        mainTitle: anilistMeta.name || null,
        englishTitle: anilistMeta.englishName || null,
        synonyms,

        // Episode mapping (Scudlee, optional)
        episodeMapping: record?.anidb ? episodeMappingByAnidb(map, record.anidb) : null,

        // Provenance for logging
        resolvedFrom: parsed.idKind,
        hasIdentityMapRecord: Boolean(record)
    };

    return {
        canonical,
        episode: parsed.episode,
        season: parsed.season
    };
}

module.exports = {
    resolveCanonical,
    parseStremioId,
    reloadAnimeMap,
    normalizeFormat,
    formatFromAnilistFormat
};
