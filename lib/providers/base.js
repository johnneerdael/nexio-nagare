//===============
// Provider Contract
//
// Every provider exports an object that conforms to this shape:
//
//   {
//     id:           string,     // stable id used in config (e.g. "onetwothreeanime")
//     displayName:  string,     // human-readable label shown in stream titles
//     language:     "en",       // ISO 639-1; nexio-nagare is English-only
//     dub:          "sub" | "dub" | "both",  // what the provider offers
//
//     search(title) -> Promise<SearchResult[]>
//       SearchResult = {
//         slug:         string,   // provider-specific id used by getStreams
//         title:        string,
//         episodeCount: number?,  // optional
//         type:         "sub" | "dub" | "sub/dub" | "" ?,
//         image:        string?
//       }
//
//     getStreams(slug, episodeNumber, ctx?) -> Promise<StreamResult[]>
//       StreamResult = {
//         url:      string,    // direct M3U8 / MP4 URL the player can load
//         server:   string,    // server label for UX ("vidstreaming", "vidstack", ...)
//         quality:  string?,   // "1080p" | "720p" | "auto" | ...
//         dub:      boolean?,  // true if dub track
//         headers:  object?    // sent to player via proxyHeaders.request
//       }
//   }
//
// CONSTRAINTS
//   * Streams MUST be playable directly by the Stremio client. We do NOT proxy
//     bytes through this addon (no /play-style passthrough). If a provider
//     requires Referer/Origin/UA, return them in `headers` so the addon can
//     emit them as Stremio behaviorHints.proxyHeaders.
//   * Methods should never throw. Return an empty array on any error.
//   * Methods should respect the timeouts configured in lib/providers/http.js.
//===============

function fail(reason) {
    return new Error(`[provider] ${reason}`);
}

module.exports = { fail };
