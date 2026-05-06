const test = require("node:test");
const assert = require("node:assert/strict");

const { generateQueries } = require("../lib/normalizer/query-generator");

test("generateQueries puts english/main first, then synonyms", () => {
    const q = generateQueries({
        englishTitle: "Demon Slayer: Kimetsu no Yaiba",
        mainTitle: "Kimetsu no Yaiba",
        synonyms: ["KnY"]
    });
    // Most-likely first.
    assert.equal(q[0], "Demon Slayer: Kimetsu no Yaiba");
    // Pre/post colon variants of english.
    assert.ok(q.includes("Demon Slayer"));
    assert.ok(q.includes("Kimetsu no Yaiba"));
});

test("generateQueries deduplicates by normalized form", () => {
    const q = generateQueries({
        englishTitle: "ONE PIECE",
        mainTitle: "One Piece",
        synonyms: ["onepiece", "One  Piece"]
    });
    // "ONE PIECE" / "One Piece" / "onepiece" all normalize identically.
    const normalized = q.map(s => s.replace(/\s+/g, "").toLowerCase());
    const unique = new Set(normalized);
    assert.equal(normalized.length, unique.size);
});

test("generateQueries handles missing synonyms gracefully", () => {
    const q = generateQueries({ englishTitle: "Frieren", mainTitle: "Frieren" });
    assert.deepEqual(q, ["Frieren"]);
});

test("generateQueries strips dub/sub qualifiers", () => {
    const q = generateQueries({ englishTitle: "Naruto (Dub)", mainTitle: "Naruto" });
    assert.deepEqual(q, ["Naruto"]);
});

test("generateQueries returns empty list for empty canonical", () => {
    assert.deepEqual(generateQueries(null), []);
    assert.deepEqual(generateQueries({}), []);
});

test("generateQueries caps at 8 results", () => {
    const q = generateQueries({
        englishTitle: "T",
        mainTitle: "U",
        synonyms: ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"]
    });
    assert.ok(q.length <= 8);
});
