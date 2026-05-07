const { searchAnizone } = require("./search");
const { getDetailsAnizone } = require("./details");
const { getStreamsAnizone } = require("./stream");

module.exports = {
    id: "anizone",
    displayName: "Anizone",
    displayHost: "anizone.to",
    language: "en",
    dub: "both",
    search: searchAnizone,
    details: getDetailsAnizone,
    getStreams: getStreamsAnizone
};
