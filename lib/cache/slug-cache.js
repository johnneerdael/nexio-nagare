//===============
// Slug cache: persistent (anidbId × providerId × dubPref) → slug+confidence.
// Auto-invalidates when getStreams() returns empty for a hit (stale slug → drop).
//===============

const { getDatabase } = require("./database");

const DEFAULT_TTL_MS = 90 * 24 * 60 * 60 * 1000;

function now() {
    return Date.now();
}

function lookupSlug({ anidbId, providerId, dubPref = "sub", db = getDatabase(), ttlMs = DEFAULT_TTL_MS }) {
    if (!anidbId || !providerId) return null;
    const stmt = db.prepare(`
        SELECT slug, confidence, score, cached_at, hits, last_succeeded_at
        FROM slug_cache
        WHERE anidb_id = ? AND provider_id = ? AND dub_pref = ?
    `);
    const row = stmt.get(String(anidbId), providerId, dubPref);
    if (!row) return null;
    if (now() - row.cached_at > ttlMs) return null;
    return row;
}

function recordSlug({ anidbId, providerId, dubPref = "sub", slug, confidence, score = 0, db = getDatabase() }) {
    if (!anidbId || !providerId || !slug || !confidence) return;
    const t = now();
    const stmt = db.prepare(`
        INSERT INTO slug_cache (anidb_id, provider_id, dub_pref, slug, confidence, score, hits, cached_at, last_used_at, last_succeeded_at)
        VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
        ON CONFLICT(anidb_id, provider_id, dub_pref) DO UPDATE SET
            slug = excluded.slug,
            confidence = excluded.confidence,
            score = excluded.score,
            cached_at = excluded.cached_at,
            last_used_at = excluded.last_used_at,
            hits = slug_cache.hits + 1
    `);
    stmt.run(String(anidbId), providerId, dubPref, slug, confidence, score, t, t, t);
}

function markUsed({ anidbId, providerId, dubPref = "sub", succeeded, db = getDatabase() }) {
    if (!anidbId || !providerId) return;
    const t = now();
    const stmt = succeeded
        ? db.prepare("UPDATE slug_cache SET last_used_at = ?, last_succeeded_at = ?, hits = hits + 1 WHERE anidb_id = ? AND provider_id = ? AND dub_pref = ?")
        : db.prepare("UPDATE slug_cache SET last_used_at = ? WHERE anidb_id = ? AND provider_id = ? AND dub_pref = ?");
    if (succeeded) stmt.run(t, t, String(anidbId), providerId, dubPref);
    else stmt.run(t, String(anidbId), providerId, dubPref);
}

function invalidateSlug({ anidbId, providerId, dubPref = "sub", db = getDatabase() }) {
    if (!anidbId || !providerId) return;
    db.prepare("DELETE FROM slug_cache WHERE anidb_id = ? AND provider_id = ? AND dub_pref = ?")
        .run(String(anidbId), providerId, dubPref);
}

module.exports = {
    DEFAULT_TTL_MS,
    invalidateSlug,
    lookupSlug,
    markUsed,
    recordSlug
};
