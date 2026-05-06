const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

const { encodeId, extractId, streamsb } = require("../lib/extractors/streamsb");
const { decryptAesCbc, animenosubAes } = require("../lib/extractors/animenosub-aes");

function withStubbedHttp(stubGet, fn) {
    const httpModule = require.cache[require.resolve("../lib/providers/http")];
    const origGet = httpModule.exports.get;
    httpModule.exports.get = stubGet;
    return Promise.resolve(fn()).finally(() => {
        httpModule.exports.get = origGet;
    });
}

//===============
// StreamSB
//===============
test("StreamSB extracts the id from embed URLs", () => {
    assert.equal(extractId("https://waaw.to/embed-abc123def.html"), "abc123def");
    assert.equal(extractId("https://sblona.com/e/xyz_999-end"), "xyz_999-end");
    assert.equal(extractId("https://example.com/no-pattern"), null);
});

test("StreamSB encodeId emits hex of `{rand}||id||{rand}||streamsb`", () => {
    const encoded = encodeId("abc");
    // hex pattern only — no spaces, no high-bit chars
    assert.match(encoded, /^[0-9a-f]+$/);
    // Decoded must contain ||abc||...||streamsb
    const decoded = Buffer.from(encoded, "hex").toString("utf8");
    assert.match(decoded, /\|\|abc\|\|.*\|\|streamsb$/);
});

test("StreamSB extracts m3u8 from JSON master response", async () => {
    const fakeJson = { stream_data: { file: "https://cdn.example.com/x.m3u8" } };
    await withStubbedHttp(async () => ({ data: fakeJson }), async () => {
        const result = await streamsb("https://waaw.to/embed-abc.html");
        assert.equal(result.length, 1);
        assert.equal(result[0].url, "https://cdn.example.com/x.m3u8");
        assert.equal(result[0].server, "StreamSB");
        assert.match(result[0].headers.Referer, /^https:\/\/waaw\.to/);
    });
});

test("StreamSB returns [] when JSON missing stream_data", async () => {
    await withStubbedHttp(async () => ({ data: { error: "nope" } }), async () => {
        const result = await streamsb("https://waaw.to/embed-abc.html");
        assert.deepEqual(result, []);
    });
});

//===============
// Animenosub AES helper — exercises the round-trip with the published key/iv.
//===============
const AES_KEY = "kiemtienmua911ca";
const AES_IV = "0123456789abcdef";

function encryptHexAesCbc(plaintext, key, iv) {
    const cipher = crypto.createCipheriv("aes-128-cbc", Buffer.from(key, "utf8"), Buffer.from(iv, "utf8"));
    return Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]).toString("hex");
}

test("decryptAesCbc round-trips the documented Animenosub key/iv", () => {
    const plaintext = '{"source":"https://anh.example.com/master.m3u8","other":"x"}';
    const encrypted = encryptHexAesCbc(plaintext, AES_KEY, AES_IV);
    const out = decryptAesCbc(encrypted, AES_KEY, AES_IV);
    assert.equal(out, plaintext);
});

test("animenosubAes extracts the m3u8 from a synthetic encrypted payload", async () => {
    const plaintext = '{"source":"https:\\/\\/cdn.anosub.example\\/master.m3u8"}';
    const encrypted = encryptHexAesCbc(plaintext, AES_KEY, AES_IV);
    await withStubbedHttp(async () => ({ data: encrypted }), async () => {
        const url = "https://animenosub.upn.one/e/whatever#abc123";
        const result = await animenosubAes(url);
        assert.equal(result.length, 1);
        assert.equal(result[0].url, "https://cdn.anosub.example/master.m3u8");
        assert.equal(result[0].server, "Animenosub");
    });
});

test("animenosubAes returns [] when payload doesn't decrypt", async () => {
    await withStubbedHttp(async () => ({ data: "garbage" }), async () => {
        const result = await animenosubAes("https://animenosub.upn.one/e/x#hash");
        assert.deepEqual(result, []);
    });
});

test("animenosubAes returns [] when the URL has no hash component", async () => {
    const result = await animenosubAes("https://animenosub.upn.one/e/no-hash-here");
    assert.deepEqual(result, []);
});
