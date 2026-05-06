//===============
// URL → extractor router.
//
// `resolveExtractor(url)` returns `{ name, extract }` or null.
// `extract(url, { referer })` is the async function the provider calls.
//
// Each entry in PATTERNS lists the host substrings (case-insensitive) that
// route to that extractor. Substrings, not full domain matches — many of
// these hosts have dozens of mirrors with shifting TLDs (streamwish.to,
// streamwish.site, hlswish.com, …) but they all share the same player.
//
// ADDING A NEW EXTRACTOR:
//   1. Implement it as `(url, { referer }) => Promise<StreamResult[]>` where
//      StreamResult matches lib/providers/base.js (url + headers required).
//   2. Add an entry below with the host substrings it handles.
//   3. Add a unit test in tests/extractors-*.test.js (use a recorded HTML
//      fixture; do NOT hit the live host in CI).
//===============

const { streamwish } = require("./streamwish");
const { filemoon } = require("./filemoon");
const { vtbe } = require("./vtbe");
const { streamsb } = require("./streamsb");
const { animenosubAes } = require("./animenosub-aes");
const { byse } = require("./byse");
const { megaplay } = require("./megaplay");

const PATTERNS = [
    {
        name: "MegaPlay",
        extract: megaplay,
        hosts: ["megaplay.", "vidwish."]
    },
    {
        name: "Byse",
        extract: byse,
        // Byse rotates host names regularly; the URL path always ends in /e/<id>
        // so we match on the structural fingerprint. The pattern matcher is
        // host-substring-based — we widen with the most-seen mirrors.
        hosts: [
            "bysesayeveum.", "byse.", "byse-frontend.", "z-o-o-m.eu",
            // Add new mirrors here as they're observed.
        ]
    },
    {
        name: "StreamWish",
        extract: streamwish,
        hosts: [
            "streamwish.", "wishfast.", "swiftplayers.", "embedwish.", "sfastwish.",
            "hlswish.", "wishonly.", "wishembed.", "kswplayer.", "strwish.",
            "flaswish.", "awish.", "obeywish.", "jodwish.", "swhoi.",
            "multimovies.", "uqloads.", "doodporn.", "cdnwish.", "asnwish.",
            "nekowish.", "neko-stream.", "swdyu.", "playerwish.", "streamhls.",
            "mwish.", "dwish.", "ewish."
        ]
    },
    {
        name: "Filemoon",
        extract: filemoon,
        hosts: [
            "filemoon.", "filesim.", "files.im", "guccihide.", "ahvsh.",
            "moviesm4u.", "streamhide.", "movhide.", "ztreamhub."
        ]
    },
    {
        name: "Vtbe",
        extract: vtbe,
        hosts: ["vtbe."]
    },
    {
        name: "StreamSB",
        extract: streamsb,
        hosts: [
            "waaw.", "sblona.", "lvturbo.", "sbrapid.", "sbface.", "sbsonic.",
            "vidgomunimesb.", "sbasian.", "sbnet.", "keephealth.", "sbspeed.",
            "streamsss.", "sbflix.", "vidgomunime.", "sbthe.", "ssbstream.",
            "sbfull.", "sbplay1.", "sbplay2.", "sbplay3.", "cloudemb.",
            "sbplay.", "embedsb.", "pelistop.", "streamsb.", "sbplay.one",
            "sbbrisk.", "sblongvu.", "watchsb."
        ]
    },
    {
        name: "Animenosub",
        extract: animenosubAes,
        hosts: ["animenosub.", "animenosub.upn"]
    }
];

function hostnameOf(url) {
    try { return new URL(url).hostname.toLowerCase(); }
    catch (e) { return String(url || "").toLowerCase(); }
}

function resolveExtractor(url) {
    if (!url) return null;
    const host = hostnameOf(url);
    for (const pattern of PATTERNS) {
        for (const needle of pattern.hosts) {
            if (host.includes(needle)) return { name: pattern.name, extract: pattern.extract };
        }
    }
    return null;
}

async function extract(url, opts = {}) {
    const e = resolveExtractor(url);
    if (!e) return [];
    try {
        const result = await e.extract(url, opts);
        return Array.isArray(result) ? result : [];
    } catch (err) {
        return [];
    }
}

module.exports = {
    PATTERNS,
    extract,
    resolveExtractor
};
