const test = require("node:test");
const assert = require("node:assert/strict");

const { buildProviderStreams } = require("../lib/stream-builder");

const PROVIDER = { id: "onetwothreeanime", displayName: "123anime", displayHost: "123anime.la", dub: "both" };
const CANONICAL = {
    anilist: "21", mal: "21", anidb: "69", kitsu: "12", imdb: "tt0388629",
    mainTitle: "ONE PIECE", englishTitle: "ONE PIECE", year: 1999, format: "TV",
    episodeCount: 1100
};
const MATCH = { score: 200, confidence: "HIGH", reasons: ["+200 anilist_id_exact"], source: "match" };

test("buildProviderStreams emits a Nexio-friendly stream object with proxyHeaders", () => {
    const streams = buildProviderStreams({
        providerStreams: [{
            url: "https://cdn.example.com/master.m3u8",
            server: "vidstreaming",
            quality: "1080p",
            dub: false,
            headers: { Referer: "https://example.com/", Origin: "https://example.com" }
        }],
        provider: PROVIDER, canonical: CANONICAL, episode: 1, season: 1, match: MATCH
    });

    assert.equal(streams.length, 1);
    const s = streams[0];
    assert.equal(s.url, "https://cdn.example.com/master.m3u8");
    assert.equal(s.behaviorHints.notWebReady, true);
    assert.deepEqual(s.behaviorHints.proxyHeaders.request, {
        Referer: "https://example.com/",
        Origin: "https://example.com"
    });
    assert.match(s.name, /^1080p · HLS/);
    assert.match(s.name, /🌊 123anime · vidstreaming · 📝 SUB/);
    assert.match(s.description, /📄 \[123anime\] ONE PIECE - S1E1 \[1080p HLS\]\.m3u8/);
    assert.match(s.description, /🎯 HIGH \(200\)/);
    assert.match(s.behaviorHints.bingeGroup, /^nexio_nagare_onetwothreeanime_/);
});

test("buildProviderStreams omits proxyHeaders when no headers provided", () => {
    const streams = buildProviderStreams({
        providerStreams: [{
            url: "https://cdn.example.com/master.m3u8",
            server: "raw",
            quality: "auto",
            dub: true
        }],
        provider: { id: "anizone", displayName: "Anizone", displayHost: "anizone.to" },
        canonical: { anilist: "20", mainTitle: "Naruto", englishTitle: "Naruto" },
        episode: 12, season: 1, match: MATCH
    });

    assert.equal(streams.length, 1);
    assert.equal(streams[0].behaviorHints.proxyHeaders, undefined);
    assert.match(streams[0].name, /🎙 DUB/);
});

test("buildProviderStreams skips entries without a url", () => {
    const streams = buildProviderStreams({
        providerStreams: [
            { url: "", server: "broken" },
            { url: "https://ok.example.com/x.m3u8", server: "ok" }
        ],
        provider: PROVIDER, canonical: CANONICAL, episode: 1, season: 1, match: MATCH
    });
    assert.equal(streams.length, 1);
    assert.equal(streams[0].url, "https://ok.example.com/x.m3u8");
});

test("buildProviderStreams returns empty array on empty input", () => {
    assert.deepEqual(buildProviderStreams({ providerStreams: [], provider: PROVIDER, canonical: CANONICAL, episode: 1, season: 1, match: MATCH }), []);
    assert.deepEqual(buildProviderStreams({ providerStreams: null, provider: PROVIDER, canonical: CANONICAL, episode: 1, season: 1, match: MATCH }), []);
});

test("buildProviderStreams returns empty array when provider missing", () => {
    assert.deepEqual(buildProviderStreams({ providerStreams: [{ url: "x" }], provider: null, canonical: CANONICAL, episode: 1, season: 1, match: MATCH }), []);
});
