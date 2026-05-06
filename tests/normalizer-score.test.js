const test = require("node:test");
const assert = require("node:assert/strict");

const { scoreCandidate, constants } = require("../lib/normalizer/score");

//===============
// Canonical fixtures matching the Wave 2 false-positive cases.
// These mirror the AniList realities for those titles so the gates fire on
// real-world signals, not on fabricated tests.
//===============
const CANONICAL = {
    naruto:        { mainTitle: "NARUTO",                     englishTitle: "Naruto",                     synonyms: [],                  format: "TV",    year: 2002, episodeCount: 220 },
    aot:           { mainTitle: "Shingeki no Kyojin",         englishTitle: "Attack on Titan",            synonyms: [],                  format: "TV",    year: 2013, episodeCount: 25  },
    demonSlayer:   { mainTitle: "Kimetsu no Yaiba",           englishTitle: "Demon Slayer: Kimetsu no Yaiba", synonyms: [],              format: "TV",    year: 2019, episodeCount: 26  },
    fmaBhood:      { mainTitle: "Fullmetal Alchemist: Brotherhood", englishTitle: "Fullmetal Alchemist: Brotherhood", synonyms: ["Hagane no Renkinjutsushi: FULLMETAL ALCHEMIST"], format: "TV", year: 2009, episodeCount: 64 },
    onePiece:      { mainTitle: "ONE PIECE",                  englishTitle: "ONE PIECE",                  synonyms: ["One Piece"],       format: "TV",    year: 1999, episodeCount: 1100 }
};

//===============
// Wave-2 false positive: Naruto picked naruto-kai (24 episodes, 2017).
// Both gates (year, episodeCount) should flag this.
//===============
test("REJECTS Naruto → naruto-kai (year + ep_count gates)", () => {
    const result = scoreCandidate({
        canonical: CANONICAL.naruto,
        candidate: { slug: "naruto-kai", title: "Naruto", format: "TV", year: 2017, episodeCount: 24 }
    });
    assert.ok(result.gateFailures.length > 0, "should fail at least one gate");
    assert.ok(result.gateFailures.some(r => r.startsWith("year")), `expected year gate failure, got ${JSON.stringify(result.gateFailures)}`);
    assert.ok(result.gateFailures.some(r => r.startsWith("episode_count")), `expected ep_count gate failure, got ${JSON.stringify(result.gateFailures)}`);
});

test("ACCEPTS Naruto → naruto (correct slug)", () => {
    const result = scoreCandidate({
        canonical: CANONICAL.naruto,
        candidate: { slug: "naruto", title: "Naruto", format: "TV", year: 2002, episodeCount: 220 }
    });
    assert.equal(result.gateFailures.length, 0, `unexpected gate failures: ${JSON.stringify(result.gateFailures)}`);
    assert.ok(result.score >= constants.HIGH_THRESHOLD, `score ${result.score} should clear HIGH_THRESHOLD ${constants.HIGH_THRESHOLD}`);
});

//===============
// Wave-2 false positive: AoT picked an OVA-dub (format gate)
//===============
test("REJECTS AoT → OVA-dub (format gate)", () => {
    const result = scoreCandidate({
        canonical: CANONICAL.aot,
        candidate: { slug: "shingeki-no-kyojin-ova-dub", title: "Attack on Titan", format: "OVA", year: 2013, episodeCount: 5, type: "dub" }
    });
    assert.ok(result.gateFailures.some(r => r.startsWith("format")), `expected format gate failure, got ${JSON.stringify(result.gateFailures)}`);
});

test("ACCEPTS AoT → main series", () => {
    const result = scoreCandidate({
        canonical: CANONICAL.aot,
        candidate: { slug: "shingeki-no-kyojin", title: "Attack on Titan", format: "TV", year: 2013, episodeCount: 25 }
    });
    assert.equal(result.gateFailures.length, 0, `unexpected gate failures: ${JSON.stringify(result.gateFailures)}`);
    assert.ok(result.score >= constants.HIGH_THRESHOLD);
});

//===============
// Wave-2 false positive: Demon Slayer matched a recap movie
//===============
test("REJECTS Demon Slayer → recap movie (format gate + recap_tag gate)", () => {
    const result = scoreCandidate({
        canonical: CANONICAL.demonSlayer,
        candidate: {
            slug: "kimetsu-no-yaiba-recap-movie",
            title: "Demon Slayer: Recap Movie",
            format: "MOVIE",
            formatHint: "RECAP",
            year: 2024,
            episodeCount: 1
        }
    });
    assert.ok(result.gateFailures.length > 0);
    // either the format gate (TV vs MOVIE), the recap_tag gate, or the ep_count gate must fire
    assert.ok(result.gateFailures.some(r => r.startsWith("format") || r.startsWith("recap_tag") || r.startsWith("episode_count")));
});

test("ACCEPTS Demon Slayer → main series", () => {
    const result = scoreCandidate({
        canonical: CANONICAL.demonSlayer,
        candidate: { slug: "kimetsu-no-yaiba", title: "Demon Slayer: Kimetsu no Yaiba", format: "TV", year: 2019, episodeCount: 26 }
    });
    assert.equal(result.gateFailures.length, 0);
    assert.ok(result.score >= constants.HIGH_THRESHOLD);
});

//===============
// Wave-2 false positive: FMA Brotherhood matched the 2003 series (year gate)
//===============
test("REJECTS FMA Brotherhood → 2003 series (year + ep_count gates)", () => {
    const result = scoreCandidate({
        canonical: CANONICAL.fmaBhood,
        candidate: { slug: "fullmetal-alchemist-dub", title: "Fullmetal Alchemist", format: "TV", year: 2003, episodeCount: 51, type: "dub" }
    });
    assert.ok(result.gateFailures.some(r => r.startsWith("year")), `expected year gate, got ${JSON.stringify(result.gateFailures)}`);
});

test("ACCEPTS FMA Brotherhood → correct slug", () => {
    const result = scoreCandidate({
        canonical: CANONICAL.fmaBhood,
        candidate: { slug: "fullmetal-alchemist-brotherhood-dub", title: "Fullmetal Alchemist: Brotherhood", format: "TV", year: 2009, episodeCount: 64, type: "dub" }
    });
    assert.equal(result.gateFailures.length, 0);
    assert.ok(result.score >= constants.HIGH_THRESHOLD);
});

//===============
// Wave-2 false positive: One Piece matched a Dr. Chopper spin-off
//===============
test("REJECTS One Piece → Dr. Chopper spin-off (title distance / ep_count)", () => {
    const result = scoreCandidate({
        canonical: CANONICAL.onePiece,
        candidate: {
            slug: "one-piece-dr-chopper-no-bouken-karte",
            title: "One Piece: Dr. Chopper's Adventure Checkup - The Last Records",
            format: "MOVIE",
            year: 2008,
            episodeCount: 1
        }
    });
    assert.ok(result.gateFailures.length > 0);
    // format gate (TV vs MOVIE) catches this cleanly
    assert.ok(result.gateFailures.some(r => r.startsWith("format") || r.startsWith("episode_count")));
});

test("ACCEPTS One Piece → main series", () => {
    const result = scoreCandidate({
        canonical: CANONICAL.onePiece,
        candidate: { slug: "one-piece", title: "One Piece", format: "TV", year: 1999, episodeCount: 1100 }
    });
    assert.equal(result.gateFailures.length, 0);
    assert.ok(result.score >= constants.HIGH_THRESHOLD);
});

//===============
// Edge: title-distance hard gate catches catastrophic drift
//===============
test("REJECTS catastrophic title drift (title_distance gate)", () => {
    const result = scoreCandidate({
        canonical: CANONICAL.naruto,
        candidate: { slug: "totally-different", title: "Spy x Family", format: "TV", year: 2022, episodeCount: 12 }
    });
    assert.ok(result.gateFailures.some(r => r.startsWith("title_distance") || r.startsWith("year")));
});

//===============
// Edge: dub preference matters but only as a soft bonus, not a gate
//===============
test("Dub preference adds bonus but does not gate", () => {
    const dubMatch = scoreCandidate({
        canonical: CANONICAL.naruto,
        candidate: { slug: "naruto-dub", title: "Naruto", format: "TV", year: 2002, episodeCount: 220, type: "dub" },
        opts: { preferDub: true }
    });
    const subMatch = scoreCandidate({
        canonical: CANONICAL.naruto,
        candidate: { slug: "naruto", title: "Naruto", format: "TV", year: 2002, episodeCount: 220, type: "sub" },
        opts: { preferDub: true }
    });
    assert.equal(dubMatch.gateFailures.length, 0);
    assert.equal(subMatch.gateFailures.length, 0);
    assert.ok(dubMatch.score > subMatch.score, "dub-preferring user should score the dub higher");
});

//===============
// Edge: sparse candidate metadata still passes when it doesn't contradict
//===============
test("Sparse candidate (no year/episodeCount) passes gates if title matches", () => {
    const result = scoreCandidate({
        canonical: CANONICAL.aot,
        candidate: { slug: "shingeki-no-kyojin", title: "Attack on Titan" }  // no format/year/ep
    });
    assert.equal(result.gateFailures.length, 0);
    // Falls into MEDIUM band — title alone scores ~100, no bonuses.
    assert.ok(result.score >= constants.MEDIUM_THRESHOLD - 30, `score ${result.score} below expected band`);
});
