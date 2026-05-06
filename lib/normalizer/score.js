//===============
// Multi-axis candidate scorer with hard gates.
//
// Inputs:
//   canonical   = CanonicalIdentity from lib/identity/resolver
//   candidate   = enriched provider hit { slug, title, format?, year?, episodeCount?, type?, synonyms? }
//   opts        = { preferDub?: boolean, searchRank?: number }
//
// Output:
//   { score: number, gateFailures: string[], reasons: string[], normalizedTitleScore: number }
//
// Decision is taken by lib/normalizer/match.js using these thresholds:
//   HIGH  ≥ 130     → use, persist
//   MED   110-129   → use, persist with shorter TTL, log
//   < 110           → drop
// Gate failures cause the candidate to be rejected outright, regardless of score.
//===============

const fuzz = require("fuzzball");
const { normalizeTitle } = require("./title");

// Hard-gate tunables.
const YEAR_GATE_MAX_DIFF = 2;
const YEAR_GATE_HARD_DIFF = 5;
const EP_COUNT_GATE_MIN_RATIO = 0.7;
const EP_COUNT_GATE_MAX_RATIO = 1.3;
const TITLE_DISTANCE_GATE_MAX = 0.4; // normalized Levenshtein / max(len)
// Soft-bonus tunables.
const EP_COUNT_TIGHT_DELTA = 2;
const EP_COUNT_LOOSE_DELTA = 5;

function levenshtein(a, b) {
    const m = a.length;
    const n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;
    const dp = Array.from({ length: n + 1 }, (_, i) => i);
    for (let i = 1; i <= m; i++) {
        let prev = dp[0];
        dp[0] = i;
        for (let j = 1; j <= n; j++) {
            const tmp = dp[j];
            dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
            prev = tmp;
        }
    }
    return dp[n];
}

function normalizedDistance(a, b) {
    const max = Math.max(a.length, b.length);
    if (max === 0) return 0;
    return levenshtein(a, b) / max;
}

//===============
// Title scoring against the full set of canonical title variants.
// Returns the best fuzz.ratio across mainTitle/englishTitle/synonyms.
//===============
function bestTitleRatio(candidateTitle, canonical) {
    const cand = normalizeTitle(candidateTitle);
    if (!cand) return { ratio: 0, normalizedDistance: 1, exact: false, matchedVariant: null };

    const variants = [];
    if (canonical.mainTitle) variants.push(canonical.mainTitle);
    if (canonical.englishTitle) variants.push(canonical.englishTitle);
    if (Array.isArray(canonical.synonyms)) variants.push(...canonical.synonyms);

    let best = { ratio: 0, normalizedDistance: 1, exact: false, matchedVariant: null };
    for (const v of variants) {
        const norm = normalizeTitle(v);
        if (!norm) continue;
        const exact = norm === cand;
        const ratio = exact ? 100 : fuzz.ratio(cand, norm);
        const nd = normalizedDistance(cand, norm);
        if (ratio > best.ratio) {
            best = { ratio, normalizedDistance: nd, exact, matchedVariant: v };
        }
    }
    return best;
}

//===============
// Hard gates — any failure rejects the candidate before scoring matters.
// Each gate returns null on pass, or a string reason on fail.
//===============
function formatGate(canonical, candidate) {
    const cf = String(canonical.format || "").toUpperCase();
    const xf = String(candidate.format || candidate.formatHint || "").toUpperCase();
    if (!cf || !xf) return null;
    if (cf === "TV" && xf !== "TV") return `format: canonical=TV candidate=${xf}`;
    if (cf === "MOVIE" && xf !== "MOVIE") return `format: canonical=MOVIE candidate=${xf}`;
    return null;
}

function yearGate(canonical, candidate) {
    if (!canonical.year || !candidate.year) return null;
    const diff = Math.abs(canonical.year - candidate.year);
    if (diff >= YEAR_GATE_HARD_DIFF) return `year: canonical=${canonical.year} candidate=${candidate.year} diff=${diff}`;
    return null;
}

function episodeCountGate(canonical, candidate) {
    const cf = String(canonical.format || "").toUpperCase();
    if (cf !== "TV") return null;
    if (!Number.isFinite(canonical.episodeCount) || canonical.episodeCount <= 0) return null;
    if (!Number.isFinite(candidate.episodeCount) || candidate.episodeCount <= 0) return null;
    const min = canonical.episodeCount * EP_COUNT_GATE_MIN_RATIO;
    const max = canonical.episodeCount * EP_COUNT_GATE_MAX_RATIO;
    if (candidate.episodeCount < min || candidate.episodeCount > max) {
        return `episode_count: canonical=${canonical.episodeCount} candidate=${candidate.episodeCount}`;
    }
    return null;
}

function titleDistanceGate(titleScore) {
    if (titleScore.normalizedDistance > TITLE_DISTANCE_GATE_MAX) {
        return `title_distance: nd=${titleScore.normalizedDistance.toFixed(2)} > ${TITLE_DISTANCE_GATE_MAX}`;
    }
    return null;
}

function recapTagGate(canonical, candidate) {
    const cf = String(canonical.format || "").toUpperCase();
    if (cf !== "TV") return null;
    const fh = String(candidate.formatHint || "").toUpperCase();
    if (fh === "RECAP" || fh === "MOVIE" || fh === "OVA" || fh === "SPECIAL") {
        return `recap_tag: candidate has ${fh} hint while canonical is TV`;
    }
    return null;
}

const GATES = [
    ["format", formatGate],
    ["year", yearGate],
    ["episode_count", episodeCountGate],
    ["recap_tag", recapTagGate]
];

//===============
// Main entry point.
//===============
function scoreCandidate({ canonical, candidate, opts = {} }) {
    const titleScore = bestTitleRatio(candidate.title, canonical);

    const gateFailures = [];
    const tdGate = titleDistanceGate(titleScore);
    if (tdGate) gateFailures.push(tdGate);
    for (const [, fn] of GATES) {
        const reason = fn(canonical, candidate);
        if (reason) gateFailures.push(reason);
    }

    if (gateFailures.length > 0) {
        return {
            score: 0,
            gateFailures,
            reasons: [],
            normalizedTitleScore: titleScore.ratio
        };
    }

    let score = titleScore.ratio;
    const reasons = [`title=${titleScore.ratio}/100${titleScore.exact ? " exact" : ""}${titleScore.matchedVariant ? ` v=${titleScore.matchedVariant}` : ""}`];

    if (titleScore.exact) {
        score += 25;
        reasons.push("+25 exact_title");
    } else if (Array.isArray(canonical.synonyms) && canonical.synonyms.some(s => normalizeTitle(s) === normalizeTitle(candidate.title))) {
        score += 20;
        reasons.push("+20 synonym_exact");
    }

    if (canonical.year && candidate.year) {
        const diff = Math.abs(canonical.year - candidate.year);
        if (diff === 0) {
            score += 15;
            reasons.push("+15 year_exact");
        } else if (diff <= 1) {
            score += 8;
            reasons.push("+8 year_close");
        } else if (diff > YEAR_GATE_MAX_DIFF) {
            score -= 15;
            reasons.push("-15 year_far");
        }
    }

    const cf = String(canonical.format || "").toUpperCase();
    const xf = String(candidate.format || candidate.formatHint || "").toUpperCase();
    if (cf && xf) {
        if (cf === xf) {
            score += 12;
            reasons.push("+12 format_match");
        }
    }

    if (Number.isFinite(canonical.episodeCount) && Number.isFinite(candidate.episodeCount)) {
        const diff = Math.abs(canonical.episodeCount - candidate.episodeCount);
        if (diff <= EP_COUNT_TIGHT_DELTA) {
            score += 10;
            reasons.push("+10 ep_count_tight");
        } else if (diff <= EP_COUNT_LOOSE_DELTA) {
            score += 5;
            reasons.push("+5 ep_count_loose");
        }
    }

    if (typeof opts.preferDub === "boolean" && candidate.type) {
        const t = String(candidate.type).toLowerCase();
        const candIsDub = t === "dub";
        const candIsSub = t === "sub";
        if ((opts.preferDub && candIsDub) || (!opts.preferDub && candIsSub)) {
            score += 8;
            reasons.push(`+8 dub_pref(${t})`);
        }
    }

    if (Number.isFinite(opts.searchRank) && opts.searchRank >= 0 && opts.searchRank < 3) {
        score += 3;
        reasons.push("+3 top3_rank");
    }

    return {
        score: Math.round(score),
        gateFailures: [],
        reasons,
        normalizedTitleScore: titleScore.ratio
    };
}

module.exports = {
    scoreCandidate,
    bestTitleRatio,
    constants: {
        YEAR_GATE_MAX_DIFF,
        YEAR_GATE_HARD_DIFF,
        EP_COUNT_GATE_MIN_RATIO,
        EP_COUNT_GATE_MAX_RATIO,
        TITLE_DISTANCE_GATE_MAX,
        HIGH_THRESHOLD: 130,
        MEDIUM_THRESHOLD: 110
    }
};
