import { readBinary, readText } from "./files.mjs";
import { parseTzif } from "./tzif.mjs";

const ZONEINFO = "/usr/share/zoneinfo/";

// Time zone abbreviations and nicknames. Zone cities and countries come from
// the system's zone.tab and iso3166.tab.
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
export function lookupZone(raw) {
    const name = raw.trim().replace(/^the /, "");
    if (name === "local" || name === "here" || name === "local time")
        return "";
    return own(ZONE_ALIASES, name) || lookupZoneName(name);
}

const zoneCache = {};

// Parsed rules for a zone, or for /etc/localtime when zone is "". Each file
// is read once.
export function loadZone(zone) {
    const path = zone ? ZONEINFO + zone : "/etc/localtime";
    if (!Object.prototype.hasOwnProperty.call(zoneCache, path))
        zoneCache[path] = parseTzif(readBinary(path), Date.now() / 1000);
    return zoneCache[path];
}
