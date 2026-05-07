const { dubGlyph, humanQuality } = require("./human-format");

function syntheticFilename(enriched) {
    const c = enriched.canonical;
    const s = enriched.source;
    const dubTag = enriched.track.kind === "dub" ? " DUB" : "";
    const ext = s.container === "MP4" ? "mp4" : "m3u8";
    const title = c.englishTitle || c.mainTitle || "Anime";
    return `[${enriched.source.providerDisplay}] ${title} - S${c.season}E${c.episode} [${humanQuality(s.quality)} ${s.container}${dubTag}].${ext}`;
}

function formatCrossIds(c) {
    const parts = [];
    if (c.anilistId) parts.push(`anilist:${c.anilistId}`);
    if (c.malId)     parts.push(`mal:${c.malId}`);
    if (c.kitsuId)   parts.push(`kitsu:${c.kitsuId}`);
    if (c.anidbId)   parts.push(`anidb:${c.anidbId}`);
    if (c.imdbId)    parts.push(`imdb:${c.imdbId}`);
    return parts.join(" · ");
}

function formatNagareStream(enriched, base) {
    const s = enriched.source;
    const t = enriched.track;
    const c = enriched.canonical;
    const m = enriched.match;

    const trackTag = dubGlyph(t.kind === "dub");
    const subLangs = t.subtitleTracks.map(st => st.lang).filter(Boolean).join(", ");
    const filename = syntheticFilename(enriched);
    const crossIds = formatCrossIds(c);

    const nameLines = [
        `${humanQuality(s.quality)} · ${s.container}${s.bitrate ? ` · ${Math.round(s.bitrate / 1000)}kbps` : ""}`,
        `🌊 ${s.providerDisplay} · ${s.serverInstance} · ${trackTag}`,
        `Direct stream`
    ];

    const descLines = [];
    descLines.push(`📄 ${filename}`);
    descLines.push(`📡 ${s.providerDisplay} · ${s.providerHost} · server: ${s.serverInstance} (${s.cdnHost})`);
    const canonLine = [
        c.englishTitle || c.mainTitle,
        c.year,
        c.format,
        c.episodeCount ? `${c.episodeCount}ep` : null
    ].filter(Boolean).join(" · ");
    if (canonLine) descLines.push(`🎬 ${canonLine}`);
    if (c.episodeTitle) descLines.push(`📺 S${c.season}E${c.episode} · "${c.episodeTitle}"`);
    descLines.push(`${trackTag}${subLangs ? ` · 📝 ${subLangs}` : ""}`);
    descLines.push(`🌐 Direct stream · no debrid required`);
    if (Number.isFinite(m.score)) {
        descLines.push(`🎯 ${m.confidence} (${m.score}) · ${m.reasons.join(" · ") || m.source}`);
    }
    if (crossIds) descLines.push(`🆔 ${crossIds}`);

    return {
        name: nameLines.join("\n"),
        description: descLines.join("\n"),
        url: base.url,
        behaviorHints: {
            bingeGroup: `nexio_nagare_${s.providerId}_${s.serverInstance}`,
            notWebReady: s.container === "HLS",
            ...(base.headers && Object.keys(base.headers).length > 0 ? {
                proxyHeaders: { request: base.headers, response: base.headers }
            } : {})
        }
    };
}

module.exports = { formatNagareStream, syntheticFilename, formatCrossIds };
