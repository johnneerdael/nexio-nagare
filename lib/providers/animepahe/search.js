//===============
// AnimePahe search.
// GET https://animepahe.pw/api?m=search&q=<title>
// Required headers: DDG bypass cookie + Referer (matches animestream's pattern).
//
// Response includes title/type/year/episodes/status — ALL the fields the
// matcher needs, in one HTTP call. details() can echo from a search-cache
// hit without an extra round-trip.
//===============

const http = require("../http");

const BASE_URL = "https://animepahe.pw";
const HEADERS = {
    "Cookie": "__ddg1=;__ddg2_=",
    "Referer": BASE_URL + "/",
    "Accept": "application/json"
};

function normaliseFormat(typeStr) {
    if (!typeStr) return null;
    const t = String(typeStr).trim().toUpperCase();
    if (t === "MOVIE") return "MOVIE";
    if (t === "TV") return "TV";
    if (t === "OVA") return "OVA";
    if (t === "SPECIAL") return "SPECIAL";
    if (t === "ONA") return "ONA";
    if (t === "MUSIC") return "MUSIC";
    return null;
}

async function searchAnimePahe(query) {
    if (!query) return [];
    const cleaned = String(query).replace(/-/g, "").trim();

    let payload;
    try {
        const r = await http.get(`${BASE_URL}/api?m=search&q=${encodeURIComponent(cleaned)}`, {
            timeout: 10000,
            headers: HEADERS
        });
        payload = r.data;
    } catch (e) {
        return [];
    }

    const data = Array.isArray(payload && payload.data) ? payload.data : [];
    return data.map(d => {
        if (!d || !d.session) return null;
        return {
            slug: d.session,
            title: d.title || "",
            image: d.poster || "",
            type: null,
            format: normaliseFormat(d.type),
            year: Number.isFinite(d.year) ? d.year : null,
            episodeCount: Number.isFinite(d.episodes) && d.episodes > 0 ? d.episodes : null,
            status: typeof d.status === "string" ? d.status.toLowerCase() : null,
            // AnimePahe doesn't surface AniList/MAL IDs in search. Skipping extId.
            extId: null
        };
    }).filter(Boolean);
}

module.exports = { searchAnimePahe, BASE_URL, HEADERS, normaliseFormat };
