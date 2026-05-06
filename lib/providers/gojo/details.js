//===============
// Gojo details — usually never called.
//
// Because Gojo's slug is the AniList ID, lib/normalizer/match.js takes the
// AniList-ID-exact-match fast path and skips details() entirely. This file
// exists for the rare cold path (override that names a non-AniList slug or
// some future use). Falls back to a minimal echo from canonical metadata.
//===============

async function getDetailsGojo(slug) {
    if (!slug) return null;
    return {
        slug,
        title: null,
        format: null,
        year: null,
        episodeCount: null,
        synonyms: [],
        type: null
    };
}

module.exports = { getDetailsGojo };
