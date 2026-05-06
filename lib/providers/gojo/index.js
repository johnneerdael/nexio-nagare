const { searchGojo } = require("./search");
const { getDetailsGojo } = require("./details");
const { getStreamsGojo } = require("./stream");

module.exports = {
    id: "gojo",
    displayName: "Gojo",
    language: "en",
    dub: "both",
    search: searchGojo,
    details: getDetailsGojo,
    getStreams: getStreamsGojo
};
