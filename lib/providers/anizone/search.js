//===============
// Anizone search — Livewire-backed.
// Posts {search: query} to /livewire/update, parses the returned HTML
// fragment for `div[wire:key]` cards and harvests slug + title + image.
//===============

const cheerio = require("cheerio");
const { livewire, BASE_URL } = require("./session");

function extractSlug(href) {
    if (!href) return null;
    const m = String(href).match(/\/anime\/([a-zA-Z0-9_-]+)/);
    return m ? m[1] : null;
}

function normaliseHref(href) {
    if (!href) return null;
    return String(href).replace(/^http:\/\//i, "https://").replace(/^\//, BASE_URL + "/");
}

async function searchAnizone(query) {
    if (!query) return [];

    let payload;
    try {
        payload = await livewire({ search: query });
    } catch (e) {
        return [];
    }

    const html = payload?.components?.[0]?.effects?.html || "";
    if (!html) return [];

    const $ = cheerio.load(html);
    const seen = new Set();
    const results = [];

    $("div[wire\\:key]").each((i, el) => {
        const $el = $(el);
        const a = $el.find("a").first();
        const img = $el.find("img").first();
        const href = a.attr("href") || "";
        const slug = extractSlug(href);
        if (!slug || seen.has(slug)) return;
        seen.add(slug);
        const title = img.attr("alt") || $el.find("h2, h3").first().text().trim() || "";
        if (!title) return;
        results.push({
            slug,
            title,
            type: null,
            image: img.attr("src") || "",
            href: normaliseHref(href)
        });
    });

    return results;
}

module.exports = { searchAnizone, extractSlug };
