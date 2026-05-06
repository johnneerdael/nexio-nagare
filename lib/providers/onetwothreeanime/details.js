//===============
// 123anime detail-page scraper.
// Adapted from 123anime-api/scrapeanime/AnimeDetails/animedetails.js (extracts
// type/year/status from the meta dl) plus jtitle as a synonym.
//
// 123anime does NOT expose episode count on the detail page (loaded via AJAX
// after pageload, and even out-of-range episode numbers return HTTP 200 with
// a generic player page). So episodeCount is always null. The score module
// compensates via stricter title-similarity scoring and the format/year gates.
//===============

const cheerio = require("cheerio");
const { get } = require("../http");

const BASE_URL = "https://123anime.la";

function normalizeFormatString(typeStr) {
    if (!typeStr) return null;
    const t = String(typeStr).trim().toLowerCase();
    if (t.includes("movie") || t.includes("film")) return "MOVIE";
    if (t.includes("tv")) return "TV";
    if (t.includes("ova")) return "OVA";
    if (t.includes("special")) return "SPECIAL";
    if (t.includes("ona") || t.includes("web")) return "ONA";
    if (t.includes("music")) return "MUSIC";
    return null;
}

function parseYear(text) {
    if (!text) return null;
    const m = String(text).match(/(19\d{2}|20\d{2})/);
    return m ? parseInt(m[1], 10) : null;
}

function dubFromSlug(slug) {
    if (!slug) return null;
    if (/-dub(?:bed)?(?:-|$)/i.test(slug)) return "dub";
    if (/-sub(?:bed)?(?:-|$)/i.test(slug)) return "sub";
    return null;
}

async function getDetails123anime(slug) {
    if (!slug) return null;
    const url = `${BASE_URL}/anime/${encodeURIComponent(slug)}`;

    let html;
    try {
        const { data } = await get(url, { timeout: 10000 });
        html = data;
    } catch (e) {
        return null;
    }

    const $ = cheerio.load(html);
    const title = $("h1.title, h2.title").first().text().trim() || null;
    const jtitle = $("[data-jtitle]").first().attr("data-jtitle") || null;

    const meta = {};
    $("dl.meta dt, dl dt").each((i, el) => {
        const key = $(el).text().trim().toLowerCase().replace(/:$/, "").trim();
        const value = $(el).next("dd").text().trim();
        if (key && value && !meta[key]) meta[key] = value;
    });

    const format = normalizeFormatString(meta.type);
    const year = parseYear(meta.released);
    const status = meta.status ? meta.status.toLowerCase() : null;
    const synonyms = [];
    if (jtitle && jtitle !== title) synonyms.push(jtitle);

    return {
        slug,
        title,
        format,
        year,
        episodeCount: null, // not extractable from 123anime detail page
        status,
        synonyms,
        type: dubFromSlug(slug)
    };
}

module.exports = { getDetails123anime };
