const test = require("node:test");
const assert = require("node:assert/strict");

const {
    detectDub,
    detectFormatHint,
    extractEpisode,
    extractSeason,
    extractYear,
    parseTitle,
    stripQualifiers
} = require("../lib/normalizer/parse");

test("extractYear pulls four-digit anime years", () => {
    assert.equal(extractYear("Cowboy Bebop (1998)"), 1998);
    assert.equal(extractYear("Frieren · 2023"), 2023);
    assert.equal(extractYear("Naruto"), null);
    assert.equal(extractYear("8K version"), null); // Don't confuse with year
});

test("extractSeason handles ordinal forms, 'Season N', and SxxExx", () => {
    assert.equal(extractSeason("Attack on Titan 4th Season"), 4);
    assert.equal(extractSeason("Demon Slayer Season 2"), 2);
    assert.equal(extractSeason("Bleach S2E10"), 2);
    assert.equal(extractSeason("Second Season"), 2);
    assert.equal(extractSeason("Naruto"), null);
});

test("extractEpisode handles dash-number form", () => {
    assert.equal(extractEpisode("[SubsPlease] Anime - 12 [1080p]"), 12);
    assert.equal(extractEpisode("Naruto S1E47"), 47);
    assert.equal(extractEpisode("Anime Episode 5"), 5);
});

test("detectDub recognises (Dub)/(Sub) tags", () => {
    assert.equal(detectDub("Naruto (Dub)"), true);
    assert.equal(detectDub("Naruto (Sub)"), false);
    assert.equal(detectDub("Naruto"), null);
});

test("detectFormatHint flags Movie / OVA / Special / Recap", () => {
    assert.equal(detectFormatHint("Demon Slayer Recap Movie"), "MOVIE");
    assert.equal(detectFormatHint("Naruto OVA"), "OVA");
    assert.equal(detectFormatHint("Frieren Special"), "SPECIAL");
    assert.equal(detectFormatHint("Compilation Movie"), "MOVIE");
    assert.equal(detectFormatHint("Attack on Titan: Final Season"), null);
});

test("stripQualifiers removes (Dub)/(Sub) suffixes", () => {
    assert.equal(stripQualifiers("Naruto (Dub)"), "Naruto");
    assert.equal(stripQualifiers("Naruto (Sub)"), "Naruto");
    assert.equal(stripQualifiers("One Piece"), "One Piece");
});

test("parseTitle returns a structured blob", () => {
    const parsed = parseTitle("Attack on Titan: Final Season Part 2 (Dub)");
    assert.equal(parsed.season, 2);
    assert.equal(parsed.dub, true);
    assert.equal(parsed.base, "Attack on Titan: Final Season Part 2");
});
