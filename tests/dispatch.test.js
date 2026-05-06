const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { closeDatabaseForTests } = require("../lib/cache/database");
const { dispatchProviders, reloadOverrides, lookupOverride, invalidateCachedSlug } = require("../lib/dispatch");

//===============
// Each test runs against an isolated SQLite file so the slug-cache + detail-cache
// tables are independent. Reuses the canonical-test fixture for One Piece / Naruto.
//===============
function makeTestDb() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nexio-nagare-dispatch-"));
    process.env.CACHE_DB_PATH = path.join(dir, "test.sqlite");
    closeDatabaseForTests();
    return dir;
}

function makeOverrideFile(content) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nexio-nagare-overrides-"));
    const file = path.join(dir, "overrides.json");
    fs.writeFileSync(file, JSON.stringify(content));
    process.env.NEXIO_OVERRIDES_PATH = file;
    reloadOverrides();
    return dir;
}

const NARUTO_CANONICAL = {
    anilist: "20", anidb: "239", mal: "20",
    mainTitle: "NARUTO", englishTitle: "Naruto", synonyms: [],
    format: "TV", year: 2002, episodeCount: 220
};

const ONE_PIECE_CANONICAL = {
    anilist: "21", anidb: "69", mal: "21",
    mainTitle: "ONE PIECE", englishTitle: "ONE PIECE", synonyms: [],
    format: "TV", year: 1999, episodeCount: 1100
};

function fakeProvider({ id = "fake", searchHits = [], detailsBySlug = {}, throws = false } = {}) {
    return {
        id, displayName: id, language: "en", dub: "both",
        async search() { if (throws) throw new Error("boom"); return searchHits.slice(); },
        async details(slug) { return detailsBySlug[slug] || null; },
        async getStreams() { return []; }
    };
}

test("override hits short-circuit search and cache, regardless of state", async () => {
    makeTestDb();
    const overrideDir = makeOverrideFile({
        "anilist:20": { "fake": "naruto-handpicked" }
    });
    try {
        const provider = fakeProvider({ id: "fake" });
        const out = await dispatchProviders({ canonical: NARUTO_CANONICAL, providers: [provider] });
        assert.equal(out.length, 1);
        assert.equal(out[0].source, "override");
        assert.equal(out[0].slug, "naruto-handpicked");
        assert.equal(out[0].confidence, "OVERRIDE");
    } finally {
        fs.rmSync(overrideDir, { recursive: true, force: true });
        delete process.env.NEXIO_OVERRIDES_PATH;
        reloadOverrides();
    }
});

test("override file ignores _ comment keys", () => {
    const overrideDir = makeOverrideFile({
        "_": "this is a comment",
        "anilist:21": { "fake": "one-piece-good" }
    });
    try {
        assert.deepEqual(lookupOverride(ONE_PIECE_CANONICAL, "fake"), { slug: "one-piece-good", episodeOffset: 0 });
        assert.equal(lookupOverride({ anilist: "999" }, "fake"), null);
    } finally {
        fs.rmSync(overrideDir, { recursive: true, force: true });
        delete process.env.NEXIO_OVERRIDES_PATH;
        reloadOverrides();
    }
});

test("dispatch produces a HIGH match through full search → details → score", async () => {
    makeTestDb();
    delete process.env.NEXIO_OVERRIDES_PATH;
    reloadOverrides();
    const provider = fakeProvider({
        id: "fake",
        searchHits: [
            { slug: "naruto-kai", title: "Naruto" },
            { slug: "naruto",     title: "Naruto" }
        ],
        detailsBySlug: {
            "naruto-kai": { format: "TV", year: 2017, episodeCount: 24 },
            "naruto":     { format: "TV", year: 2002, episodeCount: 220 }
        }
    });
    const out = await dispatchProviders({ canonical: NARUTO_CANONICAL, providers: [provider] });
    assert.equal(out.length, 1);
    assert.equal(out[0].source, "match");
    assert.equal(out[0].slug, "naruto");
    assert.equal(out[0].confidence, "HIGH");
});

test("dispatch returns null match (drop) when all candidates fail gates", async () => {
    makeTestDb();
    delete process.env.NEXIO_OVERRIDES_PATH;
    reloadOverrides();
    const provider = fakeProvider({
        id: "fake",
        searchHits: [
            { slug: "naruto-kai",      title: "Naruto" },
            { slug: "naruto-shippuden",title: "Naruto: Shippuden" }
        ],
        detailsBySlug: {
            "naruto-kai":       { format: "TV", year: 2017, episodeCount: 24 },
            "naruto-shippuden": { format: "TV", year: 2007, episodeCount: 500 } // year diff = 5 → hard gate
        }
    });
    const out = await dispatchProviders({ canonical: NARUTO_CANONICAL, providers: [provider] });
    assert.equal(out[0].source, null);
    assert.equal(out[0].slug, null);
});

test("second dispatch hits the slug cache", async () => {
    const dir = makeTestDb();
    delete process.env.NEXIO_OVERRIDES_PATH;
    reloadOverrides();
    let searchCalls = 0;
    const provider = {
        id: "fake", displayName: "fake",
        async search() { searchCalls++; return [{ slug: "naruto", title: "Naruto" }]; },
        async details() { return { format: "TV", year: 2002, episodeCount: 220 }; },
        async getStreams() { return []; }
    };
    const first = await dispatchProviders({ canonical: NARUTO_CANONICAL, providers: [provider] });
    const second = await dispatchProviders({ canonical: NARUTO_CANONICAL, providers: [provider] });

    assert.equal(first[0].source, "match");
    assert.equal(second[0].source, "cache");
    assert.equal(second[0].slug, "naruto");
    assert.equal(searchCalls, 1, "second dispatch should not re-call search()");
    fs.rmSync(dir, { recursive: true, force: true });
});

test("invalidateCachedSlug forces a fresh search next dispatch", async () => {
    const dir = makeTestDb();
    delete process.env.NEXIO_OVERRIDES_PATH;
    reloadOverrides();
    let searchCalls = 0;
    const provider = {
        id: "fake", displayName: "fake",
        async search() { searchCalls++; return [{ slug: "naruto", title: "Naruto" }]; },
        async details() { return { format: "TV", year: 2002, episodeCount: 220 }; },
        async getStreams() { return []; }
    };
    await dispatchProviders({ canonical: NARUTO_CANONICAL, providers: [provider] });
    invalidateCachedSlug({ canonical: NARUTO_CANONICAL, providerId: "fake" });
    await dispatchProviders({ canonical: NARUTO_CANONICAL, providers: [provider] });
    assert.equal(searchCalls, 2);
    fs.rmSync(dir, { recursive: true, force: true });
});

test("provider failure does not crash dispatch (single-provider isolation)", async () => {
    makeTestDb();
    delete process.env.NEXIO_OVERRIDES_PATH;
    reloadOverrides();
    const broken = fakeProvider({ id: "broken", throws: true });
    const ok = fakeProvider({
        id: "ok",
        searchHits: [{ slug: "naruto", title: "Naruto" }],
        detailsBySlug: { "naruto": { format: "TV", year: 2002, episodeCount: 220 } }
    });
    const out = await dispatchProviders({ canonical: NARUTO_CANONICAL, providers: [broken, ok] });
    assert.equal(out.length, 2);
    assert.equal(out[0].slug, null);
    assert.equal(out[1].slug, "naruto");
});
