//===============
// Animenosub episode resolution → direct M3U8 via the shared extractor library.
//
// Two-step:
//   1. Load /anime/{slug}/ → find the episode {ep} link in `div.eplister > ul > li`.
//      Animenosub's episode URLs are full slug-style paths like
//      "/one-piece-episode-1155-english-dub/" — we cannot synthesise them.
//   2. Load that episode page → enumerate `.mobius option`. Each option's value
//      is base64-encoded HTML containing an `<iframe src="...">`. Decode every
//      option, dispatch the iframe URL through lib/extractors.extract().
//
// Returns an array of provider StreamResults (any provider/server combination
// that the extractor library was able to resolve). Skips options whose host
// isn't covered (e.g. Vidmoly behind Cloudflare Turnstile).
//===============

const cheerio = require("cheerio");
const http = require("../http");
const { BASE_URL } = require("./search");
const { extract: extractFromUrl, resolveExtractor } = require("../../extractors");

function fixIframeUrl(raw) {
    if (!raw) return null;
    if (raw.startsWith("//")) return "https:" + raw;
    if (raw.startsWith("/")) return BASE_URL + raw;
    return raw;
}

async function findEpisodeUrl(slug, episode) {
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
    const ep = parseInt(episode, 10);

    // Episode list items typically contain an "Episode <N>" label or the number
    // is encoded into the slug itself. We match both.
    let found = null;
    $("div.eplister > ul > li a").each((i, el) => {
        if (found) return;
        const $a = $(el);
        const href = $a.attr("href") || "";
        const titleText = $a.find("div.epl-title, .epl-num").text();
        const numFromTitle = titleText.match(/(?:Episode|EP)\s*(\d+)/i)?.[1];
        const numFromSlug = href.match(/-episode-(\d+)/i)?.[1];
        const found_ep = parseInt(numFromTitle || numFromSlug || "0", 10);
        if (found_ep === ep) found = href;
    });
    return found;
}

function extractIframeUrls(episodeHtml) {
    const $ = cheerio.load(episodeHtml);
    const urls = [];
    $(".mobius option").each((i, el) => {
        const value = $(el).attr("value") || "";
        if (!value || value.length < 8) return;
        let decoded;
        try {
            decoded = Buffer.from(value, "base64").toString("utf8");
        } catch (e) { return; }
        const m = decoded.match(/<iframe[^>]+src=["']([^"']+)["']/i);
        if (m) urls.push(fixIframeUrl(m[1]));
    });
    return urls.filter(Boolean);
}

//===============
// Some episodes (especially older ones) wrap the real iframe in an
// Animenosub-internal `/play.php` redirect. We follow that one extra hop and
// extract the nested iframe URL.
//===============
async function unwrapPlayPhp(url) {
    if (!url || !/animenosub\.to\/play\.php/i.test(url)) return url;
    try {
        const r = await http.get(url, {
            timeout: 10000,
            headers: { "Referer": `${BASE_URL}/`, "Accept-Language": "en-US,en;q=0.5" }
        });
        const $ = cheerio.load(r.data);
        const inner = $("iframe").first().attr("src");
        return fixIframeUrl(inner) || url;
    } catch (e) {
        return url;
    }
}

async function getStreamsAnimenosub(slug, episode) {
    if (!slug || !episode) return [];
    const ep = parseInt(episode, 10);
    if (!Number.isFinite(ep) || ep < 1) return [];

    const episodeUrl = await findEpisodeUrl(slug, ep);
    if (!episodeUrl) return [];

    let html;
    try {
        const r = await http.get(episodeUrl, {
            timeout: 12000,
            headers: { "Referer": `${BASE_URL}/anime/${slug}/`, "Accept-Language": "en-US,en;q=0.5" }
        });
        html = String(r.data || "");
    } catch (e) {
        return [];
    }

    const rawUrls = extractIframeUrls(html);
    if (rawUrls.length === 0) return [];

    // Unwrap any animenosub /play.php hop, then dispatch via the extractor lib.
    const iframeUrls = await Promise.all(rawUrls.map(unwrapPlayPhp));

    const out = await Promise.all(iframeUrls.map(async iframeUrl => {
        if (!resolveExtractor(iframeUrl)) return [];
        return extractFromUrl(iframeUrl, { referer: episodeUrl });
    }));

    return out.flat();
}

module.exports = { getStreamsAnimenosub, findEpisodeUrl, extractIframeUrls, unwrapPlayPhp };
