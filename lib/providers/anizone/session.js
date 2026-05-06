//===============
// Anizone Livewire session bootstrap.
//
// Anizone is a Laravel + Livewire app — search runs through a POST to
// /livewire/update with a CSRF token, a snapshot blob from the page, and a
// cookie pair. The snapshot doesn't have to be fresh per request, but it
// does expire (server-side eventually rejects with 419). We cache for
// ANIZONE_SESSION_TTL_MS and re-bootstrap on the next call.
//===============

const cheerio = require("cheerio");
const axios = require("axios");

const BASE_URL = "https://anizone.to";
const ANIZONE_SESSION_TTL_MS = 10 * 60 * 1000;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120";

let cached = null;

async function bootstrap() {
    const r = await axios.get(`${BASE_URL}/anime`, {
        timeout: 12000,
        headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.5" },
        validateStatus: s => s >= 200 && s < 400
    });
    const $ = cheerio.load(r.data);
    const csrf = $("script[data-csrf]").attr("data-csrf") || "";
    const snapshotRaw = $("main div[wire\\:snapshot]").attr("wire:snapshot") || "";
    const snapshot = snapshotRaw.replace(/&quot;/g, '"');
    const cookies = (r.headers["set-cookie"] || []).map(c => c.split(";")[0]).join("; ");

    if (!csrf || !snapshot) throw new Error("anizone: failed to bootstrap (missing csrf/snapshot)");

    return { csrf, snapshot, cookies, fetchedAt: Date.now() };
}

async function getSession({ force = false } = {}) {
    if (!force && cached && Date.now() - cached.fetchedAt < ANIZONE_SESSION_TTL_MS) {
        return cached;
    }
    cached = await bootstrap();
    return cached;
}

function clearSession() {
    cached = null;
}

async function livewire(updates) {
    const session = await getSession();
    const payload = {
        _token: session.csrf,
        components: [{ snapshot: session.snapshot, updates, calls: [] }]
    };
    try {
        const r = await axios.post(`${BASE_URL}/livewire/update`, payload, {
            timeout: 12000,
            headers: {
                "Content-Type": "application/json",
                "Cookie": session.cookies,
                "User-Agent": UA,
                "X-Livewire": "true"
            },
            validateStatus: s => s >= 200 && s < 500
        });
        if (r.status === 419 || r.status === 401 || r.status === 403) {
            // Session expired — bootstrap once more and retry.
            cached = null;
            const session2 = await getSession({ force: true });
            const payload2 = { _token: session2.csrf, components: [{ snapshot: session2.snapshot, updates, calls: [] }] };
            const r2 = await axios.post(`${BASE_URL}/livewire/update`, payload2, {
                timeout: 12000,
                headers: {
                    "Content-Type": "application/json",
                    "Cookie": session2.cookies,
                    "User-Agent": UA,
                    "X-Livewire": "true"
                }
            });
            return r2.data;
        }
        return r.data;
    } catch (e) {
        cached = null;
        throw e;
    }
}

module.exports = { BASE_URL, UA, getSession, clearSession, livewire };
