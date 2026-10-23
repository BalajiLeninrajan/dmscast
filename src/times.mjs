import { dayOf, formatDay } from "./calendar.mjs";
import { pad2 } from "./format.mjs";
import { wallToUtc, zoneAt } from "./tzif.mjs";
import { loadZone, lookupZone } from "./zones.mjs";

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
        subtitle: formatDay(dayIn(target, t), false) + " · " + label,
        icon: "schedule"
    };
}
