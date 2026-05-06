//===============
// Gojo (animetsu.live) episode resolution.
//
// Two-step:
//   1. GET /servers/<aniListId>/<episodeNumber> → list of {id} server entries.
//   2. For each server: GET /oppai/<aniListId>/<episodeNumber>?server=<sid>
//      &source_type=sub|dub → JSON {sources: [{quality, url}], subs: [{lang, url}]}
//   3. URLs prefixed with `/` are relative to the proxy host.
//
// We fetch BOTH sub and dub variants in parallel so the matcher's preferDub
// signal can pick the right tier downstream.
//===============

const http = require("../http");
const { API_URL, HEADERS } = require("./search");

const PROXY_URL = "https://mega-cloud.top/proxy";

function fixRelative(u) {
    if (!u) return u;
    return u.startsWith("/") ? PROXY_URL + u : u;
}

async function fetchServers(aniListId, episode) {
    try {
        const r = await http.get(`${API_URL}/servers/${encodeURIComponent(aniListId)}/${episode}`, {
            timeout: 10000,
            headers: HEADERS
        });
        const arr = Array.isArray(r.data) ? r.data : [];
        return arr.map(s => s && s.id).filter(Boolean);
    } catch (e) {
        return [];
    }
}

async function fetchOppai(aniListId, episode, serverId, sourceType) {
    try {
        const r = await http.get(`${API_URL}/oppai/${encodeURIComponent(aniListId)}/${episode}?server=${encodeURIComponent(serverId)}&source_type=${sourceType}`, {
            timeout: 12000,
            headers: HEADERS
        });
        return r.data || null;
    } catch (e) {
        return null;
    }
}

function shapeOppai(payload, serverId, isDub) {
    if (!payload) return [];
    const sources = Array.isArray(payload.sources) ? payload.sources : [];
    const subsArr = Array.isArray(payload.subs) ? payload.subs : [];
    const subtitles = subsArr
        .filter(s => s && s.url)
        .map(s => ({ src: fixRelative(s.url), label: s.lang || "Unknown" }));

    return sources.filter(s => s && s.url).map(s => {
        const url = fixRelative(s.url);
        const q = s.quality && String(s.quality).trim() === "master" ? "multi-quality" : (s.quality || "auto");
        return {
            url,
            server: `Gojo/${serverId}`,
            quality: q,
            dub: isDub,
            // Subtitles are mostly multilingual; passing through with full set
            subtitles,
            // Stream URLs from animetsu's own CDN don't always need referer, but
            // proxied URLs definitely do.
            headers: { Referer: HEADERS.Referer, Origin: HEADERS.Origin }
        };
    });
}

async function getStreamsGojo(slug, episode) {
    if (!slug) return [];
    const ep = parseInt(episode, 10);
    if (!Number.isFinite(ep) || ep < 1) return [];

    const serverIds = await fetchServers(slug, ep);
    if (serverIds.length === 0) return [];

    const tasks = [];
    for (const sid of serverIds) {
        tasks.push(fetchOppai(slug, ep, sid, "sub").then(p => shapeOppai(p, sid, false)));
        tasks.push(fetchOppai(slug, ep, sid, "dub").then(p => shapeOppai(p, sid, true)));
    }
    const out = await Promise.all(tasks);
    return out.flat();
}

module.exports = { getStreamsGojo, fetchServers, fetchOppai, shapeOppai, fixRelative, PROXY_URL };
