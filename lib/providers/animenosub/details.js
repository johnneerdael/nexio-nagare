//===============
// Animenosub detail-page scrape.
// `.spe span` exposes labelled rows: Status:, Studio:, Released:, Duration:,
// Season:, Type:, Episodes: — we extract the four we need for the matcher.
//===============

const cheerio = require("cheerio");
const http = require("../http");
const { BASE_URL } = require("./search");

function normaliseFormat(typeText) {
    if (!typeText) return null;
    const t = String(typeText).toLowerCase();
    if (t.includes("movie") || t.includes("film")) return "MOVIE";
    if (t === "tv" || t.includes("tv series")) return "TV";
    if (t.includes("ova")) return "OVA";
    if (t.includes("special")) return "SPECIAL";
    if (t.includes("ona") || t.includes("web")) return "ONA";
    return null;
}

function pickValue(rowText, label) {
    // rowText like "Released: 2017" → "2017"
    const re = new RegExp(`^${label}\\s*:\\s*(.*)$`, "i");
    const m = rowText.match(re);
    return m ? m[1].trim() : null;
}

async function getDetailsAnimenosub(slug) {
    if (!slug) return null;

    let html;
    try {
        const r = await http.get(`${BASE_URL}/anime/${encodeURIComponent(slug)}/`, {
            timeout: 12000,
            headers: { "Accept-Language": "en-US,en;q=0.5" }
        });
        html = String(r.data || "");
    } catch (e) {
        return null;
    }

    const $ = cheerio.load(html);
    const title = $("h1.entry-title").first().text().trim() || null;

    const meta = {};
    $(".spe span").each((i, el) => {
        const txt = $(el).text().replace(/\s+/g, " ").trim();
        for (const label of ["Status", "Released", "Type", "Episodes", "Duration", "Season"]) {
            const v = pickValue(txt, label);
            if (v && !meta[label]) meta[label] = v;
        }
    });

    const yearMatch = meta.Released ? meta.Released.match(/(19|20)\d{2}/) : null;

    return {
        slug,
        title,
        format: normaliseFormat(meta.Type),
        year: yearMatch ? parseInt(yearMatch[0], 10) : null,
        episodeCount: meta.Episodes ? parseInt(meta.Episodes, 10) || null : null,
        synonyms: [],
        type: null,
        status: meta.Status ? meta.Status.toLowerCase() : null
    };
}

module.exports = { getDetailsAnimenosub, normaliseFormat, pickValue };
