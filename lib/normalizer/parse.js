//===============
// Light release-title parser for direct-stream provider candidates and canonical
// AniList titles. Inputs in this addon are usually clean (provider page titles
// like "Attack on Titan: The Final Season - The Final Chapters (Dub)" or
// AniList canonical strings) — no fan-sub filename patterns to defeat — so
// regex-based extraction is enough. If a provider ever exposes torrent-style
// titles in its catalog we can layer @viren070/parse-torrent-title on top.
//===============

const SEASON_NUMBER_WORDS = {
    second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8,
    ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8
};

function extractYear(title) {
    const match = String(title || "").match(/\b(19[5-9]\d|20[0-3]\d)\b/);
    return match ? parseInt(match[1], 10) : null;
}

function extractSeason(title) {
    const t = String(title || "");
    const ord = t.match(/\b(\d+)(?:st|nd|rd|th)\s+(?:Season|Part|Cour)\b/i);
    if (ord) return parseInt(ord[1], 10);
    const numeric = t.match(/\b(?:Season|Part|Cour|Dai|Di)\s*0*(\d+)\b/i);
    if (numeric) return parseInt(numeric[1], 10);
    const sxx = t.match(/\bS(\d{1,2})(?:\b|E\d)/i);
    if (sxx) return parseInt(sxx[1], 10);
    const word = t.match(/\b(second|third|fourth|fifth|sixth|seventh|eighth|ii|iii|iv|v|vi|vii|viii)\s+(?:season|part|cour)\b/i);
    if (word) return SEASON_NUMBER_WORDS[word[1].toLowerCase()] || null;
    return null;
}

function extractEpisode(title) {
    const t = String(title || "");
    const epDash = t.match(/\s-\s*(\d{1,4})\b(?!\s*(?:p|bit))/i);
    if (epDash) return parseInt(epDash[1], 10);
    const sxxExx = t.match(/\bS\d{1,2}E(\d{1,4})\b/i);
    if (sxxExx) return parseInt(sxxExx[1], 10);
    const epWord = t.match(/\bEp(?:isode)?\s*0*(\d{1,4})\b/i);
    if (epWord) return parseInt(epWord[1], 10);
    return null;
}

function detectDub(title) {
    const t = String(title || "");
    if (/\(\s*Dub\s*\)|\bdubbed\b/i.test(t)) return true;
    if (/\(\s*Sub\s*\)|\bsubbed\b/i.test(t)) return false;
    return null;
}

function detectFormatHint(title) {
    const t = String(title || "");
    if (/\b(Movie|Film|Gekijouban)\b/i.test(t)) return "MOVIE";
    if (/\bOVA\b/i.test(t)) return "OVA";
    if (/\b(Special|SP)\b/i.test(t)) return "SPECIAL";
    if (/\bONA\b/i.test(t)) return "ONA";
    if (/\b(Recap|Compilation|Summary)\b/i.test(t)) return "RECAP";
    return null;
}

function stripQualifiers(title) {
    return String(title || "")
        .replace(/\(\s*(?:Dub|Sub|Subbed|Dubbed)\s*\)/gi, "")
        .replace(/\s+/g, " ")
        .trim();
}

function parseTitle(title) {
    const raw = String(title || "").trim();
    return {
        raw,
        base: stripQualifiers(raw),
        year: extractYear(raw),
        season: extractSeason(raw),
        episode: extractEpisode(raw),
        dub: detectDub(raw),
        formatHint: detectFormatHint(raw)
    };
}

module.exports = {
    detectDub,
    detectFormatHint,
    extractEpisode,
    extractSeason,
    extractYear,
    parseTitle,
    stripQualifiers
};
