const test = require("node:test");
const assert = require("node:assert/strict");

const { resolveExtractor, extract } = require("../lib/extractors");

//===============
// Pure URL routing — verifies host-substring matching catches the right
// extractor for every host in the supported families.
//===============
const ROUTING = [
    ["https://streamwish.to/e/abc",     "StreamWish"],
    ["https://wishfast.top/f/xyz",      "StreamWish"],
    ["https://swiftplayers.com/e/xyz",  "StreamWish"],
    ["https://embedwish.com/e/foo",     "StreamWish"],
    ["https://hlswish.com/e/q",         "StreamWish"],

    ["https://filemoon.sx/e/abc",       "Filemoon"],
    ["https://filemoon.to/e/abc",       "Filemoon"],
    ["https://files.im/e/abc",          "Filemoon"],
    ["https://streamhide.to/e/abc",     "Filemoon"],

    ["https://vtbe.to/e/abc",           "Vtbe"],

    ["https://waaw.to/embed-abc.html",  "StreamSB"],
    ["https://sblona.com/e/abc",        "StreamSB"],

    ["https://animenosub.upn.one/e/abc#hashvalue", "Animenosub"]
];

for (const [url, expected] of ROUTING) {
    test(`resolveExtractor routes ${url} → ${expected}`, () => {
        const r = resolveExtractor(url);
        assert.ok(r, `expected a router match for ${url}`);
        assert.equal(r.name, expected);
    });
}

test("resolveExtractor returns null for unknown hosts", () => {
    assert.equal(resolveExtractor("https://example.com/e/abc"), null);
    assert.equal(resolveExtractor(""), null);
    assert.equal(resolveExtractor(null), null);
});

test("extract returns [] for unknown hosts (never throws)", async () => {
    const out = await extract("https://example.com/e/abc");
    assert.deepEqual(out, []);
});
