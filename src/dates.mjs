import { civil, dayOf, daysInMonth, formatDay, monthFromName, today as todayOf } from "./calendar.mjs";
import { plural } from "./format.mjs";

// "days until march 1" means the next 1 March; "days since march 1" the last
// one. Resolving bare dates this way keeps either answer from going negative.
function parseDate(input, today, preferFuture) {
    const text = input.trim();
    if (text === "today" || text === "now")
        return today;
    if (text === "tomorrow")
        return today + 1;
    if (text === "yesterday")
        return today - 1;

    const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text);
    if (iso) {
        const y = +iso[1], m = +iso[2], d = +iso[3];
        return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m) ? dayOf(y, m, d) : null;
    }

    const tokens = text.split(/[\s,]+/).filter(t => t.length > 0);
    if (tokens.length === 0 || tokens.length > 3)
        return null;
    let month = 0, day = 0, year = 0;
    for (const token of tokens) {
        const named = monthFromName(token);
        if (named) {
            if (month)
                return null;
            month = named;
            continue;
        }
        // Ordinals are how dates get typed: "8th", "1st".
        const numeric = token.replace(/(st|nd|rd|th)$/, "");
        if (!/^\d+$/.test(numeric))
            return null;
        const value = +numeric;
        if (numeric.length === 4 || value > 31) {
            if (year)
                return null;
            year = value;
        } else {
            if (day)
                return null;
            day = value;
        }
    }
    if (!month || !day)
        return null;
    if (!year) {
        year = civil(today)[0];
        const candidate = dayOf(year, month, Math.min(day, daysInMonth(year, month)));
        if (preferFuture && candidate < today)
            year += 1;
        else if (!preferFuture && candidate > today)
            year -= 1;
    }
    return day <= daysInMonth(year, month) ? dayOf(year, month, day) : null;
}

function addMonths(day, months) {
    const [y, m, d] = civil(day);
    const total = y * 12 + (m - 1) + months;
    const ny = Math.floor(total / 12);
    const nm = total - ny * 12 + 1;
    // Jan 31 + 1 month lands on the last day of February, not in March.
    return dayOf(ny, nm, Math.min(d, daysInMonth(ny, nm)));
}

const SPAN_DAYS = {
    day: 1,
    week: 7,
    fortnight: 14
};

function addSpan(day, count, unit) {
    if (unit === "month" || unit === "year")
        return addMonths(day, count * (unit === "year" ? 12 : 1));
    return day + count * SPAN_DAYS[unit];
}

function stripAny(text, prefixes) {
    for (const p of prefixes) {
        if (text.startsWith(p))
            return text.slice(p.length).trim();
    }
    return null;
}

// "days until october 8", "days since january 1", "30 days from now",
// "2 weeks ago", "in 3 months".
export function dateAnswer(raw, now) {
    let text = raw.toLowerCase().replace(/\s+/g, " ");
    if (!/day|week|fortnight|month|year/.test(text))
        return null;
    text = text.replace(/^how many /, "");
    const today = todayOf(now);

    let rest = stripAny(text, ["days until ", "days till ", "days til ", "days untill ", "days to "]);
    if (rest !== null) {
        const target = parseDate(rest, today, true);
        if (target === null)
            return null;
        return {
            title: plural(target - today, "day"),
            subtitle: "until " + formatDay(target),
            icon: "event"
        };
    }

    rest = stripAny(text, ["days since ", "days from "]);
    if (rest !== null) {
        const target = parseDate(rest, today, false);
        if (target === null)
            return null;
        return {
            title: plural(today - target, "day"),
            subtitle: "since " + formatDay(target),
            icon: "event"
        };
    }

    let m = /^(\d+) (day|week|fortnight|month|year)s? (from now|from today|ahead|later|ago|before now|before today|back)$/.exec(text);
    let count, unit, sign;
    if (m) {
        count = +m[1];
        unit = m[2];
        sign = /ago|before|back/.test(m[3]) ? -1 : 1;
    } else if ((m = /^in (\d+) (day|week|fortnight|month|year)s?$/.exec(text))) {
        count = +m[1];
        unit = m[2];
        sign = 1;
    } else {
        return null;
    }

    const span = plural(count, unit);
    return {
        title: formatDay(addSpan(today, sign * count, unit)),
        subtitle: sign > 0 ? span + " from today" : span + " ago",
        icon: "event"
    };
}
