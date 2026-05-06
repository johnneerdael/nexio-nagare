//===============
// P.A.C.K.E.R. unpacker — port of CloudStream's JsUnpacker (which is itself a
// port of cylonu87/JsUnpacker). Used by every video host that wraps its
// player config in `eval(function(p,a,c,k,e,d){...}('payload',a,c,'kw|...'.split('|'),...))`.
//
// `detect(src)` returns true if src looks p.a.c.k.e.r-encoded.
// `unpack(src)` returns the decoded source on success, or null on failure.
//===============

const ALPHABET_62 = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

function detect(src) {
    return /eval\(function\(p,a,c,k,e,[rd]/.test(String(src || "").replace(/\s/g, ""));
}

function unbase(str, radix) {
    if (radix <= 36) {
        const n = parseInt(str, radix);
        return Number.isFinite(n) ? n : 0;
    }
    let result = 0;
    for (const ch of str) {
        const idx = ALPHABET_62.indexOf(ch);
        if (idx < 0) return 0;
        result = result * radix + idx;
    }
    return result;
}

function unpack(src) {
    if (!src) return null;
    const m = /\}\s*\('(.*)',\s*(.*?),\s*(\d+),\s*'(.*?)'\.split\('\|'\)/s.exec(src);
    if (!m) return null;
    const payload = m[1].replace(/\\'/g, "'");
    const radix = parseInt(m[2], 10) || 36;
    const count = parseInt(m[3], 10) || 0;
    const symtab = m[4].split("|");
    if (symtab.length !== count) return null;

    return payload.replace(/\b[a-zA-Z0-9_]+\b/g, word => {
        const idx = unbase(word, radix);
        if (idx < 0 || idx >= symtab.length) return word;
        return symtab[idx] || word;
    });
}

//===============
// Helper: pull packed JS out of a full HTML page (any script tag containing
// the eval(function(p,a,c,k,e,d) signature) and unpack it.
//===============
function unpackFromHtml(html) {
    if (!html) return null;
    const cleaned = String(html).replace(/\\\//g, "/");
    const scripts = [...cleaned.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)].map(x => x[1]);
    for (const body of scripts) {
        if (detect(body)) {
            const result = unpack(body);
            if (result) return result;
        }
    }
    if (detect(cleaned)) return unpack(cleaned);
    return null;
}

module.exports = { detect, unpack, unpackFromHtml };
