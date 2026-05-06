const test = require("node:test");
const assert = require("node:assert/strict");

const { extractSlug } = require("../lib/providers/anizone/search");
const {
    normaliseFormat,
    parseEpisodeCount,
    parseYear,
    getDetailsAnizone
} = require("../lib/providers/anizone/details");
const { getStreamsAnizone } = require("../lib/providers/anizone/stream");

//===============
// Pure helpers
//===============
test("extractSlug pulls the alphanumeric slug from /anime/<slug>", () => {
    assert.equal(extractSlug("https://anizone.to/anime/spjuxray"), "spjuxray");
    assert.equal(extractSlug("https://anizone.to/anime/spjuxray/1"), "spjuxray");
    assert.equal(extractSlug("https://anizone.to/anime/abc_def-123"), "abc_def-123");
    assert.equal(extractSlug("nonsense"), null);
    assert.equal(extractSlug(""), null);
    assert.equal(extractSlug(null), null);
});

test("normaliseFormat maps the row label to canonical format", () => {
    assert.equal(normaliseFormat("TV Series"), "TV");
    assert.equal(normaliseFormat("Movie"), "MOVIE");
    assert.equal(normaliseFormat("OVA"), "OVA");
    assert.equal(normaliseFormat("Special"), "SPECIAL");
    assert.equal(normaliseFormat(""), null);
    assert.equal(normaliseFormat(null), null);
});

test("parseEpisodeCount picks the integer from '<N> Episodes' label", () => {
    assert.equal(parseEpisodeCount("293 Episodes"), 293);
    assert.equal(parseEpisodeCount("1 Episode"), 1);
    assert.equal(parseEpisodeCount("nothing here"), null);
});

test("parseYear picks a four-digit anime year", () => {
    assert.equal(parseYear("2017"), 2017);
    assert.equal(parseYear("2002 (Spring)"), 2002);
    assert.equal(parseYear(""), null);
});

//===============
// Network-stubbed details + stream
//===============
function withStubbedAxios(stub, fn) {
    const ax = require.cache[require.resolve("axios")].exports;
    const origGet = ax.get;
    ax.get = stub;
    return Promise.resolve(fn()).finally(() => { ax.get = origGet; });
}

test("getDetailsAnizone parses format/episodeCount/year from row spans", async () => {
    const html = `
        <html><body>
            <h1>Test Anime</h1>
            <span class="inline-block">TV Series</span>
            <span class="inline-block">Completed</span>
            <span class="inline-block">26 Episodes</span>
            <span class="inline-block">2019</span>
        </body></html>`;
    await withStubbedAxios(async () => ({ data: html }), async () => {
        const out = await getDetailsAnizone("knw0pvgz");
        assert.equal(out.title, "Test Anime");
        assert.equal(out.format, "TV");
        assert.equal(out.episodeCount, 26);
        assert.equal(out.year, 2019);
    });
});

test("getDetailsAnizone returns null on network error", async () => {
    await withStubbedAxios(async () => { throw new Error("nope"); }, async () => {
        const out = await getDetailsAnizone("xyz");
        assert.equal(out, null);
    });
});

test("getStreamsAnizone extracts m3u8 + subtitles from <media-player>", async () => {
    const html = `
        <html><body>
            <span class="truncate">Source A</span>
            <media-player src="https://cdn.example.com/master.m3u8">
                <track label="English" src="https://cdn.example.com/en.vtt"/>
                <track label="Spanish" src="https://cdn.example.com/es.vtt"/>
            </media-player>
        </body></html>`;
    await withStubbedAxios(async () => ({ data: html }), async () => {
        const out = await getStreamsAnizone("abc", 1);
        assert.equal(out.length, 1);
        assert.equal(out[0].url, "https://cdn.example.com/master.m3u8");
        assert.equal(out[0].server, "Source A");
        assert.equal(out[0].headers.Referer, "https://anizone.to/");
        assert.equal(out[0].subtitles.length, 2);
        assert.equal(out[0].subtitles[0].label, "English");
    });
});

test("getStreamsAnizone returns [] when media-player is missing", async () => {
    await withStubbedAxios(async () => ({ data: "<html><body>nothing</body></html>" }), async () => {
        const out = await getStreamsAnizone("abc", 1);
        assert.deepEqual(out, []);
    });
});

test("getStreamsAnizone rejects non-positive episode numbers", async () => {
    assert.deepEqual(await getStreamsAnizone("abc", 0), []);
    assert.deepEqual(await getStreamsAnizone("abc", "garbage"), []);
    assert.deepEqual(await getStreamsAnizone("", 1), []);
});
