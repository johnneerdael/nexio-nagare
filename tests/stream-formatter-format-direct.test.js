const test = require("node:test");
const assert = require("node:assert/strict");
const { formatNagareStream } = require("../lib/stream-formatter/format-direct");

const ENRICHED = {
    source: {
        providerId: "gojo", providerDisplay: "Gojo", providerHost: "animetsu.live",
        serverFamily: "Gojo", serverInstance: "pahe", cdnHost: "mega-cloud.top",
        container: "HLS", quality: "1080p", bitrate: null, duration: null, isHardSub: false
    },
    track: {
        kind: "sub", audioLanguage: "JPN",
        subtitleTracks: [
            { src: "https://x/eng.vtt", label: "English", lang: "ENG", format: "vtt" },
            { src: "https://x/jpn.vtt", label: "Japanese", lang: "JPN", format: "vtt" }
        ]
    },
    canonical: {
        anilistId: "21", malId: "21", anidbId: "69", kitsuId: "12", imdbId: "tt0388629",
        mainTitle: "ONE PIECE", englishTitle: "ONE PIECE", year: 1999, format: "TV",
        episodeCount: 1100, episodeTitle: "Romance Dawn", episodeAirDate: null,
        season: 1, episode: 1, runtimeMinutes: 24
    },
    match: { score: 200, confidence: "HIGH", reasons: ["+200 anilist_id_exact (21)"], source: "match" }
};

test("formatNagareStream emits a parser-friendly name + description", () => {
    const out = formatNagareStream(ENRICHED, { url: "https://cdn.example.com/x.m3u8", headers: { Referer: "x" } });
    assert.equal(typeof out.name, "string");
    assert.equal(typeof out.description, "string");

    const nameLines = out.name.split("\n");
    assert.equal(nameLines.length, 3);
    assert.match(nameLines[0], /^1080p · HLS/);
    assert.match(nameLines[1], /🌊 Gojo · pahe · 📝 SUB/);
    assert.equal(nameLines[2], "Direct stream");

    const desc = out.description;
    assert.match(desc, /📄 \[Gojo\] ONE PIECE - S1E1 \[1080p HLS\]\.m3u8/);
    assert.match(desc, /📡 Gojo · animetsu\.live · server: pahe \(mega-cloud\.top\)/);
    assert.match(desc, /🎬 ONE PIECE · 1999 · TV · 1100ep/);
    assert.match(desc, /📺 S1E1 · "Romance Dawn"/);
    assert.match(desc, /📝 ENG, JPN/);
    assert.match(desc, /🌐 Direct stream · no debrid required/);
    assert.match(desc, /🎯 HIGH \(200\) · \+200 anilist_id_exact \(21\)/);
    assert.match(desc, /🆔 anilist:21 · mal:21 · kitsu:12 · anidb:69 · imdb:tt0388629/);
});

test("formatNagareStream omits 📺 line when episodeTitle is null", () => {
    const noTitle = { ...ENRICHED, canonical: { ...ENRICHED.canonical, episodeTitle: null } };
    const out = formatNagareStream(noTitle, { url: "https://x/y.m3u8", headers: {} });
    assert.doesNotMatch(out.description, /📺 /);
});

test("formatNagareStream uses 🎙 DUB on dub track", () => {
    const dub = { ...ENRICHED, track: { ...ENRICHED.track, kind: "dub", audioLanguage: "ENG" } };
    const out = formatNagareStream(dub, { url: "https://x/y.m3u8", headers: {} });
    assert.match(out.name, /🎙 DUB/);
    assert.match(out.description, /\[Gojo\] ONE PIECE - S1E1 \[1080p HLS DUB\]/);
});
