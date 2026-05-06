//===============
// 123anime search scraper.
// Adapted from 123anime-api/scrapeanime/Browse/Search/search.js — refactored to
// CommonJS and extended to capture the per-result slug (the upstream version
// only kept title + image, which is not enough for episode lookup).
//===============

const cheerio = require("cheerio");
const { get } = require("../http");

const BASE_URL = "https://123anime.la";

const ITEM_SELECTORS = [
    ".film-list .item",
    ".film_list-wrap .item",
    ".flw-item",
    ".anime-list .item",
    ".items .item"
];

function extractSlugFromHref(href) {
    if (!href) return null;
    const match = href.match(/\/anime\/([^/?#]+)/);
    return match ? match[1] : null;
}

function normalizeImage(image) {
    if (!image) return "";
    if (image.startsWith("http")) return image;
    if (image.startsWith("/")) return BASE_URL + image;
    return BASE_URL + "/" + image;
}

async function search123anime(query) {
    if (!query) return [];
    const url = `${BASE_URL}/search?keyword=${encodeURIComponent(query)}`;

    let html;
    try {
        const { data } = await get(url);
        html = data;
    } catch (e) {
        return [];
    }

    const $ = cheerio.load(html);
    const seen = new Set();
    const results = [];

    for (const selector of ITEM_SELECTORS) {
        const items = $(selector);
        if (items.length === 0) continue;

        items.each((i, el) => {
            const $el = $(el);

            // Slug extraction — try the title link first, then any /anime/ href in the card.
            let slug = extractSlugFromHref($el.find(".name a, .film-name a, .dynamic-name, .title a, h3 a").first().attr("href"));
            if (!slug) {
                $el.find("a[href*='/anime/']").each((_, a) => {
                    if (!slug) slug = extractSlugFromHref($(a).attr("href"));
                });
            }
            if (!slug || seen.has(slug)) return;
            seen.add(slug);

            let title = $el.find(".name a, .film-name a, .dynamic-name, .title a, h3 a").first().text().trim()
                || $el.find("a[data-jtitle]").attr("data-jtitle")
                || $el.find("img").attr("alt")
                || "";
            if (/\(Dub\)/i.test(title)) {
                title = title.replace(/\s*\(Dub\)/i, "").trim() + " (Dub)";
            }
            if (!title) return;

            const imgEl = $el.find(".film-poster img, .poster img, img").first();
            const rawImage = imgEl.attr("data-src") || imgEl.attr("src") || imgEl.attr("data-lazy") || "";
            const image = rawImage.includes("no_poster") ? "" : normalizeImage(rawImage);

            const statusText = $el.find(".dot, .status, .film-infor .fdi-item, .is-sub, .is-dub").first().parent().text().toLowerCase();
            const hasSub = statusText.includes("sub") || $el.find(".is-sub").length > 0 || $el.find("[class*='sub']").length > 0;
            const hasDub = statusText.includes("dub") || $el.find(".is-dub").length > 0 || $el.find("[class*='dub']").length > 0 || /\(dub\)/i.test(title);
            let type = "";
            if (hasDub && !hasSub) type = "dub";
            else if (hasSub && !hasDub) type = "sub";
            else if (hasDub && hasSub) type = "sub/dub";

            const episodeText = $el.find(".fa-tv, .ep-num, .episode, [class*='ep'], .item-head .is-sub").first().parent().text();
            const episodeMatch = episodeText.match(/(\d+)/);
            const episodeCount = episodeMatch ? parseInt(episodeMatch[1], 10) : null;

            results.push({ slug, title, type, image, episodeCount });
        });

        if (results.length > 0) break;
    }

    return results;
}

module.exports = { search123anime };
