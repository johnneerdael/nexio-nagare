//===============
// Anizone details — plain HTML scrape of /anime/<slug>.
// The detail page exposes 4 row-line spans in order:
//   [0] format    → "TV Series" | "Movie" | "OVA" | "Special" | "Web"
//   [1] status    → "Completed" | "Ongoing"
//   [2] episodes  → "<N> Episodes"
//   [3] year      → "<YYYY>"
//===============

const cheerio = require("cheerio");
const axios = require("axios");
const { BASE_URL, UA } = require("./session");

function normaliseFormat(rowText) {
    if (!rowText) return null;
    const t = String(rowText).toLowerCase();
    if (t.includes("movie") || t.includes("film")) return "MOVIE";
    if (t.includes("tv")) return "TV";
    if (t.includes("ova")) return "OVA";
    if (t.includes("special")) return "SPECIAL";
    if (t.includes("ona") || t.includes("web")) return "ONA";
    return null;
}

function parseEpisodeCount(rowText) {
    const m = String(rowText || "").match(/(\d+)\s*Episodes?/i);
    return m ? parseInt(m[1], 10) : null;
}

function parseYear(rowText) {
    const m = String(rowText || "").match(/(19[5-9]\d|20[0-3]\d)/);
    return m ? parseInt(m[1], 10) : null;
}

async function getDetailsAnizone(slug) {
    if (!slug) return null;
    let html;
    try {
        const r = await axios.get(`${BASE_URL}/anime/${slug}`, {
            timeout: 12000,
            headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.5" }
        });
        html = r.data;
    } catch (e) {
        return null;
    }

    const $ = cheerio.load(html);
    const title = $("h1").first().text().trim() || null;
    const rowLines = $("span.inline-block").slice(0, 6).map((i, el) => $(el).text().trim()).get();

    return {
        slug,
        title,
        format: normaliseFormat(rowLines[0]),
        episodeCount: parseEpisodeCount(rowLines[2]),
        year: parseYear(rowLines[3]),
        synonyms: [],
        type: null
    };
}

module.exports = { getDetailsAnizone, normaliseFormat, parseEpisodeCount, parseYear };
