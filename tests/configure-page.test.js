const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "..", "public", "index.html"), "utf8");

test("configure page is rebranded — no torii / debrid leftovers", () => {
    assert.doesNotMatch(html, /Nexio\s+Torii/i, "should not reference Nexio Torii");
    assert.doesNotMatch(html, /debrid/i, "should not mention debrid");
    assert.doesNotMatch(html, /\bP2P\b/, "should not offer P2P (no torrent layer)");
    assert.doesNotMatch(html, /Nyaa/i, "should not mention Nyaa");
});

test("configure page surfaces all five shipped providers as toggles", () => {
    assert.match(html, /value="onetwothreeanime"/, "missing 123anime provider toggle");
    assert.match(html, /value="anizone"/, "missing Anizone provider toggle");
    assert.match(html, /value="animenosub"/, "missing Animenosub provider toggle");
    assert.match(html, /value="animepahe"/, "missing AnimePahe provider toggle");
    assert.match(html, /value="gojo"/, "missing Gojo provider toggle");
    assert.match(html, /class="[^"]*provider-cb[^"]*"/);
});

test("configure page emits a NexioNagare-keyed config payload", () => {
    assert.match(html, /NexioNagare/);
    assert.doesNotMatch(html, /NexioTorii/);
});

test("configure page includes preferDub + useEnglishTitles toggles", () => {
    assert.match(html, /id="preferDub"/);
    assert.match(html, /id="useEnglishTitles"/);
});

test("configure page includes catalog visibility toggles wired to config keys", () => {
    [
        "showSeasonalSeries",
        "showAiringSeries",
        "showTrendingSeries",
        "showTopSeries",
        "showTrendingMovies",
        "showTopMovies"
    ].forEach(id => assert.match(html, new RegExp(`id="${id}"`), `missing ${id}`));
});

test("configure page exposes both Stremio and Web install entry points", () => {
    assert.match(html, /id="installStremio"/);
    assert.match(html, /id="installWeb"/);
    assert.match(html, /stremio:\/\//);
    assert.match(html, /web\.stremio\.com/);
});
