const { searchAnimePahe } = require("./search");
const { getDetailsAnimePahe, recordSearchHit } = require("./details");
const { getStreamsAnimePahe } = require("./stream");

async function search(query, opts) {
    const results = await searchAnimePahe(query, opts);
    for (const r of results) recordSearchHit(r);
    return results;
}

module.exports = {
    id: "animepahe",
    displayName: "AnimePahe",
    language: "en",
    dub: "both",
    search,
    details: getDetailsAnimePahe,
    getStreams: getStreamsAnimePahe
};
