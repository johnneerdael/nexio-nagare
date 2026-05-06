//===============
// Per-provider dispatcher.
//
//   dispatchProviders({ canonical, providers, opts }) →
//     [{ providerId, displayName, slug, confidence, source, debug }]
//
// Source values: "override" | "cache" | "match" | null (when nothing found)
//
// Strategy per provider:
//   1. Check user/default overrides (data/overrides.json) — hand-mapped wins.
//   2. Check slug cache (anidbId × providerId × dubPref) — auto-invalidated
//      after stream-extraction failures.
//   3. Generate query candidates from canonical and run provider.search()
//      across them, merging results.
//   4. Hand off to lib/normalizer/match.selectBest() with a fetchDetails
//      shim that consults the detail cache before calling provider.details().
//   5. Persist HIGH/MEDIUM matches to the slug cache.
//
// All providers run in parallel. Each provider's success/failure is independent.
//===============

const fs = require("node:fs");
const path = require("node:path");
const { generateQueries } = require("./normalizer/query-generator");
const { selectBest } = require("./normalizer/match");
const { lookupSlug, recordSlug, markUsed, invalidateSlug } = require("./cache/slug-cache");
const { lookupDetails, recordDetails } = require("./cache/detail-cache");

let cachedOverrides = null;

function loadOverrides() {
    if (cachedOverrides !== null) return cachedOverrides;
    cachedOverrides = {};
    const candidates = [
        process.env.NEXIO_OVERRIDES_PATH,
        path.join(process.cwd(), "data", "overrides.user.json"),
        path.join(process.cwd(), "data", "overrides.json")
    ].filter(Boolean);
    for (const file of candidates) {
        try {
            if (!fs.existsSync(file)) continue;
            const data = JSON.parse(fs.readFileSync(file, "utf8"));
            // Later sources override earlier — so user overrides take precedence,
            // built-in defaults fill in. We iterate user file FIRST.
            for (const [key, providers] of Object.entries(data)) {
                if (key.startsWith("_")) continue;
                if (!providers || typeof providers !== "object") continue;
                if (!cachedOverrides[key]) cachedOverrides[key] = {};
                for (const [pid, slug] of Object.entries(providers)) {
                    if (cachedOverrides[key][pid] === undefined) cachedOverrides[key][pid] = slug;
                }
            }
        } catch (e) {
            console.error(`[overrides] failed to load ${file}: ${e.message}`);
        }
    }
    return cachedOverrides;
}

function reloadOverrides() {
    cachedOverrides = null;
}

//===============
// Override entries can be either:
//   { providerId: "<slug>" }                                      — slug only
//   { providerId: { slug: "<slug>", episodeOffset: <int> } }      — with offset
// `episodeOffset` is added to the requested episode number before calling
// provider.getStreams. Useful when AniList splits a series into season-IDs but
// the provider serves all episodes under one continuous slug (or vice versa).
// Negative offsets are allowed.
//===============
function lookupOverride(canonical, providerId) {
    if (!canonical) return null;
    const overrides = loadOverrides();
    for (const key of [`anilist:${canonical.anilist}`, `anidb:${canonical.anidb}`, `mal:${canonical.mal}`]) {
        if (key.endsWith(":null") || key.endsWith(":undefined")) continue;
        const entry = overrides[key];
        if (!entry) continue;
        const value = entry[providerId];
        if (typeof value === "string") return { slug: value, episodeOffset: 0 };
        if (value && typeof value === "object" && typeof value.slug === "string") {
            const offset = Number.isFinite(value.episodeOffset) ? Math.trunc(value.episodeOffset) : 0;
            return { slug: value.slug, episodeOffset: offset };
        }
    }
    return null;
}

function dubPrefOf(opts) {
    return opts && opts.preferDub ? "dub" : "sub";
}

async function searchAcrossQueries(provider, queries) {
    const seen = new Set();
    const merged = [];
    for (const q of queries) {
        let hits = [];
        try { hits = await provider.search(q); } catch (e) { hits = []; }
        if (!Array.isArray(hits)) continue;
        for (const h of hits) {
            if (!h || !h.slug || seen.has(h.slug)) continue;
            seen.add(h.slug);
            merged.push(h);
        }
        // Stop if we've already collected enough candidates to score.
        if (merged.length >= 12) break;
    }
    return merged;
}

function buildDetailFetcher(provider) {
    return async slug => {
        const cached = lookupDetails({ providerId: provider.id, slug });
        if (cached) return cached;
        const fresh = await provider.details(slug);
        if (fresh) recordDetails({ providerId: provider.id, slug, payload: fresh });
        return fresh;
    };
}

async function dispatchOne({ provider, canonical, opts }) {
    const dubPref = dubPrefOf(opts);

    // 1) Override has the highest authority — applies regardless of cache.
    const override = lookupOverride(canonical, provider.id);
    if (override) {
        return {
            providerId: provider.id,
            displayName: provider.displayName,
            slug: override.slug,
            episodeOffset: override.episodeOffset,
            confidence: "OVERRIDE",
            source: "override",
            debug: { reason: "override_hit", episodeOffset: override.episodeOffset }
        };
    }

    // 2) Slug cache check (only when we have an anidb anchor — most stable cross-provider id).
    if (canonical.anidb) {
        const cached = lookupSlug({ anidbId: canonical.anidb, providerId: provider.id, dubPref });
        if (cached) {
            markUsed({ anidbId: canonical.anidb, providerId: provider.id, dubPref, succeeded: false });
            return {
                providerId: provider.id,
                displayName: provider.displayName,
                slug: cached.slug,
                confidence: cached.confidence,
                source: "cache",
                debug: { reason: "cache_hit", cachedAt: cached.cached_at }
            };
        }
    }

    // 3) Live search + score + gate.
    const queries = generateQueries(canonical);
    if (queries.length === 0) {
        return { providerId: provider.id, displayName: provider.displayName, slug: null, confidence: null, source: null, debug: { reason: "no_queries" } };
    }

    const rawCandidates = await searchAcrossQueries(provider, queries);
    if (rawCandidates.length === 0) {
        return { providerId: provider.id, displayName: provider.displayName, slug: null, confidence: null, source: null, debug: { reason: "no_search_hits" } };
    }

    const matchResult = await selectBest({
        canonical,
        rawCandidates,
        fetchDetails: buildDetailFetcher(provider),
        opts: { preferDub: opts && opts.preferDub }
    });

    if (!matchResult.match) {
        if (process.env.DEBUG_MATCH === "1") {
            console.log(`[match] provider=${provider.id} canonical=anilist:${canonical.anilist} dropped reason=${matchResult.debug.reason} evaluated=${(matchResult.debug.evaluated || []).map(e => `${e.slug}(score=${e.score} gates=${e.gateFailures.join("|") || "ok"})`).join(", ")}`);
        }
        return { providerId: provider.id, displayName: provider.displayName, slug: null, confidence: null, source: null, debug: matchResult.debug };
    }

    // 4) Persist match to slug cache.
    if (canonical.anidb) {
        recordSlug({
            anidbId: canonical.anidb,
            providerId: provider.id,
            dubPref,
            slug: matchResult.match.slug,
            confidence: matchResult.match.confidence,
            score: matchResult.match.score
        });
    }

    if (process.env.DEBUG_MATCH === "1") {
        console.log(`[match] provider=${provider.id} canonical=anilist:${canonical.anilist} → ${matchResult.match.slug} confidence=${matchResult.match.confidence} score=${matchResult.match.score} reasons=${matchResult.match.reasons.join("|")}`);
    }

    return {
        providerId: provider.id,
        displayName: provider.displayName,
        slug: matchResult.match.slug,
        confidence: matchResult.match.confidence,
        source: "match",
        debug: { score: matchResult.match.score, reasons: matchResult.match.reasons }
    };
}

async function dispatchProviders({ canonical, providers, opts = {} }) {
    if (!canonical || !Array.isArray(providers) || providers.length === 0) return [];
    return Promise.all(providers.map(provider => dispatchOne({ provider, canonical, opts })));
}

//===============
// Auto-invalidate hook: callers invoke this when getStreams() returns empty
// for a slug we got from cache or match. Ensures stale slugs don't poison
// future requests.
//===============
function invalidateCachedSlug({ canonical, providerId, opts = {} }) {
    if (!canonical || !canonical.anidb) return;
    invalidateSlug({ anidbId: canonical.anidb, providerId, dubPref: dubPrefOf(opts) });
}

function markSlugSucceeded({ canonical, providerId, opts = {} }) {
    if (!canonical || !canonical.anidb) return;
    markUsed({
        anidbId: canonical.anidb,
        providerId,
        dubPref: dubPrefOf(opts),
        succeeded: true
    });
}

module.exports = {
    dispatchProviders,
    invalidateCachedSlug,
    loadOverrides,
    lookupOverride,
    markSlugSucceeded,
    reloadOverrides
};
