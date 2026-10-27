// Calendar arithmetic: "days until october 8", "days since january 1",
// "30 days from now", "in 3 months". tzif.mjs and times.mjs share the
// day-number helpers.

// ---------------------------------------------------------------- calendar

// Days are counted from the Unix epoch and built from a calendar date, never
// from a timestamp, so "days until" can't trip over time zones or DST.

export const DAY_SECONDS = 86400;
const DAY_MS = DAY_SECONDS * 1000;
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function dayOf(y, m, d) {
    return Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
}

function todayOf(now) {
    return dayOf(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

// [year, month, day] for a day number.
function civil(day) {
    const d = new Date(day * DAY_MS);
    return [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()];
}

// 0 is Sunday. 1 January 1970 was a Thursday.
export function weekdayOf(day) {
    return ((day + 4) % 7 + 7) % 7;
}

export function daysInMonth(y, m) {
    return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

// "Friday, 8 October 2027", or "Friday, 8 October" without the year, for
// the UTC date of d.
export function formatDate(d, withYear = true) {
    const text = WEEKDAYS[d.getUTCDay()] + ", " + d.getUTCDate() + " " + capitalize(MONTHS[d.getUTCMonth()]);
    return withYear ? text + " " + d.getUTCFullYear() : text;
}

function formatDay(day) {
    return formatDate(new Date(day * DAY_MS));
}

// "oct", "october" and "octob" are all October. Two letters are too few.
function monthFromName(token) {
    if (token.length < 3)
        return 0;
    for (let i = 0; i < MONTHS.length; i++) {
        if (MONTHS[i].startsWith(token))
            return i + 1;
    }
    return 0;
}

function plural(n, unit) {
    return n + " " + unit + (n === 1 ? "" : "s");
}

function capitalize(word) {
    return word.charAt(0).toUpperCase() + word.slice(1);
}

// ----------------------------------------------------------------- answers

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
    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
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
    const date = civil(day);
    const total = date[0] * 12 + (date[1] - 1) + months;
    const y = Math.floor(total / 12);
    const m = total - y * 12 + 1;
    // Jan 31 + 1 month lands on the last day of February, not in March.
    return dayOf(y, m, Math.min(date[2], daysInMonth(y, m)));
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
    for (let i = 0; i < prefixes.length; i++) {
        if (text.startsWith(prefixes[i]))
            return text.slice(prefixes[i].length).trim();
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
