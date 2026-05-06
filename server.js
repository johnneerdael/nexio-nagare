require("dotenv").config();
const express = require("express");
const fs = require("node:fs");
const path = require("path");
const { getRouter } = require("stremio-addon-sdk");
const { addonInterface } = require("./addon");
const { applyHttpCacheHeaders } = require("./lib/cache/http-cache");
const { refreshAnimeMap } = require("./lib/identity/anime-map-generator");
const { defaultAnimeMapPath } = require("./lib/identity/anime-map");
const { reloadAnimeMap } = require("./lib/identity/resolver");
const { createSubHandler } = require("./lib/sub-proxy");

const app = express();
app.use(express.json());

//===============
// CORS & PREFLIGHT HANDLING
// Stremio Web on Apple devices (WebKit) is strict; we explicitly allow Range
// for subtitle seeking when /sub is wired up in a later wave.
//===============
app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, HEAD");
    res.setHeader("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization, Range");
    res.setHeader("Access-Control-Expose-Headers", "Content-Length, Content-Range");
    if (req.method === "OPTIONS") return res.status(204).end();
    next();
});

app.use(applyHttpCacheHeaders);

process.on("unhandledRejection", (reason, promise) => {
    console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

app.use(express.static(path.join(__dirname, "public")));
app.use(express.static(path.join(__dirname, "static")));

const port = process.env.PORT || 7002;

app.get("/health", (req, res) => res.status(200).json({ "status": "alive" }));

app.get("/configure", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

//===============
// Subtitle proxy — /sub/<b64url-payload>.<ext>
// Fetches the upstream subtitle file with the encoded headers and pipes it
// through with a sane Content-Type. Used when subtitle CDNs require Referer
// or other headers Stremio doesn't reliably forward for tracks.
//===============
app.get("/sub/:payload", createSubHandler());

app.use("/", getRouter(addonInterface));

//===============
// IDENTITY MAP REFRESH
// At container start, ensure we have an anime-map. If the file is older than 24h
// or missing, refresh it inline (sync-blocking on cold start so the resolver
// has fresh data on the first stream request). Then schedule daily refreshes.
// Refresh failures degrade to "use the existing snapshot" — never crash.
//===============
const REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000;
const REFRESH_STALE_AFTER_MS = 24 * 60 * 60 * 1000;

function shouldRefreshOnBoot() {
    if (process.env.SKIP_IDENTITY_REFRESH === "1") return false;
    try {
        const stat = fs.statSync(defaultAnimeMapPath());
        return Date.now() - stat.mtimeMs > REFRESH_STALE_AFTER_MS;
    } catch (e) {
        return true; // map is missing
    }
}

async function refreshIdentityNow(reason) {
    try {
        const result = await refreshAnimeMap({});
        reloadAnimeMap();
        console.log(`[IDENTITY] refresh reason=${reason} refreshed=${result.refreshed} used_existing=${result.usedExisting || false} identity_records=${result.identityRecords}`);
    } catch (e) {
        console.error(`[IDENTITY] refresh failed: ${e.message}`);
    }
}

(async () => {
    if (shouldRefreshOnBoot()) {
        await refreshIdentityNow("boot");
    } else {
        console.log("[IDENTITY] map fresh, skipping boot refresh");
    }
    setInterval(() => refreshIdentityNow("interval").catch(() => {}), REFRESH_INTERVAL_MS).unref();
})();

app.listen(port, "0.0.0.0", () => console.log("NEXIO NAGARE ONLINE | PORT " + port));
