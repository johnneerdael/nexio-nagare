const test = require("node:test");
const assert = require("node:assert/strict");

const { REGISTRY, REGISTRY_BY_ID, getActiveProviders, findBestMatch } = require("../lib/providers");

test("registry exposes 123anime under stable id", () => {
    const p = REGISTRY_BY_ID.get("onetwothreeanime");
    assert.ok(p, "expected onetwothreeanime in registry");
    assert.equal(p.displayName, "123anime");
    assert.equal(p.language, "en");
    assert.equal(typeof p.search, "function");
    assert.equal(typeof p.getStreams, "function");
});

test("getActiveProviders returns full registry when no preference", () => {
    const active = getActiveProviders({});
    assert.equal(active.length, REGISTRY.length);
});

test("getActiveProviders filters by user preference list", () => {
    const active = getActiveProviders({ providers: ["onetwothreeanime"] });
    assert.equal(active.length, 1);
    assert.equal(active[0].id, "onetwothreeanime");
});

test("getActiveProviders falls back to full registry when preference list is unknown", () => {
    const active = getActiveProviders({ providers: ["bogus"] });
    assert.equal(active.length, REGISTRY.length);
});

test("findBestMatch picks the closest title via fuzzy match", () => {
    const results = [
        { slug: "naruto", title: "Naruto" },
        { slug: "one-piece", title: "One Piece" },
        { slug: "one-piece-dub", title: "One Piece (Dub)" }
    ];
    const match = findBestMatch(results, "one piece");
    assert.ok(match);
    assert.match(match.slug, /^one-piece/);
});

test("findBestMatch prefers exact-length matches over longer titles that contain the query", () => {
    const results = [
        { slug: "one-piece-dr-chopper", title: "One Piece: Dr. Chopper's Adventure - The Last Records" },
        { slug: "one-piece", title: "One Piece" }
    ];
    const match = findBestMatch(results, "ONE PIECE");
    assert.ok(match);
    assert.equal(match.slug, "one-piece");
});

test("findBestMatch ignores (Dub) suffix when scoring", () => {
    const results = [
        { slug: "naruto-kai", title: "Naruto" },
        { slug: "naruto-dub", title: "Naruto (Dub)" }
    ];
    const match = findBestMatch(results, "naruto");
    assert.ok(match);
    assert.match(match.slug, /^naruto/);
});

test("findBestMatch returns null when no candidate clears threshold", () => {
    const results = [{ slug: "totally-unrelated", title: "Totally Unrelated Title" }];
    const match = findBestMatch(results, "one piece");
    assert.equal(match, null);
});

test("findBestMatch returns null on empty input", () => {
    assert.equal(findBestMatch([], "x"), null);
    assert.equal(findBestMatch(null, "x"), null);
});
