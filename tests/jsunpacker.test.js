const test = require("node:test");
const assert = require("node:assert/strict");

const { detect, unpack, unpackFromHtml } = require("../lib/extractors/jsunpacker");

//===============
// Tiny synthetic packer fixture — exercises radix-36 (no alphabet table needed),
// the most common form for video hosts.
// Encoded `var sources={file:"https://x/master.m3u8"}` with the standard
// p.a.c.k.e.r template, radix 36, count 5.
//   words:  var=0, sources=1, file=2, https=3 (extra to ensure replacement
//           happens on multi-letter tokens)
// Words referenced in payload by their base-36 index (0,1,2,3,4).
//===============
const PACKED_RADIX36 = "eval(function(p,a,c,k,e,d){e=function(c){return c.toString(a)};if(!''.replace(/^/,String)){while(c--)d[e(c)]=k[c]||e(c);k=[function(e){return d[e]}];e=function(){return'\\\\w+'};c=1};while(c--)if(k[c])p=p.replace(new RegExp('\\\\b'+e(c)+'\\\\b','g'),k[c]);return p}('0 1={2:\"3://x/master.m3u8\"}',36,5,'var|sources|file|https|unused'.split('|'),0,{}))";

test("detect identifies p.a.c.k.e.r-encoded source", () => {
    assert.equal(detect(PACKED_RADIX36), true);
    assert.equal(detect("var x = 1;"), false);
    assert.equal(detect(""), false);
    assert.equal(detect(null), false);
});

test("unpack decodes a radix-36 packed payload", () => {
    const out = unpack(PACKED_RADIX36);
    assert.ok(out, "expected unpack output");
    assert.match(out, /var sources/);
    assert.match(out, /file:"https:\/\/x\/master\.m3u8"/);
});

test("unpack returns null for non-packed input", () => {
    assert.equal(unpack("nothing here"), null);
    assert.equal(unpack(""), null);
});

test("unpackFromHtml extracts and unpacks the payload from a script tag", () => {
    const html = `<html><body>
        <script>console.log("noop")</script>
        <script>${PACKED_RADIX36}</script>
        <script>otherStuff()</script>
    </body></html>`;
    const out = unpackFromHtml(html);
    assert.ok(out);
    assert.match(out, /file:"https:\/\/x\/master\.m3u8"/);
});

test("unpackFromHtml returns null when no packed script is present", () => {
    assert.equal(unpackFromHtml("<html><script>var x=1</script></html>"), null);
});
