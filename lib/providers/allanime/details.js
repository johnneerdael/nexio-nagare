//===============
// AllAnime details — slug → format/year/episodeCount.
//
// AllAnime's search response already carries every field the matcher needs,
// so when a candidate from search() is passed back here we can echo it back
// without an extra round-trip. If the slug isn't in the in-process cache
// (e.g. coming from an override or slug-cache hit), we fall back to a single
// GraphQL query keyed by `_id`.
//
// In practice: after the AniList-ID-exact-match fast path lands in match.js,
// the matcher won't even call details() for AllAnime. This file exists to
// keep the provider contract honest.
//===============

const axios = require("axios");
const { API_URL, REFERER, UA } = require("./search");

const SHOW_QUERY = `
query ($id: String!) {
    show(_id: $id) {
        _id name englishName nativeName thumbnail
        aniListId malId episodeCount status type
        airedStart
    }
}`;

const memo = new Map();

function recordSearchHit(searchResult) {
    if (!searchResult || !searchResult.slug) return;
    memo.set(searchResult.slug, searchResult);
}

function lookupCached(slug) {
    return memo.get(slug) || null;
}

async function getDetailsAllAnime(slug) {
    if (!slug) return null;
    const cached = memo.get(slug);
    if (cached) {
        return {
            slug: cached.slug,
            title: cached.title,
            format: cached.format || null,
            year: cached.year || null,
            episodeCount: cached.episodeCount || null,
            synonyms: [],
            type: null
        };
    }

    let edge;
    try {
        const r = await axios.post(API_URL, { query: SHOW_QUERY, variables: { id: slug } }, {
            timeout: 10000,
            headers: {
                "Content-Type": "application/json",
                "Referer": REFERER,
                "User-Agent": UA
            }
        });
        edge = r.data?.data?.show;
    } catch (e) {
        return null;
    }
    if (!edge) return null;

    const epCount = (() => {
        const v = parseInt(String(edge.episodeCount || "").trim(), 10);
        return Number.isFinite(v) && v > 0 ? v : null;
    })();
    const year = (edge.airedStart && typeof edge.airedStart === "object" && Number.isFinite(edge.airedStart.year))
        ? edge.airedStart.year
        : null;
    const tStr = String(edge.type || "").toLowerCase();
    const format = tStr.includes("movie") ? "MOVIE"
        : tStr.includes("tv") ? "TV"
        : tStr.includes("ova") ? "OVA"
        : tStr.includes("special") ? "SPECIAL"
        : tStr.includes("ona") || tStr.includes("web") ? "ONA"
        : tStr.includes("music") ? "MUSIC"
        : null;

    return {
        slug,
        title: edge.englishName || edge.name || edge.nativeName || null,
        format, year, episodeCount: epCount,
        synonyms: [],
        type: null
    };
}

module.exports = { getDetailsAllAnime, recordSearchHit, lookupCached };
