const test = require("node:test");
const assert = require("node:assert/strict");

const { parseStremioId, resolveCanonical, normalizeFormat } = require("../lib/identity/resolver");

test("parseStremioId handles anilist:N-EP", () => {
    assert.deepEqual(parseStremioId("anilist:21-1"), { idKind: "anilist", externalId: "21", season: 1, episode: 1 });
});

test("parseStremioId handles anilist:N (defaults episode 1)", () => {
    assert.deepEqual(parseStremioId("anilist:21"), { idKind: "anilist", externalId: "21", season: 1, episode: 1 });
});

test("parseStremioId handles kitsu:N-EP", () => {
    assert.deepEqual(parseStremioId("kitsu:12345-7"), { idKind: "kitsu", externalId: "12345", season: 1, episode: 7 });
});

test("parseStremioId handles tt-imdb with season/episode", () => {
    assert.deepEqual(parseStremioId("tt0388629:1:5"), { idKind: "imdb", externalId: "tt0388629", season: 1, episode: 5 });
});

test("parseStremioId rejects garbage", () => {
    assert.equal(parseStremioId(""), null);
    assert.equal(parseStremioId("garbage"), null);
    assert.equal(parseStremioId(null), null);
});

test("normalizeFormat maps Fribb sourceType strings to canonical format", () => {
    assert.equal(normalizeFormat("TV"), "TV");
    assert.equal(normalizeFormat("Movie"), "MOVIE");
    assert.equal(normalizeFormat("OVA"), "OVA");
    assert.equal(normalizeFormat("Special"), "SPECIAL");
    assert.equal(normalizeFormat("Web"), "ONA");
    assert.equal(normalizeFormat("Music"), "MUSIC");
    assert.equal(normalizeFormat(""), null);
    assert.equal(normalizeFormat(null), null);
});

test("resolveCanonical merges identity-map record with cached AniList payload", async () => {
    // Synthetic in-memory map covering AniList ID 21 (One Piece).
    const fakeMap = {
        records: {
            "1": {
                kitsu: "1",
                anilist: "21", anidb: "69", mal: "21", imdb: "tt0388629",
                sourceType: "TV",
                mediaType: "series"
            }
        },
        indexes: {
            byAnilist: { "21": "1" },
            byAnidb:   { "69": "1" },
            byMal:     { "21": "1" },
            byKitsu:   { "1":  "1" },
            byImdb:    { "tt0388629": ["1"] }
        },
        episodeMappings: {}
    };
    const fakeMeta = {
        id: "anilist:21",
        type: "anime",
        name: "ONE PIECE",
        englishName: "ONE PIECE",
        synonyms: ["One Piece"],
        episodes: 1100,
        releaseInfo: "1999",
        idMal: 21
    };

    const result = await resolveCanonical("anilist:21-1", {
        loadMap: () => fakeMap,
        fetchAnilistMeta: async () => fakeMeta
    });

    assert.ok(result, "expected a canonical resolution");
    assert.equal(result.episode, 1);
    assert.equal(result.canonical.anilist, "21");
    assert.equal(result.canonical.anidb, "69");
    assert.equal(result.canonical.imdb, "tt0388629");
    assert.equal(result.canonical.format, "TV");
    assert.equal(result.canonical.year, 1999);
    assert.equal(result.canonical.episodeCount, 1100);
    assert.equal(result.canonical.englishTitle, "ONE PIECE");
    assert.deepEqual(result.canonical.synonyms, ["One Piece"]);
    assert.equal(result.canonical.hasIdentityMapRecord, true);
});

test("resolveCanonical returns null when AniList fetch fails and id is non-anilist", async () => {
    const result = await resolveCanonical("kitsu:99999-1", {
        loadMap: () => ({ records: {}, indexes: {}, episodeMappings: {} }),
        fetchAnilistMeta: async () => null
    });
    assert.equal(result, null);
});

test("resolveCanonical resolves cross-id from imdb via the identity map", async () => {
    const fakeMap = {
        records: { "1": { kitsu: "1", anilist: "21", anidb: "69", imdb: "tt0388629", sourceType: "TV" } },
        indexes: { byImdb: { "tt0388629": ["1"] } },
        episodeMappings: {}
    };
    const fakeMeta = { id: "anilist:21", name: "ONE PIECE", englishName: "ONE PIECE", synonyms: [], episodes: 1100, releaseInfo: "1999" };

    const result = await resolveCanonical("tt0388629:1:5", {
        loadMap: () => fakeMap,
        fetchAnilistMeta: async () => fakeMeta
    });

    assert.ok(result);
    assert.equal(result.canonical.anilist, "21");
    assert.equal(result.season, 1);
    assert.equal(result.episode, 5);
    assert.equal(result.canonical.resolvedFrom, "imdb");
});
