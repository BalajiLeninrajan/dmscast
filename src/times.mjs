import { dayOf, formatDay } from "./dates.mjs";
import { parseTzif, wallToUtc, zoneAt } from "./tzif.mjs";

// Clock times in other zones: "time in tokyo", "3pm pst to london". Place
// names resolve through aliases, data/places.tsv and the system's zone.tab
// and iso3166.tab; zone rules come from tzif.mjs.

// ------------------------------------------------------------------- files

// The plugin passes in its file reader at startup: read(path, binary) returns
// the text, or an ArrayBuffer when binary is set, and "" for a missing file.
// Nothing here reads a file until a query needs it.
let reader = null;
let placesPath = "";

export function setFileReader(read, places) {
    reader = read;
    placesPath = places;
    placesText = null;
}

function readText(path) {
    return reader ? String(reader(path, false) || "") : "";
}

function readBinary(path) {
    return reader ? reader(path, true) : null;
}

// ------------------------------------------------------------------ places

// data/places.tsv maps about 62,000 city names and airport codes to zones.
// It stays one string and is binary-searched: an object with 62,000 keys took
// half a second to build and several times the memory.
let placesText = null;
let placeZones = [];
let placesStart = 0;

// Comment lines, then one line of tab-separated zones, then sorted
// "name<TAB>zone index" lines.
function loadPlaces() {
    const text = readText(placesPath);
    let at = 0;
    while (text[at] === "#") {
        const nl = text.indexOf("\n", at);
        at = nl < 0 ? text.length : nl + 1;
    }
    let end = text.indexOf("\n", at);
    if (end < 0)
        end = text.length;
    placeZones = text.slice(at, end).split("\t");
    placesStart = end + 1;
    placesText = text;
}

// The zone for a lowercase place name, or null.
function lookupPlace(name) {
    if (placesText === null)
        loadPlaces();
    const text = placesText;
    let lo = placesStart;
    let hi = text.length;
    // lo and hi always sit at the start of a line.
    while (lo < hi) {
        const start = text.lastIndexOf("\n", ((lo + hi) >> 1) - 1) + 1;
        let end = text.indexOf("\n", start);
        if (end < 0)
            end = text.length;
        let tab = text.indexOf("\t", start);
        if (tab < 0 || tab > end)
            tab = end;
        const key = text.slice(start, tab);
        if (key === name)
            return placeZones[+text.slice(tab + 1, end)] || null;
        if (key < name)
            lo = end + 1;
        else
            hi = start;
    }
    return null;
}

// ------------------------------------------------------------------- zones

const ZONEINFO = "/usr/share/zoneinfo/";

// Time zone abbreviations and nicknames. Cities and airport codes come from
// data/places.tsv and countries from the system's iso3166.tab.
const ZONE_ALIASES = {
    utc: "UTC",
    gmt: "UTC",
    pst: "America/Los_Angeles",
    pdt: "America/Los_Angeles",
    pt: "America/Los_Angeles",
    pacific: "America/Los_Angeles",
    mst: "America/Denver",
    mdt: "America/Denver",
    mt: "America/Denver",
    mountain: "America/Denver",
    cst: "America/Chicago",
    cdt: "America/Chicago",
    ct: "America/Chicago",
    central: "America/Chicago",
    est: "America/New_York",
    edt: "America/New_York",
    et: "America/New_York",
    eastern: "America/New_York",
    ast: "America/Halifax",
    adt: "America/Halifax",
    nst: "America/St_Johns",
    akst: "America/Anchorage",
    hst: "Pacific/Honolulu",
    bst: "Europe/London",
    cet: "Europe/Paris",
    cest: "Europe/Paris",
    eet: "Europe/Athens",
    eest: "Europe/Athens",
    wet: "Europe/Lisbon",
    msk: "Europe/Moscow",
    ist: "Asia/Kolkata",
    pkt: "Asia/Karachi",
    sgt: "Asia/Singapore",
    hkt: "Asia/Hong_Kong",
    jst: "Asia/Tokyo",
    kst: "Asia/Seoul",
    aest: "Australia/Sydney",
    aedt: "Australia/Sydney",
    awst: "Australia/Perth",
    nzst: "Pacific/Auckland",
    nzdt: "Pacific/Auckland",
    sf: "America/Los_Angeles",
    la: "America/Los_Angeles",
    "bay area": "America/Los_Angeles",
    "silicon valley": "America/Los_Angeles",
    dc: "America/New_York",
    kl: "Asia/Kuala_Lumpur",
    usa: "America/New_York",
    us: "America/New_York",
    america: "America/New_York",
    uk: "Europe/London",
    england: "Europe/London",
    britain: "Europe/London"
};

// Countries spanning several zones resolve to their best-known one.
const COUNTRY_DEFAULTS = {
    US: "America/New_York",
    CA: "America/Toronto",
    AU: "Australia/Sydney",
    BR: "America/Sao_Paulo",
    RU: "Europe/Moscow",
    CN: "Asia/Shanghai",
    MX: "America/Mexico_City",
    ID: "Asia/Jakarta",
    KZ: "Asia/Almaty",
    AR: "America/Argentina/Buenos_Aires",
    ES: "Europe/Madrid",
    PT: "Europe/Lisbon",
    DE: "Europe/Berlin",
    NZ: "Pacific/Auckland"
};

// Plain objects inherit "constructor" and "toString", which aren't places.
function own(table, key) {
    return Object.prototype.hasOwnProperty.call(table, key) ? table[key] : null;
}

function tabRows(path) {
    return readText(path).split("\n").filter(line => line && line[0] !== "#").map(line => line.split("\t"));
}

let zoneNames = null;

// Zone cities ("new york") and country names ("japan") from the system's
// zone.tab and iso3166.tab.
function lookupZoneName(name) {
    if (zoneNames === null) {
        zoneNames = {};
        const byCountry = {};
        for (const cols of tabRows(ZONEINFO + "zone.tab")) {
            if (!cols[2])
                continue;
            zoneNames[cols[2].split("/").pop().replace(/_/g, " ").toLowerCase()] = cols[2];
            (byCountry[cols[0]] = byCountry[cols[0]] || []).push(cols[2]);
        }
        for (const cols of tabRows(ZONEINFO + "iso3166.tab")) {
            const zones = byCountry[cols[0]];
            if (zones && cols[1])
                zoneNames[cols[1].toLowerCase()] = COUNTRY_DEFAULTS[cols[0]] || zones[0];
        }
    }
    return own(zoneNames, name);
}

// The zone a lowercase name refers to: "" for the local zone, null when the
// name isn't a place.
function lookupZone(raw) {
    const name = raw.trim().replace(/^the /, "");
    if (name === "local" || name === "here" || name === "local time")
        return "";
    return own(ZONE_ALIASES, name) || lookupPlace(name) || lookupZoneName(name);
}

const zoneCache = {};

// Parsed rules for a zone, or for /etc/localtime when zone is "". Each file
// is read once.
function loadZone(zone) {
    const path = zone ? ZONEINFO + zone : "/etc/localtime";
    if (!Object.prototype.hasOwnProperty.call(zoneCache, path))
        zoneCache[path] = parseTzif(readBinary(path), Date.now() / 1000);
    return zoneCache[path];
}

// ----------------------------------------------------------------- answers

function pad2(n) {
    return (n < 10 ? "0" : "") + n;
}

// Abbreviations shout ("SYD", "UTC"); names get capitals ("New York").
function titleCase(text) {
    return text.length <= 4 ? text.toUpperCase() : text.replace(/\b[a-z]/g, c => c.toUpperCase());
}

// "3pm", "3:30 pm", "15:00", "noon". A bare "3" is too ambiguous to be a time.
function parseClock(text) {
    if (text === "noon")
        return {
            hour: 12,
            minute: 0
        };
    if (text === "midnight")
        return {
            hour: 0,
            minute: 0
        };
    const m = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/.exec(text);
    if (!m || (!m[2] && !m[3]))
        return null;
    let hour = +m[1];
    const minute = m[2] ? +m[2] : 0;
    if (m[3]) {
        if (hour < 1 || hour > 12)
            return null;
        hour = hour % 12 + (m[3] === "pm" ? 12 : 0);
    }
    if (hour > 23 || minute > 59)
        return null;
    return {
        hour: hour,
        minute: minute
    };
}

// The day number the clock in `zone` shows at t.
function dayIn(zone, t) {
    const d = new Date((t + zoneAt(zone, t).offset) * 1000);
    return dayOf(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

// "time in tokyo", "tokyo time", "3pm pst to london" and "3pm london".
export function timeAnswer(raw, now) {
    const text = raw.trim().toLowerCase().replace(/\s+/g, " ").replace(/\?$/, "");
    let from = "", to = "", at = null, label = "";

    let m = /^(?:what(?:'s| is) the |what )?(?:current )?(?:time|now) (?:is it )?(?:in|at) (.+)$/.exec(text) || /^(.+?) time$/.exec(text);
    const place = m ? lookupZone(m[1]) : null;
    if (place) {
        to = place;
        label = titleCase(m[1]);
    } else {
        m = /^(noon|midnight|\d{1,2}(?::\d{2})? ?(?:am|pm)?) (.+)$/.exec(text);
        if (!m || !(at = parseClock(m[1].replace(" ", ""))))
            return null;
        const rest = m[2].replace(/ time$/, "");
        const cut = /^(?:(.+?) )?(?:to|in) (.+)$/.exec(rest);
        const fromName = cut ? cut[1] || "local" : rest;
        const toName = cut ? cut[2] : "local";
        from = lookupZone(fromName);
        to = lookupZone(toName);
        if (from === null || to === null || from === to)
            return null;
        label = (from ? titleCase(fromName) : "Local") + " → " + (to ? titleCase(toName) : "local time");
    }

    const target = loadZone(to);
    const source = at ? loadZone(from) : null;
    if (!target || (at && !source))
        return null;
    let t = now.getTime() / 1000;
    if (at)
        t = wallToUtc(source, dayIn(source, t), at.hour, at.minute);
    const type = zoneAt(target, t);
    const d = new Date((t + type.offset) * 1000);
    const hour = d.getUTCHours();
    return {
        title: (hour % 12 || 12) + ":" + pad2(d.getUTCMinutes()) + " " + (hour < 12 ? "AM" : "PM") + " " + type.name,
        subtitle: formatDay(dayOf(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()), false) + " · " + label,
        icon: "schedule"
    };
}
