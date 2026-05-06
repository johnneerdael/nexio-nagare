const test = require("node:test");
const assert = require("node:assert/strict");

const {
    encodeSubProxyUrl,
    decodeSubProxyParam,
    createSubHandler,
    MIME_BY_EXT
} = require("../lib/sub-proxy");

test("encode/decode round-trips a subtitle URL with headers", () => {
    const url = encodeSubProxyUrl({
        url: "https://cdn.example.com/track.vtt",
        headers: { Referer: "https://hostsite.com/" },
        ext: "vtt",
        baseUrl: "http://127.0.0.1:7002"
    });
    assert.ok(url, "expected a sub URL");
    assert.match(url, /^http:\/\/127\.0\.0\.1:7002\/sub\/[\w-]+\.vtt$/);

    const param = url.split("/").pop();
    const decoded = decodeSubProxyParam(param);
    assert.deepEqual(decoded, {
        url: "https://cdn.example.com/track.vtt",
        headers: { Referer: "https://hostsite.com/" }
    });
});

test("encodeSubProxyUrl falls back to vtt extension on unknown ext", () => {
    const url = encodeSubProxyUrl({ url: "https://x/track", ext: "exotic", baseUrl: "http://h" });
    assert.match(url, /\.vtt$/);
});

test("decodeSubProxyParam returns null on garbage", () => {
    assert.equal(decodeSubProxyParam(""), null);
    assert.equal(decodeSubProxyParam("@@@.vtt"), null);
    assert.equal(decodeSubProxyParam(null), null);
});

test("MIME_BY_EXT covers the common subtitle extensions", () => {
    assert.equal(MIME_BY_EXT.vtt, "text/vtt");
    assert.equal(MIME_BY_EXT.srt, "application/x-subrip");
    assert.equal(MIME_BY_EXT.ass, "text/x-ssa");
    assert.equal(MIME_BY_EXT.ssa, "text/x-ssa");
});

test("createSubHandler 400s on garbage payload", async () => {
    const handler = createSubHandler({ httpGet: async () => ({ data: "" }) });
    let status = 0, body = "";
    const req = { params: { payload: "garbage" } };
    const res = {
        status(s) { status = s; return this; },
        send(b) { body = b; return this; },
        setHeader() {}
    };
    await handler(req, res);
    assert.equal(status, 400);
    assert.match(body, /invalid sub payload/);
});

test("createSubHandler pipes upstream bytes through with right Content-Type", async () => {
    const fakeBody = Buffer.from("WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nhi");
    const handler = createSubHandler({
        httpGet: async (url, opts) => {
            assert.equal(url, "https://cdn.example.com/track.vtt");
            assert.deepEqual(opts.headers, { Referer: "https://hostsite.com/" });
            return { data: fakeBody };
        }
    });
    const headers = {};
    let body = null;
    const param = encodeSubProxyUrl({
        url: "https://cdn.example.com/track.vtt",
        headers: { Referer: "https://hostsite.com/" },
        ext: "vtt",
        baseUrl: "http://h"
    }).split("/").pop();
    const req = { params: { payload: param } };
    const res = {
        status() { return this; },
        send(b) { body = b; return this; },
        setHeader(k, v) { headers[k] = v; }
    };
    await handler(req, res);
    assert.equal(headers["Content-Type"], "text/vtt");
    assert.ok(Buffer.isBuffer(body));
    assert.equal(body.toString("utf8"), fakeBody.toString("utf8"));
});

test("createSubHandler 502s when upstream fetch throws", async () => {
    const handler = createSubHandler({ httpGet: async () => { throw new Error("dns fail"); } });
    let status = 0, body = "";
    const param = encodeSubProxyUrl({ url: "https://gone.example.com/x.vtt", ext: "vtt", baseUrl: "http://h" }).split("/").pop();
    const req = { params: { payload: param } };
    const res = {
        status(s) { status = s; return this; },
        send(b) { body = b; return this; },
        setHeader() {}
    };
    await handler(req, res);
    assert.equal(status, 502);
    assert.match(body, /dns fail/);
});
