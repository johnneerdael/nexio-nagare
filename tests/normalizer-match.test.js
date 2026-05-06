const test = require("node:test");
const assert = require("node:assert/strict");

const { selectBest } = require("../lib/normalizer/match");

const NARUTO = { mainTitle: "NARUTO", englishTitle: "Naruto", synonyms: [], format: "TV", year: 2002, episodeCount: 220 };

function detailsFor(map) {
    return async slug => map[slug] || null;
}

test("picks the correct slug when multiple share the title", async () => {
    const result = await selectBest({
        canonical: NARUTO,
        rawCandidates: [
            { slug: "naruto-kai", title: "Naruto" },
            { slug: "naruto", title: "Naruto" },
            { slug: "boruto-naruto-next-generations", title: "Boruto: Naruto Next Generations" }
        ],
        fetchDetails: detailsFor({
            "naruto-kai": { format: "TV", year: 2017, episodeCount: 24 },
            "naruto":     { format: "TV", year: 2002, episodeCount: 220 },
            "boruto-naruto-next-generations": { format: "TV", year: 2017, episodeCount: 293 }
        })
    });
    assert.ok(result.match, "expected a match");
    assert.equal(result.match.slug, "naruto");
    assert.equal(result.match.confidence, "HIGH");
});

test("returns null when ALL candidates fail gates (drop, no false positive)", async () => {
    const result = await selectBest({
        canonical: NARUTO,
        rawCandidates: [
            { slug: "naruto-kai", title: "Naruto" },
            { slug: "naruto-shippuden", title: "Naruto: Shippuden" }
        ],
        fetchDetails: detailsFor({
            "naruto-kai":      { format: "TV", year: 2017, episodeCount: 24 },
            "naruto-shippuden":{ format: "TV", year: 2007, episodeCount: 500 }  // year gate kicks: 5 yrs from 2002
        })
    });
    assert.equal(result.match, null);
    assert.equal(result.debug.reason, "all_gates_failed");
});

test("skips candidates whose details fail to load (no false positive on partial info)", async () => {
    const result = await selectBest({
        canonical: NARUTO,
        rawCandidates: [
            { slug: "naruto-tampered", title: "Naruto" },
            { slug: "naruto",          title: "Naruto" }
        ],
        fetchDetails: async slug => {
            if (slug === "naruto-tampered") throw new Error("simulated 500");
            return { format: "TV", year: 2002, episodeCount: 220 };
        }
    });
    assert.ok(result.match);
    assert.equal(result.match.slug, "naruto");
});

test("returns null when title pre-rank doesn't surface anything close", async () => {
    const result = await selectBest({
        canonical: NARUTO,
        rawCandidates: [
            { slug: "spy-x-family", title: "Spy x Family" },
            { slug: "frieren",      title: "Frieren: Beyond Journey's End" }
        ],
        fetchDetails: detailsFor({
            "spy-x-family": { format: "TV", year: 2022, episodeCount: 12 },
            "frieren":      { format: "TV", year: 2023, episodeCount: 28 }
        })
    });
    assert.equal(result.match, null);
});

test("dedupes raw candidates by slug", async () => {
    let detailsCalls = 0;
    const result = await selectBest({
        canonical: NARUTO,
        rawCandidates: [
            { slug: "naruto", title: "Naruto" },
            { slug: "naruto", title: "Naruto" },
            { slug: "naruto", title: "Naruto" }
        ],
        fetchDetails: async () => {
            detailsCalls++;
            return { format: "TV", year: 2002, episodeCount: 220 };
        }
    });
    assert.ok(result.match);
    assert.equal(detailsCalls, 1, "details should be fetched once for deduped slug");
});

test("returns the no_candidates debug when input list is empty", async () => {
    const result = await selectBest({ canonical: NARUTO, rawCandidates: [], fetchDetails: async () => null });
    assert.equal(result.match, null);
    assert.equal(result.debug.reason, "no_candidates");
});
