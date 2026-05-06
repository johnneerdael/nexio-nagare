//===============
// Anizone episode → direct M3U8 + subtitle tracks.
// Episode page exposes `<media-player src="<m3u8>">` directly with optional
// `<track label="..." src="..."/>` children — no extractor library needed.
//===============

const cheerio = require("cheerio");
const axios = require("axios");
const { BASE_URL, UA } = require("./session");

async function getStreamsAnizone(slug, episode) {
    if (!slug || !episode) return [];
    const ep = parseInt(episode, 10);
    if (!Number.isFinite(ep) || ep < 1) return [];

    const url = `${BASE_URL}/anime/${slug}/${ep}`;

    let html;
    try {
        const r = await axios.get(url, {
            timeout: 12000,
            headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.5", "Referer": `${BASE_URL}/` }
        });
        html = r.data;
    } catch (e) {
        return [];
    }

    const $ = cheerio.load(html);
    const player = $("media-player").first();
    const m3u8 = player.attr("src") || "";
    if (!m3u8) return [];

    const sourceName = $("span.truncate").first().text().trim() || "Anizone";
    const subtitles = player.find("track").map((i, el) => ({
        label: $(el).attr("label") || "",
        src: $(el).attr("src") || ""
    })).get().filter(t => t.src);

    return [{
        url: m3u8,
        server: sourceName,
        quality: "auto",
        dub: null,
        headers: { Referer: `${BASE_URL}/` },
        subtitles
    }];
}

module.exports = { getStreamsAnizone };
