//===============
// AniList response cache: anilist_id → JSON payload (full getAnimeMeta result).
// 24h TTL. Wraps lib/anilist.js's in-process LRU with persistence across restarts.
//===============

const { getDatabase } = require("./database");

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

function lookupMeta({ anilistId, db = getDatabase(), ttlMs = DEFAULT_TTL_MS }) {
    if (!anilistId) return null;
    const row = db.prepare("SELECT payload_json, cached_at FROM anilist_cache WHERE anilist_id = ?").get(String(anilistId));
    if (!row) return null;
    if (Date.now() - row.cached_at > ttlMs) return null;
    try {
        return JSON.parse(row.payload_json);
    } catch (e) {
        return null;
    }
}

function recordMeta({ anilistId, payload, db = getDatabase() }) {
    if (!anilistId || !payload) return;
    db.prepare(`
        INSERT INTO anilist_cache (anilist_id, payload_json, cached_at)
        VALUES (?, ?, ?)
        ON CONFLICT(anilist_id) DO UPDATE SET
            payload_json = excluded.payload_json,
            cached_at = excluded.cached_at
    `).run(String(anilistId), JSON.stringify(payload), Date.now());
}

function invalidateMeta({ anilistId, db = getDatabase() }) {
    if (!anilistId) return;
    db.prepare("DELETE FROM anilist_cache WHERE anilist_id = ?").run(String(anilistId));
}

module.exports = {
    DEFAULT_TTL_MS,
    invalidateMeta,
    lookupMeta,
    recordMeta
};
