# Nexio Nagare

A Stremio addon that delivers **direct streams** for anime, sourced from public English-language anime sites. Sibling to [Nexio Torii](https://github.com/johnneerdael/nexio-torii) (torrent-based).

The addon never proxies stream bytes — it returns the upstream M3U8 plus the headers Stremio's player needs to fetch them directly. Less load on the host, fewer moving parts.

## Quick start

```bash
npm install
npm test
npm start
# Configure page: http://127.0.0.1:7002/configure
# Manifest:       http://127.0.0.1:7002/manifest.json
```

Open `/configure` in a browser, pick providers + preferences, click **Install in Stremio**.

## Docker

```bash
docker compose up -d
# addon listens on :7002, persistent cache at the named volume nexio-nagare-cache
```

The container bootstraps the AniList ID identity map (Fribb + Scudlee feeds) on first boot and refreshes daily. Set `SKIP_IDENTITY_REFRESH=1` to defer if you have your own update cadence.

## Architecture

```
lib/
  identity/        anime-map (Fribb+Scudlee feeds) + canonical resolver
  normalizer/      title parse + scoring (length-aware ratio + multi-axis gates)
  extractors/      StreamWish, Filemoon, Vtbe, StreamSB, Animenosub-AES, Byse (AES-256-GCM), MegaPlay + URL router
  providers/       per-site adapters: search → details → getStreams
  cache/           SQLite — slug cache, detail cache, anilist cache, http cache
  dispatch.js      orchestrator: override → cache → search+score → match
  stream-builder.js  emits Stremio stream objects with proxyHeaders
  sub-proxy.js     /sub/<payload>.<ext> endpoint for subtitle CDNs that need Referer
data/
  overrides.json       hand-mapped anilist:X → {provider: slug} for popular cases
  overrides.user.json  optional, gitignored, user-local additions
  anime/               runtime-generated identity-map snapshot
  nexio-nagare.sqlite  caches
scripts/
  identity-refresh.js  npm run identity:refresh
```

## Match-quality strategy: drop > guess

False positives (wrong content delivered) are worse than false negatives (no stream offered). The matcher applies hard gates BEFORE scoring:

| Gate | Rejects | Caught (Wave 2 false positives) |
|---|---|---|
| Format mismatch | TV ≠ MOVIE/OVA when canonical is TV | Demon Slayer recap movie, AoT OVA-dub |
| Year mismatch | abs(diff) ≥ 5 | FMA 2003 vs Brotherhood 2009 |
| Episode count | outside ±30% (when known) | Naruto 220ep vs Naruto Kai 24ep |
| Title distance | normalised Levenshtein > 0.4 | catastrophic drift |
| Recap tag | candidate flagged Recap/OVA/Special when canonical is TV | recap variants |

Surviving candidates score across multiple axes (title similarity, exact-match bonus, year proximity, format match, episode-count proximity, dub preference). HIGH (≥130) wins; MEDIUM (110–129) wins with a log; below threshold drops. Failed gates → no stream from that provider — Stremio will pull from another addon if needed.

`data/overrides.json` ships hand-mapped slugs for popular cases where automatic matching would burn HTTP for inevitable failures.

## Currently shipped providers

| ID | Site | Notes |
|---|---|---|
| `onetwothreeanime` | 123anime.la | sub/dub, vidstreaming → echovideo HLS, headers via proxyHeaders |
| `anizone` | anizone.to | Livewire-backed search, inline `<media-player>` HLS, multi-language subtitle tracks |
| `animenosub` | animenosub.to | Best for currently-airing shows; HTML scrape → Byse (AES-256-GCM) or MegaPlay extractors |

All default-on. Toggle via `/configure`.

## Override file format

`data/overrides.json` (committed) and `data/overrides.user.json` (gitignored) accept two shapes per provider:

```jsonc
{
  "anilist:21": { "onetwothreeanime": "one-piece" },                    // slug only
  "anilist:38000": { "animenosub": { "slug": "xyz", "episodeOffset": 26 } } // slug + offset
}
```

`episodeOffset` is added to the user's requested episode number before calling the provider. Useful when a provider serves multiple AniList seasons under one continuous slug — set `episodeOffset` to the cumulative episode count of preceding seasons.

## Identity map

The addon refreshes a cached merge of two community-maintained anime-ID feeds:

- [Fribb/anime-lists](https://github.com/Fribb/anime-lists) — `{anidb, kitsu, mal, anilist, tvdb, tmdb, imdb}` cross-IDs + format
- [Anime-Lists/anime-lists](https://github.com/Anime-Lists/anime-lists) (Scudlee) — episode-offset rules

Run manually:
```bash
npm run identity:refresh
```

The map gives the addon offline cross-ID resolution (any incoming `tt`/`kitsu:`/`mal:`/`anidb:` ID resolves to AniList without an extra network hop) and provides the format gate signal.

## Subtitles

Provider stream results that include subtitle tracks flow through to Stremio as a top-level `subtitles` array on each stream object. Languages are mapped to ISO 639-2 codes (eng, jpn, spa, …) automatically.

If a host requires Referer/Origin headers on the subtitle URL itself (Stremio's track loader doesn't reliably forward them across all client versions), the provider can flag the track with `proxy: true`. The stream-builder rewrites such URLs to `/sub/<base64url-payload>.<ext>`, served by `lib/sub-proxy.js`, which fetches the upstream file with the right headers and pipes the bytes through.

## Debugging matches

`DEBUG_MATCH=1 npm start` logs every gate rejection and threshold drop with the slug, score, and gate failures. Useful for tuning thresholds or verifying that a Wave-3-class regression hasn't slipped in.

## License

ISC. See LICENSE.
