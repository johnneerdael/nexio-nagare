const test = require("node:test");
const assert = require("node:assert/strict");

const { buildProviderStreams } = require("../lib/stream-builder");

test("buildProviderStreams emits a stream object with proxyHeaders when headers given", () => {
    const streams = buildProviderStreams({
        providerStreams: [{
            url: "https://cdn.example.com/master.m3u8",
            server: "vidstreaming",
            quality: "1080p",
            dub: false,
            headers: { Referer: "https://example.com/", Origin: "https://example.com" }
        }],
        providerDisplayName: "123anime",
        animeTitle: "One Piece",
        episode: 1
    });

    assert.equal(streams.length, 1);
    const s = streams[0];
    assert.equal(s.url, "https://cdn.example.com/master.m3u8");
    assert.equal(s.behaviorHints.notWebReady, true);
    assert.deepEqual(s.behaviorHints.proxyHeaders.request, {
        Referer: "https://example.com/",
        Origin: "https://example.com"
    });
    assert.match(s.name, /NEXIO NAGARE/);
    assert.match(s.name, /123anime/);
    assert.match(s.name, /SUB/);
    assert.match(s.description, /One Piece/);
    assert.match(s.description, /EP 1/);
    assert.match(s.behaviorHints.bingeGroup, /^nexio_nagare_123anime_/);
});

test("buildProviderStreams omits proxyHeaders when no headers provided", () => {
    const streams = buildProviderStreams({
        providerStreams: [{
            url: "https://cdn.example.com/master.m3u8",
            server: "raw",
            quality: "auto",
            dub: true
        }],
        providerDisplayName: "Anizone",
        animeTitle: "Naruto",
        episode: 12
    });

    assert.equal(streams.length, 1);
    assert.equal(streams[0].behaviorHints.proxyHeaders, undefined);
    assert.match(streams[0].name, /DUB/);
});

test("buildProviderStreams skips entries without a url", () => {
    const streams = buildProviderStreams({
        providerStreams: [
            { url: "", server: "broken" },
            { url: "https://ok.example.com/x.m3u8", server: "ok" }
        ],
        providerDisplayName: "X",
        animeTitle: "Y",
        episode: 1
    });
    assert.equal(streams.length, 1);
    assert.equal(streams[0].url, "https://ok.example.com/x.m3u8");
});

test("buildProviderStreams returns empty array on empty input", () => {
    assert.deepEqual(buildProviderStreams({ providerStreams: [], providerDisplayName: "X", animeTitle: "Y", episode: 1 }), []);
    assert.deepEqual(buildProviderStreams({ providerStreams: null, providerDisplayName: "X", animeTitle: "Y", episode: 1 }), []);
});
