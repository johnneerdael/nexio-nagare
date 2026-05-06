//===============
// Lightweight extraction of stream URLs from JwPlayer-style player config blobs
// (whether plain or unpacked). The CloudStream stdlib has a richer
// `JwPlayerHelper` that handles HLS multi-quality and subtitle tracks; here we
// focus on the two patterns that cover ~all anime-host extractor outputs:
//
//   sources:[{file:"<url>" ...
//   {file: "<url>", label: "1080p"}    (in tracks/sources arrays)
//
// Returns an array of { url, quality?, label? } — or [] if nothing found.
//===============

function extractSources(scriptText) {
    if (!scriptText) return [];
    const found = new Map();

    // Primary: `sources: [ { file: "https://...", label: "1080p" }, ... ]`
    // Pull each `{file: "<url>", ...}` object inside any sources:[ ... ] block.
    const sourcesBlock = /sources\s*:\s*\[(.*?)\]/s.exec(scriptText);
    if (sourcesBlock) {
        const inner = sourcesBlock[1];
        const reItem = /\{[^{}]*?file\s*:\s*["']([^"']+)["'][^{}]*?\}/g;
        let m;
        while ((m = reItem.exec(inner))) {
            const url = m[1];
            const item = m[0];
            const labelMatch = /label\s*:\s*["']([^"']+)["']/.exec(item);
            const qualityMatch = /(?:type|quality)\s*:\s*["']([^"']+)["']/.exec(item);
            if (!found.has(url)) {
                found.set(url, {
                    url,
                    label: labelMatch ? labelMatch[1] : null,
                    quality: qualityMatch ? qualityMatch[1] : null
                });
            }
        }
    }

    if (found.size === 0) {
        // Fallback: any inline `file: "https://...m3u8"` or "...mp4"
        const reLoose = /file\s*:\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/gi;
        let m;
        while ((m = reLoose.exec(scriptText))) {
            const url = m[1];
            if (!found.has(url)) found.set(url, { url, label: null, quality: null });
        }
    }

    return [...found.values()];
}

module.exports = { extractSources };
