//===============
// AllAnime GraphQL search.
//
// Endpoint: POST https://api.allanime.day/api
// Headers: must include Referer: https://allmanga.to and a real-browser UA.
// The richer query (lifted from AnilistStream's metadata package) returns
// aniListId/malId/episodeCount/airedStart per result, which lets the matcher
// take the AniList-ID exact-match fast path (no details fetch needed).
//
// For our purposes we serialise a single search result into the SearchResult
// shape: { slug, title, image, type?, aniListId, malId, episodeCount, year, format, extId }.
//===============

const axios = require("axios");

const API_URL = "https://api.allanime.day/api";
const REFERER = "https://allmanga.to";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0";

// `airedStart` is a free-form Object on AllAnime's GraphQL schema (sometimes
// {year, month, date, hour, minute}, sometimes partial). We request it
// without subfield selection and parse defensively below.
const SEARCH_QUERY = `
query ($search: SearchInput, $limit: Int, $translationType: VaildTranslationTypeEnumType, $countryOrigin: VaildCountryOriginEnumType) {
    shows(search: $search, limit: $limit, page: 1, translationType: $translationType, countryOrigin: $countryOrigin) {
        edges {
            _id
            name
            englishName
            nativeName
            thumbnail
            aniListId
            malId
            episodeCount
            airedStart
            type
            status
        }
    }
}`;

function normaliseFormat(typeStr) {
    if (!typeStr) return null;
    const t = String(typeStr).toLowerCase();
    if (t.includes("movie")) return "MOVIE";
    if (t === "tv" || t.includes("tv")) return "TV";
    if (t.includes("ova")) return "OVA";
    if (t.includes("special")) return "SPECIAL";
    if (t.includes("ona") || t.includes("web")) return "ONA";
    if (t.includes("music")) return "MUSIC";
    return null;
}

async function searchAllAnime(query, opts = {}) {
    if (!query) return [];

    const variables = {
        search: { allowAdult: true, allowUnknown: false, query: String(query).toLowerCase() },
        limit: 40,
        translationType: "sub",
        countryOrigin: "ALL"
    };

    let edges;
    try {
        const r = await axios.post(API_URL, { query: SEARCH_QUERY, variables }, {
            timeout: 10000,
            headers: {
                "Content-Type": "application/json",
                "Referer": REFERER,
                "User-Agent": UA
            }
        });
        edges = r.data?.data?.shows?.edges;
    } catch (e) {
        return [];
    }

    if (!Array.isArray(edges)) return [];

    return edges.map(e => {
        const slug = e._id;
        if (!slug) return null;
        const title = e.englishName || e.name || e.nativeName || "";
        if (!title) return null;
        const aniListId = e.aniListId ? String(e.aniListId) : null;
        const malId = e.malId ? String(e.malId) : null;
        const year = (e.airedStart && typeof e.airedStart === "object" && Number.isFinite(e.airedStart.year))
            ? e.airedStart.year
            : null;
        const epCount = (() => {
            const v = parseInt(String(e.episodeCount || "").trim(), 10);
            return Number.isFinite(v) && v > 0 ? v : null;
        })();
        return {
            slug,
            title,
            image: e.thumbnail || "",
            type: null,
            aniListId,
            malId,
            episodeCount: epCount,
            year,
            format: normaliseFormat(e.type),
            extId: { anilist: aniListId, mal: malId }
        };
    }).filter(Boolean);
}

module.exports = { searchAllAnime, API_URL, REFERER, UA };
