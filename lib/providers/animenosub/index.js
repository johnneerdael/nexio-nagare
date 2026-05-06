const { searchAnimenosub } = require("./search");
const { getDetailsAnimenosub } = require("./details");
const { getStreamsAnimenosub } = require("./stream");

module.exports = {
    id: "animenosub",
    displayName: "Animenosub",
    language: "en",
    dub: "both",
    search: searchAnimenosub,
    details: getDetailsAnimenosub,
    getStreams: getStreamsAnimenosub
};
