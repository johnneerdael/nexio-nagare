const test = require("node:test");
const assert = require("node:assert/strict");

const { extractSlug } = require("../lib/providers/animenosub/search");
const { normaliseFormat, pickValue } = require("../lib/providers/animenosub/details");
const { extractIframeUrls } = require("../lib/providers/animenosub/stream");

test("extractSlug pulls /anime/<slug> from the search href", () => {
    assert.equal(extractSlug("https://animenosub.to/anime/one-piece-dub/"), "one-piece-dub");
    assert.equal(extractSlug("https://animenosub.to/anime/abc-123/"), "abc-123");
    assert.equal(extractSlug("https://animenosub.to/page/2/"), null);
    assert.equal(extractSlug(""), null);
});

test("normaliseFormat maps Animenosub Type strings to canonical format", () => {
    assert.equal(normaliseFormat("TV"), "TV");
    assert.equal(normaliseFormat("Movie"), "MOVIE");
    assert.equal(normaliseFormat("OVA"), "OVA");
    assert.equal(normaliseFormat("Special"), "SPECIAL");
    assert.equal(normaliseFormat("ONA"), "ONA");
    assert.equal(normaliseFormat(null), null);
});

test("pickValue strips '<Label>:' prefix from a row span", () => {
    assert.equal(pickValue("Released: 2017", "Released"), "2017");
    assert.equal(pickValue("Type: TV", "Type"), "TV");
    assert.equal(pickValue("Episodes: 293", "Episodes"), "293");
    assert.equal(pickValue("nothing", "Released"), null);
});

test("extractIframeUrls walks .mobius option base64 blobs", () => {
    const opt1 = Buffer.from('<iframe src="https://bysesayeveum.com/e/abc"></iframe>').toString("base64");
    const opt2 = Buffer.from('<iframe src="//vidmoly.net/embed-x.html"></iframe>').toString("base64");
    const html = `
        <html><body>
            <select class="mobius">
                <option value="">Select Video Server</option>
                <option value="${opt1}">Server 1</option>
                <option value="${opt2}">Server 2</option>
            </select>
        </body></html>`;
    const urls = extractIframeUrls(html);
    assert.equal(urls.length, 2);
    assert.ok(urls[0].includes("bysesayeveum.com"));
    assert.ok(urls[1].startsWith("https:"), "// prefix should be normalised to https");
});

test("extractIframeUrls returns [] when no .mobius option exists", () => {
    assert.deepEqual(extractIframeUrls("<html><body>nothing</body></html>"), []);
});
