const test = require("node:test");
const assert = require("node:assert/strict");

const { foldTitle, cleanTitle, normalizeTitle, titleTokens } = require("../lib/normalizer/title");

test("foldTitle folds umlauts and strips diacritics", () => {
    assert.equal(foldTitle("Mädchen"), "Maedchen");
    assert.equal(foldTitle("Café résumé"), "Cafe resume");
    assert.equal(foldTitle("Straße"), "Strasse");
});

test("foldTitle replaces ampersand with 'and'", () => {
    assert.equal(foldTitle("Fruits & Vegetables"), "Fruits and Vegetables");
});

test("normalizeTitle yields a slug-comparable form", () => {
    assert.equal(normalizeTitle("Attack on Titan: Final Season!"), "attackontitanfinalseason");
    assert.equal(normalizeTitle("ONE PIECE"), "onepiece");
    assert.equal(normalizeTitle("Naruto (Dub)"), "narutodub");
});

test("normalizeTitle of equivalent strings is identical", () => {
    assert.equal(normalizeTitle("Demon Slayer: Kimetsu no Yaiba"), normalizeTitle("Demon Slayer Kimetsu no Yaiba"));
});

test("cleanTitle preserves spaces but strips junk", () => {
    assert.equal(cleanTitle("Attack on Titan ♪ The Final Cour ★"), "attack on titan the final cour");
    assert.equal(cleanTitle("  Multiple   spaces  "), "multiple spaces");
});

test("titleTokens returns an array of tokens", () => {
    assert.deepEqual(titleTokens("Attack on Titan"), ["attack", "on", "titan"]);
    assert.deepEqual(titleTokens(""), []);
});
