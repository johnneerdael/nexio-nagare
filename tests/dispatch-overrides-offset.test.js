const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { closeDatabaseForTests } = require("../lib/cache/database");
const { dispatchProviders, reloadOverrides, lookupOverride } = require("../lib/dispatch");

function makeTestDb() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nexio-nagare-offset-"));
    process.env.CACHE_DB_PATH = path.join(dir, "test.sqlite");
    closeDatabaseForTests();
    return dir;
}

function makeOverrideFile(content) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nexio-nagare-overrides-offset-"));
    const file = path.join(dir, "overrides.json");
    fs.writeFileSync(file, JSON.stringify(content));
    process.env.NEXIO_OVERRIDES_PATH = file;
    reloadOverrides();
    return dir;
}

const CANONICAL = {
    anilist: "999", anidb: null, mal: null,
    mainTitle: "X", englishTitle: "X", synonyms: [],
    format: "TV", year: 2020, episodeCount: 12
};

test("string-shaped override returns slug + zero offset", () => {
    const dir = makeOverrideFile({
        "anilist:999": { "fake": "x-slug" }
    });
    try {
        const o = lookupOverride(CANONICAL, "fake");
        assert.deepEqual(o, { slug: "x-slug", episodeOffset: 0 });
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
        delete process.env.NEXIO_OVERRIDES_PATH;
        reloadOverrides();
    }
});

test("object-shaped override returns slug + episodeOffset", () => {
    const dir = makeOverrideFile({
        "anilist:999": { "fake": { slug: "season-2-merged", episodeOffset: 26 } }
    });
    try {
        const o = lookupOverride(CANONICAL, "fake");
        assert.deepEqual(o, { slug: "season-2-merged", episodeOffset: 26 });
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
        delete process.env.NEXIO_OVERRIDES_PATH;
        reloadOverrides();
    }
});

test("dispatch surfaces episodeOffset on override matches", async () => {
    makeTestDb();
    const dir = makeOverrideFile({
        "anilist:999": { "fake": { slug: "merged", episodeOffset: 12 } }
    });
    try {
        const provider = {
            id: "fake", displayName: "fake",
            async search() { return []; },
            async details() { return null; },
            async getStreams() { return []; }
        };
        const out = await dispatchProviders({ canonical: CANONICAL, providers: [provider] });
        assert.equal(out.length, 1);
        assert.equal(out[0].slug, "merged");
        assert.equal(out[0].episodeOffset, 12);
        assert.equal(out[0].source, "override");
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
        delete process.env.NEXIO_OVERRIDES_PATH;
        reloadOverrides();
    }
});
