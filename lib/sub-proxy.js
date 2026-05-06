//===============
// Subtitle proxy.
//
// Some subtitle CDNs require the same Referer/Origin headers as their video
// streams. Stremio passes proxyHeaders for stream URLs but not (reliably) for
// subtitle URLs across all client versions, so the safer path is to fetch
// subtitles server-side and pipe them through with the right Content-Type.
//
// The endpoint is `/sub/<base64url-payload>.<ext>` where:
//   payload = base64url(JSON.stringify({ url, headers? }))
//   ext     = "vtt" | "srt" | "ass" | "ssa"   (used to pick a sensible Content-Type)
//
// Encoding side: lib/sub-proxy.encodeSubProxyUrl({ url, headers, ext, baseUrl })
//===============

const axios = require("axios");

const MIME_BY_EXT = {
    vtt: "text/vtt",
    srt: "application/x-subrip",
    ass: "text/x-ssa",
    ssa: "text/x-ssa",
    txt: "text/plain"
};

function toB64Safe(s) {
    return Buffer.from(s, "utf8").toString("base64")
        .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64Safe(s) {
    const norm = String(s || "").replace(/-/g, "+").replace(/_/g, "/");
    const padded = norm + "=".repeat((4 - norm.length % 4) % 4);
    return Buffer.from(padded, "base64").toString("utf8");
}

//===============
// Build a /sub URL the addon will serve. baseUrl should be the public base of
// this addon (e.g. http://127.0.0.1:7002).
//===============
function encodeSubProxyUrl({ url, headers, ext = "vtt", baseUrl }) {
    if (!url || !baseUrl) return null;
    const safeExt = MIME_BY_EXT[ext] ? ext : "vtt";
    const payload = toB64Safe(JSON.stringify({ url, headers: headers || null }));
    return `${baseUrl.replace(/\/+$/, "")}/sub/${payload}.${safeExt}`;
}

function decodeSubProxyParam(param) {
    if (!param) return null;
    const noExt = String(param).replace(/\.[a-z]+$/i, "");
    let parsed;
    try {
        parsed = JSON.parse(fromB64Safe(noExt));
    } catch (e) {
        return null;
    }
    if (!parsed || typeof parsed.url !== "string") return null;
    return { url: parsed.url, headers: parsed.headers || null };
}

//===============
// Express handler factory. Inject axios for testing.
//===============
function createSubHandler({ httpGet = axios.get } = {}) {
    return async function subHandler(req, res) {
        const param = req.params.payload;
        const decoded = decodeSubProxyParam(param);
        if (!decoded) return res.status(400).send("invalid sub payload");

        const ext = String(param || "").match(/\.([a-z]+)$/i)?.[1]?.toLowerCase() || "vtt";
        const mime = MIME_BY_EXT[ext] || "text/plain";

        let upstream;
        try {
            upstream = await httpGet(decoded.url, {
                timeout: 10000,
                responseType: "arraybuffer",
                headers: decoded.headers || {}
            });
        } catch (e) {
            return res.status(502).send("upstream subtitle fetch failed: " + (e.message || ""));
        }

        res.setHeader("Content-Type", mime);
        res.setHeader("Cache-Control", "public, max-age=86400");
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.send(Buffer.from(upstream.data));
    };
}

module.exports = {
    MIME_BY_EXT,
    createSubHandler,
    decodeSubProxyParam,
    encodeSubProxyUrl
};
