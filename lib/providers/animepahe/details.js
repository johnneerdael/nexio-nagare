//===============
// AnimePahe details. The search response already includes format/year/episodes,
// so when a candidate from search() flows through, we echo it back from an
// in-process cache without an extra HTTP round-trip. Cold lookups (e.g. from
// an override or the persistent slug cache) fall back to a fresh search by
// slug — but AnimePahe's search is title-keyed, so we have no good way to
// resolve a bare slug → details. The fallback returns null, which the matcher
// treats as "details unavailable" and drops the candidate. That's the right
// no-false-positive behaviour.
//===============

const memo = new Map();

function recordSearchHit(searchResult) {
    if (!searchResult || !searchResult.slug) return;
    memo.set(searchResult.slug, searchResult);
}

async function getDetailsAnimePahe(slug) {
    if (!slug) return null;
    const cached = memo.get(slug);
    if (!cached) return null;
    return {
        slug: cached.slug,
        title: cached.title,
        format: cached.format || null,
        year: cached.year || null,
        episodeCount: cached.episodeCount || null,
        synonyms: [],
        type: null,
        status: cached.status || null
    };
}

module.exports = { getDetailsAnimePahe, recordSearchHit };
