const test = require("node:test");
const assert = require("node:assert/strict");
const { enrichDirectStream } = require("../lib/stream-formatter/enrich-direct");

const PROVIDER = { id: "gojo", displayName: "Gojo", displayHost: "animetsu.live", dub: "both" };
const CANONICAL = {
    anilist: "21", mal: "21", anidb: "69", kitsu: "12", imdb: "tt0388629",
    mainTitle: "ONE PIECE", englishTitle: "ONE PIECE", year: 1999, format: "TV",
    episodeCount: 1100, synonyms: []
};
const PROVIDER_STREAM = {
    url: "https://mega-cloud.top/proxy/oppai/pahe/abc123",
    server: "Gojo/pahe", quality: "1080p", dub: false,
    headers: { Referer: "https://animetsu.live/" },
    subtitles: [{ src: "https://x/eng.vtt", label: "English" }]
};
const MATCH = { score: 200, confidence: "HIGH", reasons: ["+200 anilist_id_exact (21)"], source: "match" };

test("enrichDirectStream gathers source + track + canonical + match", () => {
    const out = enrichDirectStream({
        provider: PROVIDER,
        providerStream: PROVIDER_STREAM,
        canonical: CANONICAL,
        episode: 1,
        season: 1,
        match: MATCH
    });
    assert.equal(out.source.providerId, "gojo");
    assert.equal(out.source.providerDisplay, "Gojo");
    assert.equal(out.source.providerHost, "animetsu.live");
    assert.equal(out.source.serverFamily, "Gojo");
    assert.equal(out.source.serverInstance, "pahe");
    assert.equal(out.source.cdnHost, "mega-cloud.top");
    assert.equal(out.source.container, "HLS");
    assert.equal(out.source.quality, "1080p");
    assert.equal(out.track.kind, "sub");
    assert.equal(out.track.audioLanguage, "JPN");
    assert.equal(out.track.subtitleTracks.length, 1);
    assert.equal(out.track.subtitleTracks[0].lang, "ENG");
    assert.equal(out.canonical.anilistId, "21");
    assert.equal(out.canonical.season, 1);
    assert.equal(out.canonical.episode, 1);
    assert.equal(out.match.confidence, "HIGH");
    assert.equal(out.match.score, 200);
});

test("enrichDirectStream marks dub when providerStream.dub=true", () => {
    const out = enrichDirectStream({
        provider: PROVIDER,
        providerStream: { ...PROVIDER_STREAM, dub: true },
        canonical: CANONICAL,
        episode: 1, season: 1, match: MATCH
    });
    assert.equal(out.track.kind, "dub");
    assert.equal(out.track.audioLanguage, "ENG");
});

test("enrichDirectStream handles server with no slash (single-token)", () => {
    const out = enrichDirectStream({
        provider: PROVIDER,
        providerStream: { ...PROVIDER_STREAM, server: "raw" },
        canonical: CANONICAL,
        episode: 1, season: 1, match: MATCH
    });
    assert.equal(out.source.serverFamily, "Gojo");
    assert.equal(out.source.serverInstance, "raw");
});
