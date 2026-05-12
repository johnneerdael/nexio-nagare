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
const { splitQualityAndSize } = require("../../stream-size");

const PAGE_SIZE = 30;

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

//===============
// Episodes are returned sorted ascending in pages of PAGE_SIZE. We compute
// which page contains the target episode and request ONLY that page — one
// HTTP no matter how long the show. The earlier 6-page cap was lifted from
// animestream's Dart impl which iterated pages sequentially; we don't need
// it because we direct-page.
//
// `last_page` in the API response acts as our upper bound. If the requested
// episode lives past the last page (a sequel-numbering mismatch, or the show
// hasn't aired that episode yet), we return null cleanly.
//===============
async function findEpisodeSession(animeSession, episodeNumber) {
    const targetPage = Math.max(1, Math.ceil(episodeNumber / PAGE_SIZE));
    const payload = await fetchReleasePage(animeSession, targetPage);
    if (!payload || !Array.isArray(payload.data)) return null;
    const lastPage = Number.isFinite(payload.last_page) ? payload.last_page : targetPage;
    if (targetPage > lastPage) return null;

    const hit = payload.data.find(e => Number(e.episode) === episodeNumber);
    if (hit && hit.session) return hit.session;

    // Defensive fallback: if for some reason the target page doesn't contain
    // our episode (numbering quirk on this slug), scan page 1.
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
    return parseEmbedButtonsHtml(html);
}

function parseEmbedButtonsHtml(html) {
    const $ = cheerio.load(String(html || ""));
    const out = [];
    $("div#resolutionMenu > button").each((i, el) => {
        const $el = $(el);
        const link = $el.attr("data-src") || "";
        if (!link) return;
        const text = $el.text();
        const parts = text.split("·").map(p => p.trim());
        const server = parts[0] || "";
        const parsed = splitQualityAndSize(parts[1] || "auto");
        const isDub = /\beng\b/i.test(text);
        out.push({ link, server, quality: parsed.quality, sizeBytes: parsed.sizeBytes, isDub });
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
            sizeBytes: b.sizeBytes || r.sizeBytes || null,
            dub: b.isDub
        }));
    }));

    return out.flat();
}

module.exports = { getStreamsAnimePahe, findEpisodeSession, fetchEmbedButtons, parseEmbedButtonsHtml };
