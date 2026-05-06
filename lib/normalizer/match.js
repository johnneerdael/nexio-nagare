//===============
// Match orchestrator.
//
//   selectBest({ canonical, rawCandidates, fetchDetails, opts })
//
//   - rawCandidates: provider search hits with at least { slug, title }
//   - fetchDetails:  async (slug) → { format?, year?, episodeCount?, synonyms?, type?, formatHint? }
//                    Injected so this module can be unit-tested without HTTP.
//
// Strategy:
//   1. Pre-rank by simple title fuzz against canonical to pick top-N candidates.
//   2. Fetch details for those top-N in parallel.
//   3. Apply hard gates + score on the enriched candidates.
//   4. Return best surviving candidate IF score >= MEDIUM_THRESHOLD; else null.
//
// Detail-fetch failures cause that candidate to be skipped entirely — we never
// score-and-accept a candidate whose details we couldn't verify. That's the
// no-false-positive guarantee.
//===============

const { scoreCandidate, constants: scoreConstants } = require("./score");
const { bestTitleRatio } = require("./score");

const DEFAULT_TOP_N = 3;

function uniqueBySlug(candidates) {
    const seen = new Set();
    const out = [];
    for (const c of candidates) {
        if (!c || !c.slug) continue;
        if (seen.has(c.slug)) continue;
        seen.add(c.slug);
        out.push(c);
    }
    return out;
}

async function selectBest({ canonical, rawCandidates, fetchDetails, opts = {} }) {
    if (!canonical || !Array.isArray(rawCandidates) || rawCandidates.length === 0) {
        return { match: null, debug: { reason: "no_candidates" } };
    }

    const topN = Number.isFinite(opts.topN) ? Math.max(1, opts.topN) : DEFAULT_TOP_N;
    const dedup = uniqueBySlug(rawCandidates);

    // Pre-rank to pick the top-N candidates worth a detail fetch.
    const preRanked = dedup
        .map((c, i) => ({
            candidate: c,
            preTitle: bestTitleRatio(c.title, canonical),
            searchRank: i
        }))
        .sort((a, b) => b.preTitle.ratio - a.preTitle.ratio)
        .slice(0, topN);

    // Detail-fetch in parallel; failures degrade to "skipped".
    const enriched = await Promise.all(preRanked.map(async entry => {
        try {
            const details = typeof fetchDetails === "function" ? await fetchDetails(entry.candidate.slug) : null;
            return { ...entry, details };
        } catch (e) {
            return { ...entry, details: null, detailsError: e.message };
        }
    }));

    const evaluated = [];
    for (const entry of enriched) {
        if (!entry.details) {
            evaluated.push({
                slug: entry.candidate.slug,
                title: entry.candidate.title,
                score: 0,
                gateFailures: ["details_unavailable"],
                reasons: [],
                preRank: entry.searchRank
            });
            continue;
        }
        const merged = { ...entry.candidate, ...entry.details };
        const result = scoreCandidate({
            canonical,
            candidate: merged,
            opts: { preferDub: opts.preferDub, searchRank: entry.searchRank }
        });
        evaluated.push({
            slug: entry.candidate.slug,
            title: entry.candidate.title,
            merged,
            score: result.score,
            gateFailures: result.gateFailures,
            reasons: result.reasons,
            preRank: entry.searchRank
        });
    }

    const surviving = evaluated.filter(e => e.gateFailures.length === 0);
    if (surviving.length === 0) {
        return { match: null, debug: { reason: "all_gates_failed", evaluated } };
    }

    surviving.sort((a, b) => b.score - a.score);
    const winner = surviving[0];

    let confidence;
    if (winner.score >= scoreConstants.HIGH_THRESHOLD) confidence = "HIGH";
    else if (winner.score >= scoreConstants.MEDIUM_THRESHOLD) confidence = "MEDIUM";
    else {
        return { match: null, debug: { reason: "below_threshold", evaluated, winner } };
    }

    return {
        match: {
            slug: winner.slug,
            title: winner.title,
            score: winner.score,
            confidence,
            reasons: winner.reasons,
            details: winner.merged
        },
        debug: { evaluated }
    };
}

module.exports = { selectBest };
