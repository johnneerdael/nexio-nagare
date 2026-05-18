const test = require("node:test");
const assert = require("node:assert/strict");

const {
    encodeConfigPayload,
    fromBase64Safe,
    normalizeConfig,
    parseConfig,
    toBase64Safe
} = require("../lib/config");

test("normalizeConfig defaults catalogs on and useEnglishTitles on", () => {
    const normalized = normalizeConfig({});
    assert.equal(normalized.useEnglishTitles, true);
    assert.equal(normalized.showSeasonalSeries, true);
    assert.equal(normalized.showAiringSeries, true);
    assert.equal(normalized.showTrendingSeries, true);
    assert.equal(normalized.showTopSeries, true);
    assert.equal(normalized.showTrendingMovies, true);
    assert.equal(normalized.showTopMovies, true);
    assert.equal(normalized.showSearchCatalog, true);
    assert.equal(normalized.preferDub, false);
    assert.equal(normalized.providers, null);
});

test("normalizeConfig respects explicit catalog disables", () => {
    const normalized = normalizeConfig({
        showSeasonalSeries: false,
        showTopMovies: false,
        showSearchCatalog: false,
        useEnglishTitles: false,
        preferDub: true
    });
    assert.equal(normalized.showSeasonalSeries, false);
    assert.equal(normalized.showTopMovies, false);
    assert.equal(normalized.showSearchCatalog, false);
    assert.equal(normalized.useEnglishTitles, false);
    assert.equal(normalized.preferDub, true);
});

test("normalizeConfig sanitizes providers and resolutions arrays", () => {
    const normalized = normalizeConfig({
        providers: ["123anime", "anizone", "", null, "animenosub"],
        resolutions: ["1080p", "720p"]
    });
    assert.deepEqual(normalized.providers, ["123anime", "anizone", "animenosub"]);
    assert.deepEqual(normalized.resolutions, ["1080p", "720p"]);
});

test("parseConfig decodes NexioNagare payload round-trip", () => {
    const raw = {
        providers: ["123anime", "anizone"],
        preferDub: true,
        showTopMovies: false,
        resolutions: ["1080p"]
    };
    const payload = encodeConfigPayload(raw);
    const parsed = parseConfig({ NexioNagare: payload });

    assert.deepEqual(parsed.providers, ["123anime", "anizone"]);
    assert.equal(parsed.preferDub, true);
    assert.equal(parsed.showTopMovies, false);
    assert.deepEqual(parsed.resolutions, ["1080p"]);
});

test("parseConfig falls back to plain object when payload absent", () => {
    const parsed = parseConfig({ preferDub: true });
    assert.equal(parsed.preferDub, true);
});

test("parseConfig handles missing or malformed payload gracefully", () => {
    assert.equal(parseConfig(null).useEnglishTitles, true);
    assert.equal(parseConfig({ NexioNagare: "@@@not-base64@@@" }).useEnglishTitles, true);
});

test("base64 helpers round trip URL-safe payloads", () => {
    const encoded = toBase64Safe(JSON.stringify({ key: "a/b+c=" }));
    assert.equal(encoded.includes("+"), false);
    assert.equal(encoded.includes("/"), false);
    assert.equal(encoded.includes("="), false);
    assert.equal(fromBase64Safe(encoded), JSON.stringify({ key: "a/b+c=" }));
});
