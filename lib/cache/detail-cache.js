//===============
// Detail-page cache: provider_id × slug → JSON payload from provider.details().
// 24h TTL. Detail pages rarely change for a given slug.
//===============

const { getDatabase } = require("./database");

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

function lookupDetails({ providerId, slug, db = getDatabase(), ttlMs = DEFAULT_TTL_MS }) {
    if (!providerId || !slug) return null;
    const row = db.prepare("SELECT payload_json, cached_at FROM detail_cache WHERE provider_id = ? AND slug = ?")
        .get(providerId, slug);
    if (!row) return null;
    if (Date.now() - row.cached_at > ttlMs) return null;
    try {
        return JSON.parse(row.payload_json);
    } catch (e) {
        return null;
    }
}

function recordDetails({ providerId, slug, payload, db = getDatabase() }) {
    if (!providerId || !slug || !payload) return;
    db.prepare(`
        INSERT INTO detail_cache (provider_id, slug, payload_json, cached_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(provider_id, slug) DO UPDATE SET
            payload_json = excluded.payload_json,
            cached_at = excluded.cached_at
    `).run(providerId, slug, JSON.stringify(payload), Date.now());
}

function invalidateDetails({ providerId, slug, db = getDatabase() }) {
    if (!providerId || !slug) return;
    db.prepare("DELETE FROM detail_cache WHERE provider_id = ? AND slug = ?").run(providerId, slug);
}

module.exports = {
    DEFAULT_TTL_MS,
    invalidateDetails,
    lookupDetails,
    recordDetails
};
