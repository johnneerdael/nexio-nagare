const test = require("node:test");
const assert = require("node:assert/strict");

const { buildProviderStreams, languageCode, mapSubtitle } = require("../lib/stream-builder");

const PROVIDER = { id: "animenosub", displayName: "Animenosub", displayHost: "animenosub.to" };
const CANONICAL = { anilist: "21", mainTitle: "ONE PIECE", englishTitle: "ONE PIECE", year: 1999, format: "TV", episodeCount: 1100 };
const MATCH = { score: 100, confidence: "HIGH", reasons: ["match"], source: "match" };

test("languageCode maps common labels to ISO 639-2 codes", () => {
    assert.equal(languageCode("English"), "eng");
    assert.equal(languageCode("Japanese"), "jpn");
    assert.equal(languageCode("Spanish"), "spa");
    assert.equal(languageCode("French"), "fre");
    assert.equal(languageCode("ja"), "jpn");
    assert.equal(languageCode("en-US"), "eng");
    assert.equal(languageCode(""), "und");
    assert.equal(languageCode(null), "und");
});

test("mapSubtitle returns Stremio subtitle shape with direct URL when proxy is off", () => {
    const out = mapSubtitle({ src: "https://cdn.example.com/track.vtt", label: "English" }, "http://h");
    assert.equal(out.lang, "eng");
    assert.equal(out.url, "https://cdn.example.com/track.vtt");
    assert.match(out.id, /^eng-/);
});

test("mapSubtitle wraps the URL in /sub when proxy:true", () => {
    const out = mapSubtitle({
        src: "https://cdn.example.com/track.vtt",
        label: "English",
        proxy: true,
        headers: { Referer: "https://host.com/" }
    }, "http://127.0.0.1:7002");
    assert.match(out.url, /^http:\/\/127\.0\.0\.1:7002\/sub\/[\w-]+\.vtt$/);
});

test("buildProviderStreams attaches the subtitles array to the Stremio stream", () => {
    const out = buildProviderStreams({
        providerStreams: [{
            url: "https://cdn.example.com/master.m3u8",
            server: "MegaPlay",
            quality: "auto",
            headers: { Referer: "https://x.com/" },
            subtitles: [
                { src: "https://cdn.example.com/en.vtt", label: "English" },
                { src: "https://cdn.example.com/jp.vtt", label: "Japanese" }
            ]
        }],
        provider: PROVIDER, canonical: CANONICAL, episode: 1, season: 1, match: MATCH,
        baseUrl: "http://127.0.0.1:7002"
    });
    assert.equal(out.length, 1);
    assert.equal(out[0].subtitles.length, 2);
    assert.equal(out[0].subtitles[0].lang, "eng");
    assert.equal(out[0].subtitles[1].lang, "jpn");
});

test("buildProviderStreams omits subtitles array when none provided", () => {
    const out = buildProviderStreams({
        providerStreams: [{ url: "https://x.com/x.m3u8", server: "X" }],
        provider: PROVIDER, canonical: CANONICAL, episode: 1, season: 1, match: MATCH,
        baseUrl: "http://h"
    });
    assert.equal(out.length, 1);
    assert.equal(out[0].subtitles, undefined);
});
