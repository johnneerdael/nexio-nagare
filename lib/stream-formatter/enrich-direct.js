const { containerFromUrl, cdnHostFromUrl, languageCode3 } = require("./human-format");

function splitServer(provider, server) {
    const raw = String(server || "").trim();
    if (raw.includes("/")) {
        const [family, instance] = raw.split("/", 2);
        return { family: family.trim() || provider.displayName, instance: instance.trim() };
    }
    return { family: provider.displayName, instance: raw || provider.displayName.toLowerCase() };
}

function enrichDirectStream({ provider, providerStream, canonical, episode, season, match }) {
    const { family, instance } = splitServer(provider, providerStream.server);
    const isDub = providerStream.dub === true;
    const subs = Array.isArray(providerStream.subtitles) ? providerStream.subtitles : [];

    return {
        source: {
            providerId: provider.id,
            providerDisplay: provider.displayName,
            providerHost: provider.displayHost || provider.id,
            serverFamily: family,
            serverInstance: instance,
            cdnHost: cdnHostFromUrl(providerStream.url),
            container: containerFromUrl(providerStream.url),
            quality: providerStream.quality || "auto",
            sizeBytes: Number.isFinite(providerStream.sizeBytes) ? providerStream.sizeBytes : null,
            bitrate: Number.isFinite(providerStream.bitrate) ? providerStream.bitrate : null,
            duration: Number.isFinite(providerStream.duration) ? providerStream.duration : null,
            isHardSub: subs.length === 0
        },
        track: {
            kind: isDub ? "dub" : "sub",
            audioLanguage: isDub ? "ENG" : "JPN",
            subtitleTracks: subs.map(s => ({
                src: s.src,
                label: s.label || "Unknown",
                lang: languageCode3(s.label || ""),
                format: (s.src || "").match(/\.(vtt|srt|ass|ssa)/i)?.[1]?.toLowerCase() || "vtt"
            }))
        },
        canonical: {
            anilistId: canonical.anilist || null,
            malId: canonical.mal || null,
            anidbId: canonical.anidb || null,
            kitsuId: canonical.kitsu || null,
            imdbId: canonical.imdb || null,
            mainTitle: canonical.mainTitle || null,
            englishTitle: canonical.englishTitle || canonical.mainTitle || null,
            year: canonical.year || null,
            format: canonical.format || null,
            episodeCount: canonical.episodeCount || null,
            episodeTitle: canonical.episodeTitle || null,
            episodeAirDate: canonical.episodeAirDate || null,
            season: season,
            episode: episode,
            runtimeMinutes: canonical.runtimeMinutes || null
        },
        match: {
            score: match?.score ?? null,
            confidence: match?.confidence || "UNKNOWN",
            reasons: Array.isArray(match?.reasons) ? match.reasons : [],
            source: match?.source || "match"
        }
    };
}

module.exports = { enrichDirectStream };
