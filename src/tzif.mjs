import { DAY_SECONDS, dayOf, daysInMonth, weekdayOf } from "./calendar.mjs";

// Zone rules from the system tz database, read straight from the TZif files
// `date` uses. Times here are seconds since the epoch; offsets are seconds
// east of UTC.

function tzifCounts(view, at) {
    const count = i => view.getUint32(at + 20 + 4 * i);
    return {
        isut: count(0),
        isstd: count(1),
        leap: count(2),
        time: count(3),
        type: count(4),
        chars: count(5)
    };
}

// RFC 8536: a list of transition times, the UTC offset and abbreviation in
// force after each, and a POSIX TZ string for times past the last one.
// Queries are about today, so transitions more than a year before `now` are
// dropped. Returns null for anything that isn't a TZif file.
export function parseTzif(buffer, now) {
    if (!buffer || !buffer.byteLength || buffer.byteLength < 44)
        return null;
    const view = new DataView(buffer);
    if (view.getUint32(0) !== 0x545a6966)
        return null;
    try {
        let header = 0;
        let size = 4;
        let n = tzifCounts(view, 0);
        // Version 2 and later repeat the data with 64-bit times.
        if (view.getUint8(4) >= 0x32) {
            header = 44 + n.time * 5 + n.type * 6 + n.chars + n.leap * 8 + n.isstd + n.isut;
            n = tzifCounts(view, header);
            size = 8;
        }
        let p = header + 44;
        const times = [];
        for (let i = 0; i < n.time; i++, p += size)
            times.push(size === 8 ? view.getInt32(p) * 4294967296 + view.getUint32(p + 4) : view.getInt32(p));
        const typeOf = [];
        for (let i = 0; i < n.time; i++)
            typeOf.push(view.getUint8(p++));
        const typesAt = p;
        p += n.type * 6;
        let chars = "";
        for (let i = 0; i < n.chars; i++)
            chars += String.fromCharCode(view.getUint8(p++));
        const types = [];
        for (let i = 0; i < n.type; i++) {
            const at = typesAt + i * 6;
            const abbr = view.getUint8(at + 5);
            const nul = chars.indexOf("\0", abbr);
            types.push({
                offset: view.getInt32(at),
                name: chars.slice(abbr, nul < 0 ? chars.length : nul)
            });
        }
        p += n.leap * (size + 4) + n.isstd + n.isut;
        let footer = "";
        if (size === 8 && p < buffer.byteLength && view.getUint8(p) === 10) {
            for (p++; p < buffer.byteLength && view.getUint8(p) !== 10; p++)
                footer += String.fromCharCode(view.getUint8(p));
        }

        let first = 0;
        while (first < times.length && times[first] < now - 366 * DAY_SECONDS)
            first++;
        return {
            times: times.slice(first),
            types: typeOf.slice(first).map(i => types[i]),
            before: first > 0 ? types[typeOf[first - 1]] : types[0],
            last: times.length ? times[times.length - 1] : -Infinity,
            rule: parsePosixTz(footer)
        };
    } catch (e) {
        // A truncated file reads past the end of the buffer.
        return null;
    }
}

const POSIX_TZ = /^(<[^>]*>|[A-Za-z]{3,})([+-]?[\d:]+)(?:(<[^>]*>|[A-Za-z]{3,})([+-]?[\d:]+)?,([^,]+),([^,]+))?$/;
const POSIX_RULE = /^(?:M(\d+)\.(\d)\.(\d)|J(\d+)|(\d+))(?:\/([+-]?[\d:]+))?$/;

function hms(text) {
    const sign = text[0] === "-" ? -1 : 1;
    const parts = text.replace(/^[+-]/, "").split(":");
    return sign * (parts[0] * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0) * 1);
}

function posixRule(text) {
    const m = POSIX_RULE.exec(text);
    if (!m)
        return null;
    return {
        month: +(m[1] || 0),
        week: +(m[2] || 0),
        weekday: +(m[3] || 0),
        julian: +(m[4] || 0),
        day: +(m[5] || 0),
        time: m[6] ? hms(m[6]) : 7200
    };
}

// "EST5EDT,M3.2.0,M11.1.0": offsets count hours west of UTC, and daylight
// saving starts and ends on the given days at the given local times.
export function parsePosixTz(text) {
    const m = POSIX_TZ.exec(text);
    if (!m)
        return null;
    const std = {
        name: m[1].replace(/[<>]/g, ""),
        offset: -hms(m[2])
    };
    if (!m[3])
        return {
            std: std,
            dst: null
        };
    const start = posixRule(m[5]);
    const end = posixRule(m[6]);
    if (!start || !end)
        return null;
    return {
        std: std,
        dst: {
            name: m[3].replace(/[<>]/g, ""),
            offset: m[4] ? -hms(m[4]) : std.offset + 3600
        },
        start: start,
        end: end
    };
}

function ruleDay(year, rule) {
    if (rule.month) {
        const first = dayOf(year, rule.month, 1);
        let day = first + (rule.weekday - weekdayOf(first) + 7) % 7 + (rule.week - 1) * 7;
        // Week 5 means the last one, which may be the fourth.
        if (day - first >= daysInMonth(year, rule.month))
            day -= 7;
        return day;
    }
    const jan1 = dayOf(year, 1, 1);
    if (rule.julian)
        return jan1 + rule.julian - 1 + (rule.julian >= 60 && daysInMonth(year, 2) === 29 ? 1 : 0);
    return jan1 + rule.day;
}

function posixAt(rule, t) {
    if (!rule.dst)
        return rule.std;
    const year = new Date((t + rule.std.offset) * 1000).getUTCFullYear();
    const start = ruleDay(year, rule.start) * DAY_SECONDS + rule.start.time - rule.std.offset;
    const end = ruleDay(year, rule.end) * DAY_SECONDS + rule.end.time - rule.dst.offset;
    // Southern zones, and Dublin's winter "daylight saving", wrap the year.
    const dst = start < end ? t >= start && t < end : t >= start || t < end;
    return dst ? rule.dst : rule.std;
}

// The { offset, name } in force at t.
export function zoneAt(zone, t) {
    if (zone.rule && t >= zone.last)
        return posixAt(zone.rule, t);
    let lo = 0;
    let hi = zone.times.length;
    while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (zone.times[mid] <= t)
            lo = mid + 1;
        else
            hi = mid;
    }
    return lo ? zone.types[lo - 1] : zone.before;
}

// When the clock in `zone` reads hour:minute on `day`.
export function wallToUtc(zone, day, hour, minute) {
    const wall = day * DAY_SECONDS + hour * 3600 + minute * 60;
    const guess = wall - zoneAt(zone, wall).offset;
    return wall - zoneAt(zone, guess).offset;
}
