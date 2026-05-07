const FLAG_BY_CODE = {
    ENG: "🇬🇧", JPN: "🇯🇵", ESP: "🇪🇸", FRE: "🇫🇷", GER: "🇩🇪",
    ITA: "🇮🇹", POR: "🇵🇹", RUS: "🇷🇺", CHI: "🇨🇳", KOR: "🇰🇷",
    HIN: "🇮🇳", ARA: "🇸🇦", DUT: "🇳🇱", POL: "🇵🇱", TUR: "🇹🇷",
    IND: "🇮🇩", VIE: "🇻🇳"
};

const CODE_BY_LABEL = {
    english: "ENG", "en-us": "ENG", "en-gb": "ENG", en: "ENG",
    japanese: "JPN", jp: "JPN", ja: "JPN",
    spanish: "ESP", es: "ESP",
    french: "FRE", fr: "FRE",
    german: "GER", de: "GER",
    italian: "ITA", it: "ITA",
    portuguese: "POR", pt: "POR", "pt-br": "POR",
    russian: "RUS", ru: "RUS",
    chinese: "CHI", "zh-cn": "CHI", "zh-tw": "CHI", zh: "CHI",
    korean: "KOR", ko: "KOR",
    hindi: "HIN", hi: "HIN",
    arabic: "ARA", ar: "ARA",
    dutch: "DUT", nl: "DUT",
    polish: "POL", pl: "POL",
    turkish: "TUR", tr: "TUR",
    indonesian: "IND", id: "IND",
    vietnamese: "VIE", vi: "VIE"
};

function humanQuality(q) {
    if (!q) return "auto";
    const t = String(q).trim().toLowerCase();
    if (t === "auto" || t === "multi-quality") return t;
    return String(q);
}

function languageCode3(label) {
    if (!label) return "UND";
    const k = String(label).trim().toLowerCase();
    return CODE_BY_LABEL[k] || k.slice(0, 3).toUpperCase();
}

function languageFlag(label) {
    if (!label) return "🌐";
    const code = /^[A-Z]{3}$/.test(label) ? label : languageCode3(label);
    return FLAG_BY_CODE[code] || "🌐";
}

function dubGlyph(isDub) {
    return isDub === true ? "🎙 DUB" : "📝 SUB";
}

function containerFromUrl(url) {
    const s = String(url || "").toLowerCase();
    if (s.includes(".m3u8")) return "HLS";
    if (s.includes(".mp4")) return "MP4";
    return "HLS";
}

function cdnHostFromUrl(url) {
    try { return new URL(url).hostname; } catch (e) { return "unknown"; }
}

module.exports = {
    humanQuality, languageFlag, languageCode3, dubGlyph,
    containerFromUrl, cdnHostFromUrl
};
