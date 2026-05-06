//===============
// Gojo (animetsu.live) search.
// Endpoint: GET https://animetsu.live/v2/api/anime/search/?query=<title>
//
// The response carries each candidate's AniList ID directly as `id`. We expose
// it in the provider SearchResult as `extId.anilist`, which lets
// lib/normalizer/match.js take the AniList-ID-exact-match fast path:
// no details fetch, no gates, instant HIGH-confidence match for any anime
// Gojo has indexed.
//===============

const http = require("../http");

const BASE_URL = "https://animetsu.live";
const API_URL = BASE_URL + "/v2/api/anime";
const HEADERS = {
    "Origin": BASE_URL,
    "Referer": BASE_URL + "/",
    "Accept": "application/json"
};

async function searchGojo(query) {
    if (!query) return [];
    let payload;
    try {
        const r = await http.get(`${API_URL}/search/?query=${encodeURIComponent(query)}`, {
            timeout: 10000,
            headers: HEADERS
        });
        payload = r.data;
    } catch (e) {
        return [];
    }
    const results = Array.isArray(payload && payload.results) ? payload.results : [];
    return results.map(item => {
        if (!item || !item.id) return null;
        const titleObj = item.title || {};
        const title = titleObj.english || titleObj.romaji || titleObj.native || "";
        if (!title) return null;
        // Gojo's `id` is a Mongo ObjectID — needed for /eps/ and /oppai/. The
        // AniList ID is embedded in the AniList CDN cover/banner URLs that
        // Gojo proxies, e.g. `.../banner/21-<hash>.jpg` for One Piece.
        const slug = String(item.id);
        const image = (item.cover_image && (item.cover_image.medium || item.cover_image.large)) || "";
        const banner = item.banner || "";
        const aniListId = extractAniListIdFromAnilistCdn(image) || extractAniListIdFromAnilistCdn(banner);
        return {
            slug,
            title,
            image,
            type: null,
            // Carry every piece of metadata Gojo gives us. The matcher's
            // fast path keys off extId.anilist so this short-circuits to
            // HIGH the moment AniList ID matches.
            format: normaliseFormat(item.format),
            year: Number.isFinite(item.year) ? item.year : null,
            episodeCount: Number.isFinite(item.total_eps) && item.total_eps > 0 ? item.total_eps : null,
            extId: { anilist: aniListId, mal: null }
        };
    }).filter(Boolean);
}

function extractAniListIdFromAnilistCdn(url) {
    if (!url) return null;
    // covers: bx<id>-<hash>.jpg ; banners: <id>-<hash>.jpg
    const cover = url.match(/\/cover\/[a-z]+\/bx?(\d+)/i);
    if (cover) return cover[1];
    const banner = url.match(/\/banner\/(\d+)-/);
    return banner ? banner[1] : null;
}

function normaliseFormat(f) {
    if (!f) return null;
    const u = String(f).toUpperCase();
    if (u === "MOVIE") return "MOVIE";
    if (u === "TV" || u === "TV_SHORT") return "TV";
    if (u === "OVA") return "OVA";
    if (u === "SPECIAL") return "SPECIAL";
    if (u === "ONA") return "ONA";
    if (u === "MUSIC") return "MUSIC";
    return null;
}

module.exports = { searchGojo, API_URL, BASE_URL, HEADERS };
