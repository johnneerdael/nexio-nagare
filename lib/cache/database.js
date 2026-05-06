const fs = require("node:fs");
const path = require("node:path");
const Database = require("better-sqlite3");

let sharedDatabase = null;

function resolveDbPath(options = {}) {
    return options.dbPath || process.env.CACHE_DB_PATH || path.join(process.cwd(), "data", "nexio-nagare.sqlite");
}

function ensureParentDirectory(filePath) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function initializeDatabase(db) {
    db.pragma("journal_mode = WAL");
    db.pragma("busy_timeout = 5000");
    db.exec(`
        CREATE TABLE IF NOT EXISTS scrape_locks (
            media_key TEXT PRIMARY KEY,
            locked_until INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS empty_searches (
            media_key TEXT PRIMARY KEY,
            updated_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS slug_cache (
            anidb_id   TEXT NOT NULL,
            provider_id TEXT NOT NULL,
            dub_pref   TEXT NOT NULL DEFAULT 'sub',
            slug       TEXT NOT NULL,
            confidence TEXT NOT NULL,
            score      INTEGER NOT NULL DEFAULT 0,
            hits       INTEGER NOT NULL DEFAULT 0,
            cached_at  INTEGER NOT NULL,
            last_used_at INTEGER NOT NULL,
            last_succeeded_at INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (anidb_id, provider_id, dub_pref)
        );

        CREATE TABLE IF NOT EXISTS detail_cache (
            provider_id TEXT NOT NULL,
            slug        TEXT NOT NULL,
            payload_json TEXT NOT NULL,
            cached_at   INTEGER NOT NULL,
            PRIMARY KEY (provider_id, slug)
        );

        CREATE TABLE IF NOT EXISTS anilist_cache (
            anilist_id   TEXT PRIMARY KEY,
            payload_json TEXT NOT NULL,
            cached_at    INTEGER NOT NULL
        );
    `);
}

function getDatabase(options = {}) {
    if (sharedDatabase && sharedDatabase.open) return sharedDatabase;

    const dbPath = resolveDbPath(options);
    ensureParentDirectory(dbPath);
    sharedDatabase = new Database(dbPath);
    initializeDatabase(sharedDatabase);
    return sharedDatabase;
}

function closeDatabaseForTests() {
    if (sharedDatabase && sharedDatabase.open) {
        sharedDatabase.close();
    }
    sharedDatabase = null;
}

module.exports = {
    closeDatabaseForTests,
    getDatabase,
    initializeDatabase,
    resolveDbPath
};
