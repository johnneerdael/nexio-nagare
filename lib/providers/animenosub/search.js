//===============
// Animenosub search — plain Jsoup-style HTML scrape, ported from Phisher's
// Animenosub.kt. Returns { slug, title, image, type } per result.
//===============

const cheerio = require("cheerio");
const http = require("../http");

const BASE_URL = "https://animenosub.to";

function extractSlug(href) {
    if (!href) return null;
    const m = String(href).match(/\/anime\/([a-zA-Z0-9_-]+)/);
    return m ? m[1] : null;
}

async function searchAnimenosub(query) {
    if (!query) return [];

    let html;
    try {
        const r = await http.get(`${BASE_URL}/?s=${encodeURIComponent(query)}`, {
            timeout: 10000,
            headers: { "Accept-Language": "en-US,en;q=0.5" }
        });
        html = String(r.data || "");
    } catch (e) {
        return [];
    }

    const $ = cheerio.load(html);
    const seen = new Set();
    const results = [];

    $("div.listupd > article").each((i, el) => {
        const $el = $(el);
        const a = $el.find("div.bsx > a").first();
        const href = a.attr("href") || "";
        const slug = extractSlug(href);
        if (!slug || seen.has(slug)) return;
        seen.add(slug);

        const title = a.attr("title") || $el.find("h2.entry-title").text().trim() || "";
        if (!title) return;
        const image = a.find("img").attr("src") || a.find("img").attr("data-src") || "";
        const dubBadge = /\bdub\b/i.test(title) ? "dub" : null;

        results.push({
            slug,
            title,
            image,
            type: dubBadge,
            href
        });
    });

    return results;
}

module.exports = { searchAnimenosub, extractSlug, BASE_URL };
