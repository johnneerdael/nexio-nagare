//===============
// Provider registry.
// `getActiveProviders(userConfig)` returns the providers the user has enabled,
// or all registered providers if no preference was set.
// `findBestMatch(results, query)` runs fuzzy title matching over a search
// result list and returns the best candidate (or null).
//===============

const fuzz = require("fuzzball");

const onetwothreeanime = require("./onetwothreeanime");
const anizone = require("./anizone");
const animenosub = require("./animenosub");
const animepahe = require("./animepahe");
const gojo = require("./gojo");
// AllAnime: search() works fine, but episode lookups now return NEED_CAPTCHA
// and the persisted-query hash fallback also returns PersistedQueryNotFound.
// See animdl issue #321 (Feb 2026): "allanime provider is dead and should be
// removed". Code preserved at lib/providers/allanime/ for revival when /if a
// workable bypass lands. The AniList-ID-exact-match shortcut already added to
// lib/normalizer/match.js is independent and stays.
// const allanime = require("./allanime");

const REGISTRY = [onetwothreeanime, anizone, animenosub, animepahe, gojo];
const REGISTRY_BY_ID = new Map(REGISTRY.map(p => [p.id, p]));

function getActiveProviders(userConfig = {}) {
    const requested = Array.isArray(userConfig.providers) ? userConfig.providers : null;
    if (!requested || requested.length === 0) return REGISTRY.slice();
    const active = [];
    for (const id of requested) {
        const provider = REGISTRY_BY_ID.get(id);
        if (provider) active.push(provider);
    }
    return active.length > 0 ? active : REGISTRY.slice();
}

function normalizeForMatch(s) {
    return String(s || "")
        .toLowerCase()
        .replace(/\(dub\)|\(sub\)/g, "")
        .replace(/[‐-―‘-‟′-‷]/g, "'")
        .replace(/\s+/g, " ")
        .trim();
}

function findBestMatch(results, query) {
    if (!Array.isArray(results) || results.length === 0 || !query) return null;
    const nq = normalizeForMatch(query);
    let best = null;
    let bestScore = 0;
    for (const r of results) {
        const nt = normalizeForMatch(r.title || "");
        // fuzz.ratio is length-sensitive (Levenshtein-based), which is what we
        // want — a longer title with extra words should NOT tie an exact match.
        const ratio = fuzz.ratio(nq, nt);
        const partial = fuzz.partial_ratio(nq, nt);
        // Hybrid: ratio dominates, partial breaks ties when query is a prefix.
        const score = ratio + partial * 0.1;
        if (score > bestScore) {
            bestScore = score;
            best = r;
        }
    }
    return bestScore >= 70 ? best : null;
}

module.exports = {
    REGISTRY,
    REGISTRY_BY_ID,
    getActiveProviders,
    findBestMatch
};
