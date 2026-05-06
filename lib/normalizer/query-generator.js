//===============
// Build an ordered list of search-query strings from a CanonicalIdentity.
// Providers index anime under various title forms (english, romaji, native,
// synonyms, pre-colon prefix). We try the most-likely first and stop after the
// first query that yields a confident match.
//===============

const { normalizeTitle } = require("./title");
const { stripQualifiers } = require("./parse");

const MAX_QUERIES = 8;

function addUnique(list, value) {
    const cleaned = stripQualifiers(String(value || "")).trim();
    if (!cleaned || cleaned.length < 2) return;
    if (/^\d+$/.test(cleaned)) return;
    const key = normalizeTitle(cleaned);
    if (!key) return;
    if (list.some(item => normalizeTitle(item) === key)) return;
    list.push(cleaned);
}

function splitOnColon(value) {
    const out = [];
    const t = String(value || "").trim();
    const idx = t.indexOf(":");
    if (idx > 3 && idx < t.length - 1) {
        out.push(t.slice(0, idx).trim());
        out.push(t.slice(idx + 1).trim());
    }
    return out;
}

function generateQueries(canonical) {
    if (!canonical) return [];
    const list = [];

    // Highest priority: english, then main/romaji, then synonyms.
    const primary = [canonical.englishTitle, canonical.mainTitle].filter(Boolean);
    for (const t of primary) addUnique(list, t);

    // Pre/post colon variants of english + main.
    for (const t of primary) {
        for (const piece of splitOnColon(t)) addUnique(list, piece);
    }

    // Synonyms last — usually noisier but occasionally the only hit.
    if (Array.isArray(canonical.synonyms)) {
        for (const syn of canonical.synonyms) addUnique(list, syn);
    }

    return list.slice(0, MAX_QUERIES);
}

module.exports = { generateQueries };
