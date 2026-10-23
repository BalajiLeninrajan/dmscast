import { readText } from "./files.mjs";

// data/places.tsv maps about 62,000 city names and airport codes to zones.
// It stays one string and is binary-searched: an object with 62,000 keys took
// half a second to build and several times the memory.
let path = "";
let text = null;
let zones = [];
let start = 0;

export function setPlacesPath(placesPath) {
    path = placesPath;
    text = null;
}

// Comment lines, then one line of tab-separated zones, then sorted
// "name<TAB>zone index" lines.
function load() {
    text = readText(path);
    let at = 0;
    while (text[at] === "#") {
        const nl = text.indexOf("\n", at);
        at = nl < 0 ? text.length : nl + 1;
    }
    let end = text.indexOf("\n", at);
    if (end < 0)
        end = text.length;
    zones = text.slice(at, end).split("\t");
    start = end + 1;
}

// The zone for a lowercase place name, or null.
export function lookupPlace(name) {
    if (text === null)
        load();
    let lo = start;
    let hi = text.length;
    // lo and hi always sit at the start of a line.
    while (lo < hi) {
        const lineStart = text.lastIndexOf("\n", ((lo + hi) >> 1) - 1) + 1;
        let end = text.indexOf("\n", lineStart);
        if (end < 0)
            end = text.length;
        let tab = text.indexOf("\t", lineStart);
        if (tab < 0 || tab > end)
            tab = end;
        const key = text.slice(lineStart, tab);
        if (key === name)
            return zones[+text.slice(tab + 1, end)] || null;
        if (key < name)
            lo = end + 1;
        else
            hi = lineStart;
    }
    return null;
}
