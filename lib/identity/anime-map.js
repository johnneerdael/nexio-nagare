//===============
// Anime identity map — in-memory representation of the JSON file produced by
// scripts/identity-refresh.js (which merges Fribb's anime-lists JSON with
// Anime-Lists/anime-lists Scudlee XML).
//
// Lifted from nexio-torii's lib/catalog/anime-map.js with file-path defaults
// pointed at nexio-nagare's data/ directory.
//===============

const fs = require("node:fs");
const path = require("node:path");

function defaultAnimeMapPath() {
    return process.env.ANIME_MAP_PATH || path.join(process.cwd(), "data", "anime", "nexio-anime-map-v1.json");
}

function loadAnimeMap(filePath = defaultAnimeMapPath()) {
    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return {
        records: data.identityRecordsByKitsu || {},
        indexes: data.indexes || {},
        episodeMappings: data.episodeMappingsByAnidb || {}
    };
}

function emptyAnimeMap() {
    return {
        records: {},
        indexes: {},
        episodeMappings: {}
    };
}

function recordByAnidb(animeMap, anidbId) {
    const kitsu = animeMap.indexes.byAnidb?.[String(anidbId)];
    return kitsu ? animeMap.records[kitsu] || null : null;
}

function recordByKitsu(animeMap, kitsuId) {
    const kitsu = animeMap.indexes.byKitsu?.[String(kitsuId)];
    return kitsu ? animeMap.records[kitsu] || null : null;
}

function recordByMal(animeMap, malId) {
    const kitsu = animeMap.indexes.byMal?.[String(malId)];
    return kitsu ? animeMap.records[kitsu] || null : null;
}

function recordByAnilist(animeMap, anilistId) {
    const kitsu = animeMap.indexes.byAnilist?.[String(anilistId)];
    return kitsu ? animeMap.records[kitsu] || null : null;
}

function recordByImdb(animeMap, imdbId) {
    const kitsuList = animeMap.indexes.byImdb?.[String(imdbId)];
    if (!kitsuList || kitsuList.length === 0) return null;
    return animeMap.records[kitsuList[0]] || null;
}

function recordByTmdb(animeMap, tmdbId, mediaType) {
    const id = String(tmdbId);
    if (mediaType === "movie") {
        const kitsu = animeMap.indexes.byTmdbMovie?.[id];
        return kitsu ? animeMap.records[kitsu] || null : null;
    }
    const kitsu = animeMap.indexes.byTmdbTv?.[id]?.[0];
    return kitsu ? animeMap.records[kitsu] || null : null;
}

function episodeMappingByAnidb(animeMap, anidbId) {
    return animeMap.episodeMappings?.[String(anidbId)] || null;
}

module.exports = {
    defaultAnimeMapPath,
    emptyAnimeMap,
    loadAnimeMap,
    recordByAnidb,
    recordByAnilist,
    recordByImdb,
    recordByKitsu,
    recordByMal,
    recordByTmdb,
    episodeMappingByAnidb
};
