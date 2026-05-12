const test = require("node:test");
const assert = require("node:assert/strict");

const { parseEmbedButtonsHtml } = require("../lib/providers/animepahe/stream");
const { shapeOppai } = require("../lib/providers/gojo/stream");

test("AnimePahe buttons expose published download sizes", () => {
    const buttons = parseEmbedButtonsHtml(`
        <div id="resolutionMenu">
            <button data-src="https://kwik.cx/e/abc">SubsPlease · 1080p (224MB)</button>
        </div>
    `);

    assert.equal(buttons.length, 1);
    assert.equal(buttons[0].quality, "1080p");
    assert.equal(buttons[0].sizeBytes, 224 * 1024 * 1024);
});

test("Gojo sources expose published download sizes from quality labels", () => {
    const streams = shapeOppai({
        sources: [{ quality: "1080p (122MB) Eng", url: "/oppai/x.m3u8" }],
        subs: []
    }, "yameii", true);

    assert.equal(streams.length, 1);
    assert.equal(streams[0].quality, "1080p");
    assert.equal(streams[0].sizeBytes, 122 * 1024 * 1024);
});
