const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { enrichDirectStream, formatNagareStream } = require("../lib/stream-formatter");

const FIXTURE_PATH = "/Users/jneerdael/Scripts/nexio/docs/superpowers/specs/2026-05-07-fixtures/nagare-gojo-id-exact.json";

test("nagare emission matches fixture", () => {
    if (!fs.existsSync(FIXTURE_PATH)) {
        console.warn("nagare fixture not found, skipping cross-repo round-trip");
        return;
    }
    const f = JSON.parse(fs.readFileSync(FIXTURE_PATH, "utf8"));
    const enriched = enrichDirectStream({
        provider: f.input.provider,
        providerStream: f.input.providerStream,
        canonical: f.input.canonical,
        episode: f.input.episode,
        season: f.input.season,
        match: f.input.match
    });
    const out = formatNagareStream(enriched, {
        url: f.input.providerStream.url,
        headers: f.input.providerStream.headers
    });
    assert.equal(out.name, f.emitted.name);
    assert.equal(out.description, f.emitted.description);
});
