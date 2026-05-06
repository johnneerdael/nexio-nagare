const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("module");

const { streamwish, normaliseEmbedUrl } = require("../lib/extractors/streamwish");

//===============
// Stub the shared HTTP client so the test never hits the network.
//===============
function withStubbedHttp(stubGet, fn) {
    const httpModule = require.cache[require.resolve("../lib/providers/http")];
    const origGet = httpModule.exports.get;
    httpModule.exports.get = stubGet;
    return Promise.resolve(fn()).finally(() => {
        httpModule.exports.get = origGet;
    });
}

// Decoded payload mimics a real JwPlayer setup() call:
//   jwplayer("vplayer").setup({sources:[{file:"https://cdn.example.com/master.m3u8",label:"1080p"}]})
// Indices: 0=jwplayer 1=vplayer 2=setup 3=sources 4=file 5=<url> 6=label 7=1080p
const SAMPLE_PACKED = "eval(function(p,a,c,k,e,d){e=function(c){return c.toString(a)};if(!''.replace(/^/,String)){while(c--)d[e(c)]=k[c]||e(c);k=[function(e){return d[e]}];e=function(){return'\\\\w+'};c=1};while(c--)if(k[c])p=p.replace(new RegExp('\\\\b'+e(c)+'\\\\b','g'),k[c]);return p}('0(\"1\").2({3:[{4:\"5\",6:\"7\"}]})',36,8,'jwplayer|vplayer|setup|sources|file|https://cdn.example.com/master.m3u8|label|1080p'.split('|'),0,{}))";
const PAGE_HTML = `<html><script>${SAMPLE_PACKED}</script></html>`;

test("normaliseEmbedUrl rewrites /f/X and /e/X to /X on the same host", () => {
    assert.equal(normaliseEmbedUrl("https://streamwish.to/e/abc"), "https://streamwish.to/abc");
    assert.equal(normaliseEmbedUrl("https://wishfast.top/f/xyz"), "https://wishfast.top/xyz");
    assert.equal(normaliseEmbedUrl("https://streamwish.to/abc"), "https://streamwish.to/abc");
});

test("streamwish extracts m3u8 from packed JS and emits proxyHeaders", async () => {
    await withStubbedHttp(async () => ({ data: PAGE_HTML }), async () => {
        const result = await streamwish("https://streamwish.to/e/abc");
        assert.equal(result.length, 1);
        assert.equal(result[0].url, "https://cdn.example.com/master.m3u8");
        assert.equal(result[0].server, "StreamWish");
        assert.equal(result[0].quality, "1080p");
        assert.deepEqual(result[0].headers, {
            Referer: "https://streamwish.to/",
            Origin: "https://streamwish.to"
        });
    });
});

test("streamwish returns [] when no sources in unpacked output", async () => {
    await withStubbedHttp(async () => ({ data: "<html><script>var x=1</script></html>" }), async () => {
        const result = await streamwish("https://streamwish.to/e/abc");
        assert.deepEqual(result, []);
    });
});

test("streamwish swallows network errors and returns []", async () => {
    await withStubbedHttp(async () => { throw new Error("network down"); }, async () => {
        const result = await streamwish("https://streamwish.to/e/abc");
        assert.deepEqual(result, []);
    });
});
