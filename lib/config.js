function toBase64Safe(str) {
    return Buffer.from(String(str), "utf8")
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "");
}

function fromBase64Safe(str) {
    try {
        return Buffer.from(String(str || "").replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    } catch (e) {
        return "";
    }
}

function normalizeConfig(raw) {
    const config = raw && typeof raw === "object" ? raw : {};
    const normalized = {
        useEnglishTitles: config.useEnglishTitles !== false,
        showSeasonalSeries: config.showSeasonalSeries !== false,
        showAiringSeries: config.showAiringSeries !== false,
        showTrendingSeries: config.showTrendingSeries !== false,
        showTopSeries: config.showTopSeries !== false,
        showTrendingMovies: config.showTrendingMovies !== false,
        showTopMovies: config.showTopMovies !== false,
        preferDub: Boolean(config.preferDub),
        providers: Array.isArray(config.providers) && config.providers.length > 0
            ? config.providers.filter(v => v != null && v !== "").map(String)
            : null
    };

    if (Array.isArray(config.resolutions) && config.resolutions.length > 0) {
        normalized.resolutions = config.resolutions.filter(v => v != null && v !== "").map(String);
    }

    return normalized;
}

function parseConfig(config) {
    let parsed = {};
    try {
        if (config && config.NexioNagare) {
            const decoded = fromBase64Safe(config.NexioNagare);
            parsed = JSON.parse(decoded);
        } else {
            parsed = config || {};
        }
    } catch (e) {
        parsed = {};
    }
    return normalizeConfig(parsed);
}

function encodeConfigPayload(config) {
    return toBase64Safe(JSON.stringify(normalizeConfig(config)));
}

module.exports = {
    encodeConfigPayload,
    fromBase64Safe,
    normalizeConfig,
    parseConfig,
    toBase64Safe
};
