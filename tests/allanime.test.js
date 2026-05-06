const test = require("node:test");
const assert = require("node:assert/strict");

const { decodeProviderId, DECODER_MAP } = require("../lib/providers/allanime/hex-decoder");
const { findExactIdMatch, selectBest } = require("../lib/normalizer/match");

test("DECODER_MAP covers ASCII printable + URL chars without overlap", () => {
    const values = Object.values(DECODER_MAP);
    assert.equal(new Set(values).size, values.length, "expected unique value mappings");
    assert.ok(values.includes("/"), "must encode slash");
    assert.ok(values.includes("?"), "must encode question");
});

test("decodeProviderId handles the leading -- prefix and clock substitution", () => {
    // build encoded form for "/clock?id=5" using inverse map
    const inverse = Object.fromEntries(Object.entries(DECODER_MAP).map(([k, v]) => [v, k]));
    const target = "/clock?id=5";
    const encoded = "--" + Array.from(target).map(c => inverse[c] || "00").join("");
    const decoded = decodeProviderId(encoded);
    assert.equal(decoded, "/clock.json?id=5", "clock should be expanded to clock.json");
});

test("decodeProviderId is a no-op on chunks not in the map", () => {
    // "ffff" isn't in the table; should pass through verbatim
    const decoded = decodeProviderId("ffff");
    assert.equal(decoded, "ffff");
});

test("findExactIdMatch returns the candidate whose extId.anilist matches", () => {
    const canon = { anilist: "21", mal: "21" };
    const c = findExactIdMatch(canon, [
        { slug: "wrong", title: "X", extId: { anilist: "1", mal: "999" } },
        { slug: "right", title: "Y", extId: { anilist: "21", mal: "21" } }
    ]);
    assert.ok(c);
    assert.equal(c.slug, "right");
});

test("findExactIdMatch falls back to MAL when AniList id is missing", () => {
    const canon = { anilist: null, mal: "555" };
    const c = findExactIdMatch(canon, [
        { slug: "x", title: "X", extId: { anilist: null, mal: "555" } }
    ]);
    assert.ok(c);
});

test("findExactIdMatch returns null when nothing matches", () => {
    assert.equal(findExactIdMatch({ anilist: "1" }, [{ slug: "x", extId: { anilist: "999" } }]), null);
    assert.equal(findExactIdMatch({ anilist: "1" }, [{ slug: "x" }]), null);
});

test("selectBest takes the ID-exact path without calling fetchDetails", async () => {
    let detailsCalls = 0;
    const result = await selectBest({
        canonical: { anilist: "21", mainTitle: "ONE PIECE", englishTitle: "ONE PIECE", synonyms: [], format: "TV", year: 1999, episodeCount: 1100 },
        rawCandidates: [
            { slug: "wrong", title: "Other", extId: { anilist: "999" } },
            { slug: "_right", title: "ONE PIECE", extId: { anilist: "21" } }
        ],
        fetchDetails: async () => { detailsCalls++; return null; }
    });
    assert.ok(result.match);
    assert.equal(result.match.slug, "_right");
    assert.equal(result.match.confidence, "HIGH");
    assert.equal(result.match.score, 200);
    assert.equal(detailsCalls, 0, "details should NOT be fetched when ID exact-matches");
    assert.equal(result.debug.reason, "id_exact_match");
});

test("selectBest still uses gate+score path when no candidate has matching extId", async () => {
    const result = await selectBest({
        canonical: { anilist: "21", mainTitle: "X", englishTitle: "X", synonyms: [], format: "TV", year: 2020, episodeCount: 12 },
        rawCandidates: [{ slug: "a", title: "X", extId: { anilist: "999" } }],
        fetchDetails: async () => ({ format: "TV", year: 2020, episodeCount: 12 })
    });
    assert.ok(result.match);
    assert.equal(result.match.slug, "a");
});
