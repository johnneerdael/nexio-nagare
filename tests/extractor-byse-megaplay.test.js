const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

const { extractVideoId, decryptPlayback, byse } = require("../lib/extractors/byse");
const { megaplay } = require("../lib/extractors/megaplay");

function withStubbedHttp(stubGet, fn) {
    const httpModule = require.cache[require.resolve("../lib/providers/http")];
    const origGet = httpModule.exports.get;
    httpModule.exports.get = stubGet;
    return Promise.resolve(fn()).finally(() => {
        httpModule.exports.get = origGet;
    });
}

//===============
// Byse helpers
//===============
test("extractVideoId pulls the id from /e/<id> in the embed URL", () => {
    assert.equal(extractVideoId("https://bysesayeveum.com/e/hlvneiyrjk6f"), "hlvneiyrjk6f");
    assert.equal(extractVideoId("https://byse.example.com/e/abc-123_xy"), "abc-123_xy");
    assert.equal(extractVideoId("https://example.com/no-e-prefix"), null);
    assert.equal(extractVideoId(""), null);
    assert.equal(extractVideoId(null), null);
});

test("decryptPlayback round-trips an AES-256-GCM encrypted JSON blob", () => {
    const plaintext = '{"sources":[{"url":"https://cdn.example.com/x.m3u8","label":"1080p","height":1080}]}';
    const key = crypto.randomBytes(32);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    const ctTag = Buffer.concat([ct, tag]);

    const b64url = b => b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const playback = {
        algorithm: "AES-256-GCM",
        iv: b64url(iv),
        payload: b64url(ctTag),
        key_parts: [b64url(key.subarray(0, 16)), b64url(key.subarray(16, 32))]
    };

    const decoded = decryptPlayback(playback);
    assert.ok(decoded);
    assert.deepEqual(decoded.sources, [{ url: "https://cdn.example.com/x.m3u8", label: "1080p", height: 1080 }]);
});

test("decryptPlayback returns null on tampered ciphertext", () => {
    const playback = {
        iv: "AAAAAAAAAAAAAAAA",
        payload: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        key_parts: ["YWJjZGVmZ2hpamtsbW5vcA", "YWJjZGVmZ2hpamtsbW5vcA"]
    };
    assert.equal(decryptPlayback(playback), null);
});

test("byse extracts m3u8 + headers from a synthetic API response", async () => {
    const plaintext = '{"sources":[{"url":"https://cdn.example.com/byse.m3u8","label":"1080p","height":1080}]}';
    const key = crypto.randomBytes(32);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    const b64url = b => b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const meta = {
        playback: {
            iv: b64url(iv),
            payload: b64url(Buffer.concat([ct, tag])),
            key_parts: [b64url(key.subarray(0, 16)), b64url(key.subarray(16, 32))]
        }
    };
    await withStubbedHttp(async () => ({ data: meta }), async () => {
        const out = await byse("https://bysesayeveum.com/e/hlvneiyrjk6f");
        assert.equal(out.length, 1);
        assert.equal(out[0].url, "https://cdn.example.com/byse.m3u8");
        assert.equal(out[0].server, "Byse");
        assert.equal(out[0].quality, "1080p");
        assert.equal(out[0].headers.Origin, "https://bysesayeveum.com");
    });
});

test("byse returns [] for unknown URL shape", async () => {
    const out = await byse("https://bysesayeveum.com/no-e-path");
    assert.deepEqual(out, []);
});

//===============
// MegaPlay
//===============
test("megaplay extracts m3u8 via getSources after scraping data-id", async () => {
    let calls = 0;
    const html = '<html><body><div id="megaplay-player" data-id="36382"></div></body></html>';
    const apiResp = {
        sources: { file: "https://cdn.example.com/megaplay.m3u8" },
        tracks: [
            { kind: "captions", file: "https://cdn.example.com/en.vtt", label: "English" },
            { kind: "thumbnails", file: "https://cdn.example.com/sprite.vtt" }
        ]
    };
    await withStubbedHttp(async (url) => {
        calls++;
        if (calls === 1) {
            assert.match(url, /megaplay\.buzz\/stream\/s-2\/2142\/dub$/);
            return { data: html };
        }
        assert.match(url, /megaplay\.buzz\/stream\/getSources\?id=36382/);
        return { data: apiResp };
    }, async () => {
        const out = await megaplay("https://megaplay.buzz/stream/s-2/2142/dub");
        assert.equal(out.length, 1);
        assert.equal(out[0].url, "https://cdn.example.com/megaplay.m3u8");
        assert.equal(out[0].server, "MegaPlay");
        assert.equal(out[0].subtitles.length, 1, "thumbnail track should be filtered out");
        assert.equal(out[0].subtitles[0].label, "English");
    });
});

test("megaplay returns [] when data-id is missing", async () => {
    await withStubbedHttp(async () => ({ data: "<html><body>nothing</body></html>" }), async () => {
        assert.deepEqual(await megaplay("https://megaplay.buzz/stream/x"), []);
    });
});

test("megaplay returns [] when sources.file is missing", async () => {
    let calls = 0;
    await withStubbedHttp(async () => {
        calls++;
        return calls === 1
            ? { data: '<div id="megaplay-player" data-id="999"></div>' }
            : { data: { sources: {}, tracks: [] } };
    }, async () => {
        assert.deepEqual(await megaplay("https://megaplay.buzz/stream/x"), []);
    });
});
