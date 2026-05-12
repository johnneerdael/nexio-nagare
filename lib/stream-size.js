const SIZE_REGEX = /(\d+(?:\.\d+)?)\s*(KiB|MiB|GiB|TiB|KB|MB|GB|TB|B)/i;
const UNIT_BYTES = {
    B: 1,
    KB: 1024,
    MB: 1024 * 1024,
    GB: 1024 * 1024 * 1024,
    TB: 1024 * 1024 * 1024 * 1024,
    KiB: 1024,
    MiB: 1024 * 1024,
    GiB: 1024 * 1024 * 1024,
    TiB: 1024 * 1024 * 1024 * 1024
};

function parseSizeToBytes(value) {
    if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
    const match = SIZE_REGEX.exec(String(value || ""));
    if (!match) return null;
    const size = parseFloat(match[1]);
    const unit = UNIT_BYTES[match[2]] || UNIT_BYTES[match[2].toUpperCase()];
    if (!Number.isFinite(size) || !unit) return null;
    return size * unit;
}

function humanSize(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) return null;
    const units = ["B", "KB", "MB", "GB", "TB"];
    let value = bytes;
    let index = 0;
    while (value >= 1024 && index < units.length - 1) {
        value /= 1024;
        index += 1;
    }
    const formatted = value >= 10 || Number.isInteger(value)
        ? String(Math.round(value))
        : value.toFixed(1).replace(/\.0$/, "");
    return `${formatted} ${units[index]}`;
}

function cleanQualityLabel(value) {
    const withoutSize = String(value || "").replace(/\(\s*\d+(?:\.\d+)?\s*(?:KiB|MiB|GiB|TiB|KB|MB|GB|TB|B)\s*\)/ig, " ");
    const resolution = withoutSize.match(/\b(?:4320p|2160p|1440p|1080p|720p|480p|360p|240p)\b/i);
    if (resolution) return resolution[0];
    const cleaned = withoutSize.replace(/\s+/g, " ").trim();
    return cleaned || "auto";
}

function splitQualityAndSize(value) {
    return {
        quality: cleanQualityLabel(value),
        sizeBytes: parseSizeToBytes(value)
    };
}

function sizeBytesFromStreamCandidate(candidate) {
    if (!candidate || typeof candidate !== "object") return null;
    const keys = ["sizeBytes", "size_bytes", "fileSize", "filesize", "downloadSize", "download_size", "size"];
    for (const key of keys) {
        const parsed = parseSizeToBytes(candidate[key]);
        if (parsed) return parsed;
    }
    return parseSizeToBytes(candidate.quality || candidate.label || candidate.name);
}

module.exports = {
    humanSize,
    parseSizeToBytes,
    sizeBytesFromStreamCandidate,
    splitQualityAndSize
};
