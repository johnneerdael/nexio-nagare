<p align="center">
  <img src="https://raw.githubusercontent.com/johnneerdael/nexio-nagare/main/static/nexio-nagare.png" width="420" alt="Nexio Nagare">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Nexio-Addon-8a5a9e?style=for-the-badge&logo=nexio" alt="Nexio Addon">
  <img src="https://img.shields.io/badge/Stremio-Addon-8a5a9e?style=for-the-badge&logo=stremio" alt="Stremio Addon">
  <img src="https://img.shields.io/badge/GHCR-Ready-2496ED?style=for-the-badge&logo=docker" alt="GHCR Ready">
  <img src="https://img.shields.io/badge/License-MIT-blue?style=for-the-badge" alt="License MIT">
</p>

#  🌊 Nexio Nagare
Nexio Nagare is the direct-stream sibling of Nexio Torii (https://github.com/johnneerdael/nexio-torii). Where Torii brings you anime through torrent search and premium unlockers, Nagare delivers direct HLS streams from public anime sites — no debrid account, no torrent client, no addon-side data path. Developed for [NEXIO](https://github.com/johnneerdael/nexio) supported by [Stremio](https://www.stremio.com/)

It's built for users who want a "click and play" experience on Stremio with full control over which sources they pull from, and a strict no-false-positive matcher that drops doubtful candidates rather than serving the wrong show.

## What it does well:
### 🎯 **Multi-axis matcher, no false positives** 
Every candidate is gated against AniList canonical metadata on five axes — format (TV vs MOVIE/OVA), year (±5y window), episode-count plausibility, title-distance (length-aware Levenshtein), and recap-tag detection. Wrong-show / wrong-year / recap-movie matches are dropped before they reach the player. Drop > guess.
### 🔗 **Five English-anime providers, default-on, all toggleable**
- 123anime.la — sub/dub, vidstreaming-backed
- Anizone.to — subbed, multi-language subtitle tracks (<media-player> direct HLS)
- Animenosub.to — airing-show-focused, Byse (AES-256-GCM) + MegaPlay extractors
- AnimePahe.pw — sub/dub, Kwik-extracted HLS, full-catalogue (no episode cap)
- Gojo / Animetsu.live — AniList-ID-native, multi-server, multi-quality, sub+dub
### 🧠 **AniList-ID-native fast path** 
Providers that surface AniList IDs directly (Gojo, AllAnime when bypass-able) get a zero-cost matcher shortcut — identity is proven without title fuzz, slug cache, or details fetch.
### 📚 **Daily-refreshed identity map** 
Fribb's anime-lists (https://github.com/Fribb/anime-lists) JSON + the Scudlee (https://github.com/Anime-Lists/anime-lists) episode-offset XML are merged on container boot and refreshed every 24h. ~13 000 anime indexed offline by AniList / AniDB / MAL / Kitsu / TMDB / IMDB cross-IDs — Stremio requests in any of those forms route to the correct AniList ID without an extra network hop.
### 🛡️  **Hand-mapped overrides** 
data/overrides.json ships canonical mappings for popular shows where automatic matching would otherwise pick a recap movie, dub-only variant, or fan-redub. Users can add a data/overrides.user.json for their own personal corrections.
### 📝 **Subtitle pass-through** 
Provider-supplied subtitle tracks (Anizone's multi-language, Animenosub's English captions, Gojo's VTT) flow into Stremio's subtitles array with ISO 639-2 language codes mapped automatically.
### 🔒 **Stateless configuration, no data path** 
No user database. Your provider toggles + preferences are encoded into your private Stremio manifest URL. Stream URLs are returned with proxyHeaders so the Stremio player fetches directly from the upstream CDN — Nexio Nagare never touches the stream bytes.

## Important notes:
- The matcher's "drop on uncertainty" stance means a query may legitimately return zero streams from a provider that doesn't index the title or season-split version. Stremio aggregates from multiple addons — pair Nagare with another addon if you want belt-and-suspenders coverage on long-tail / niche titles.
- Long-running shows (e.g. One Piece 1100+) may have slightly slower cold-path resolution because some providers cap their visible-episode window. Slug +  detail caches (90d / 24h) make warm-path requests near-instant.
- Per-episode IMDB IDs (e.g. tt1322867) are intentionally NOT resolved — they're not in any cross-ID feed, and Stremio normally sends tt<seriesId>:<season>:<episode> instead.

## Attribution:
Nexio Nagare is a sibling project to Nexio Torii (https://github.com/johnneerdael/nexio-torii) (which itself builds on the Amatsu project). The provider-extraction logic draws on three open-source predecessors:
- Saadiq8149/AnilistStream (https://github.com/Saadiq8149/AnilistStream) — AllAnime extractor reference
- frostnova721/animestream (https://github.com/frostnova721/animestream) — Kwik / AnimePahe / Gojo provider patterns
- phisher98/cloudstream-extensions-phisher (https://github.com/phisher98/cloudstream-extensions-phisher) — MegaPlay, StreamWish, Filemoon, Vtbe,
  StreamSB, Animenosub-AES extractors

Identity-graph data: Fribb/anime-lists (https://github.com/Fribb/anime-lists) and Anime-Lists/anime-lists (https://github.com/Anime-Lists/anime-lists) (Scudlee).

Source code:
https://github.com/johnneerdael/nexio-nagare
