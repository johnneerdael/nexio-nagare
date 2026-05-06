const { search123anime } = require("./search");
const { getStreams123anime } = require("./stream");
const { getDetails123anime } = require("./details");

module.exports = {
    id: "onetwothreeanime",
    displayName: "123anime",
    language: "en",
    dub: "both",
    search: search123anime,
    details: getDetails123anime,
    getStreams: getStreams123anime
};
