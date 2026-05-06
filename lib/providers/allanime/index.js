//===============
// PROVIDER STATUS: deferred.
//
// AllAnime's GraphQL search endpoint works — every popular AniList ID we
// tested (One Piece 21, Naruto 20, Demon Slayer 101922, Death Note 1535,
// HxH 11061) resolves correctly via the `aniListId` field in search results.
//
// Episode lookups (`episode($showId, $translationType, $episodeString)` →
// sourceUrls) now return `NEED_CAPTCHA` from the GraphQL backend. Community
// clients (animdl, ani-cli) have all hit the same wall — the AnilistStream Go
// port worked when written but is broken today. The persisted-query hash
// fallback used to bypass this is also stale (`PersistedQueryNotFound`).
//
// This file is kept registered-out of lib/providers/index.js so it doesn't
// cost cold-path latency, but the code is preserved for revival if/when a
// hash refresh or alternate header trick lands.
//===============

const { searchAllAnime } = require("./search");
const { getDetailsAllAnime, recordSearchHit } = require("./details");
const { getStreamsAllAnime } = require("./stream");

//===============
// We wrap search() so each result is also recorded in the in-process detail
// cache; this means the matcher's details() call short-circuits to a memoised
// echo for any candidate that came through search() in the same dispatch.
// (After the AniList-ID-exact fast path lands, details() is rarely called
// at all for AllAnime — every result carries `extId.anilist` and the matcher
// can prove identity without it.)
//===============
async function search(query, opts) {
    const results = await searchAllAnime(query, opts);
    for (const r of results) recordSearchHit(r);
    return results;
}

module.exports = {
    id: "allanime",
    displayName: "AllAnime",
    language: "en",
    dub: "both",
    search,
    details: getDetailsAllAnime,
    getStreams: getStreamsAllAnime
};
