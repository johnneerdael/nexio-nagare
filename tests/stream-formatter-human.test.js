const test = require("node:test");
const assert = require("node:assert/strict");
const { humanQuality, languageFlag, languageCode3, dubGlyph, containerFromUrl, cdnHostFromUrl } = require("../lib/stream-formatter/human-format");

test("humanQuality normalises common forms", () => {
    assert.equal(humanQuality("1080p"), "1080p");
    assert.equal(humanQuality("auto"), "auto");
    assert.equal(humanQuality("multi-quality"), "multi-quality");
    assert.equal(humanQuality(null), "auto");
});

test("languageFlag maps ENG/JPN/etc to flag emoji", () => {
    assert.equal(languageFlag("ENG"), "🇬🇧");
    assert.equal(languageFlag("JPN"), "🇯🇵");
    assert.equal(languageFlag("ESP"), "🇪🇸");
    assert.equal(languageFlag("eng"), "🇬🇧");
    assert.equal(languageFlag(null), "🌐");
});

test("languageCode3 normalises to ISO-639-2", () => {
    assert.equal(languageCode3("English"), "ENG");
    assert.equal(languageCode3("ja"), "JPN");
    assert.equal(languageCode3(null), "UND");
});

test("dubGlyph returns sub vs dub markers", () => {
    assert.equal(dubGlyph(true), "🎙 DUB");
    assert.equal(dubGlyph(false), "📝 SUB");
    assert.equal(dubGlyph(null), "📝 SUB");
});

test("containerFromUrl detects HLS vs MP4", () => {
    assert.equal(containerFromUrl("https://cdn.example.com/master.m3u8"), "HLS");
    assert.equal(containerFromUrl("https://cdn.example.com/video.mp4?t=1"), "MP4");
    assert.equal(containerFromUrl("https://cdn.example.com/video.m3u8?signature=x"), "HLS");
    assert.equal(containerFromUrl(""), "HLS");
});

test("cdnHostFromUrl extracts the bare hostname", () => {
    assert.equal(cdnHostFromUrl("https://cdn.example.com/x.m3u8"), "cdn.example.com");
    assert.equal(cdnHostFromUrl("https://vault-04.uwucdn.top/stream/x"), "vault-04.uwucdn.top");
    assert.equal(cdnHostFromUrl("invalid"), "unknown");
});
