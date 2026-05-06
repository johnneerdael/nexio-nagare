//===============
// AnimePahe episode resolution.
//
// Three-step:
//   1. /api?m=release&id=<session>&sort=episode_asc&page=N — paginate to find
//      the requested episode. AnimePahe has 30 entries per page; we compute
//      which page contains the target episode and hit that one directly,
//      capping at the first 6 pages (matches animestream's "not worth 40
//      requests" comment for very long shows like One Piece 1100+).
//   2. /play/<anime_session>/<episode_session> → HTML with
//      `div#resolutionMenu > button` carrying data-src attributes that point
//      at Kwik embed URLs. Each button's text is "<server> · <quality>" with
//      "eng" appearing in quality for dub variants.
//   3. Hand each Kwik URL to lib/extractors (which routes to lib/extractors/kwik).
//===============

const cheerio = require("cheerio");
const http = require("../http");
const { BASE_URL, HEADERS } = require("./search");
const { extract: extractFromUrl, resolveExtractor } = require("../../extractors");

const PAGE_SIZE = 30;
const MAX_PAGES = 6;

async function fetchReleasePage(session, page) {
    try {
        const r = await http.get(
            `${BASE_URL}/api?m=release&id=${encodeURIComponent(session)}&sort=episode_asc&page=${page}`,
            { timeout: 12000, headers: HEADERS }
        );
        return r.data;
    } catch (e) {
        return null;
    }
}

async function findEpisodeSession(animeSession, episodeNumber) {
    const targetPage = Math.min(MAX_PAGES, Math.max(1, Math.ceil(episodeNumber / PAGE_SIZE)));
    const payload = await fetchReleasePage(animeSession, targetPage);
    if (!payload || !Array.isArray(payload.data)) return null;
    const hit = payload.data.find(e => Number(e.episode) === episodeNumber);
    if (hit && hit.session) return hit.session;
    // Fallback: last_page may be smaller than expected — try page 1 just in case.
    if (targetPage !== 1) {
        const first = await fetchReleasePage(animeSession, 1);
        if (first && Array.isArray(first.data)) {
            const h2 = first.data.find(e => Number(e.episode) === episodeNumber);
            if (h2 && h2.session) return h2.session;
        }
    }
    return null;
}

async function fetchEmbedButtons(animeSession, episodeSession) {
    const url = `${BASE_URL}/play/${encodeURIComponent(animeSession)}/${encodeURIComponent(episodeSession)}`;
    let html;
    try {
        const r = await http.get(url, { timeout: 12000, headers: HEADERS });
        html = String(r.data || "");
    } catch (e) {
        return [];
    }
    const $ = cheerio.load(html);
    const out = [];
    $("div#resolutionMenu > button").each((i, el) => {
        const $el = $(el);
        const link = $el.attr("data-src") || "";
        if (!link) return;
        const text = $el.text();
        const parts = text.split("·").map(p => p.trim());
        const server = parts[0] || "";
        const quality = parts[1] || "auto";
        const isDub = /\beng\b/i.test(quality);
        out.push({ link, server, quality, isDub });
    });
    return out;
}

async function getStreamsAnimePahe(slug, episode) {
    if (!slug) return [];
    const ep = parseInt(episode, 10);
    if (!Number.isFinite(ep) || ep < 1) return [];

    const episodeSession = await findEpisodeSession(slug, ep);
    if (!episodeSession) return [];

    const buttons = await fetchEmbedButtons(slug, episodeSession);
    if (buttons.length === 0) return [];

    const out = await Promise.all(buttons.map(async b => {
        if (!resolveExtractor(b.link)) return [];
        const result = await extractFromUrl(b.link, { referer: `${BASE_URL}/` });
        return result.map(r => ({
            ...r,
            // override Kwik's defaults with AnimePahe-known values
            quality: b.quality && b.quality !== "auto" ? b.quality : r.quality,
            dub: b.isDub
        }));
    }));

    return out.flat();
}

module.exports = { getStreamsAnimePahe, findEpisodeSession, fetchEmbedButtons };
