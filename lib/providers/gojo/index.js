const { searchGojo } = require("./search");
const { getDetailsGojo } = require("./details");
const { getStreamsGojo } = require("./stream");

module.exports = {
    id: "gojo",
    displayName: "Gojo",
    displayHost: "animetsu.live",
    language: "en",
    dub: "both",
    search: searchGojo,
    details: getDetailsGojo,
    getStreams: getStreamsGojo
};
