import { capitalize } from "./format.mjs";

// Days are counted from the Unix epoch and built from a calendar date, never
// from a timestamp, so "days until" can't trip over time zones or DST.

export const DAY_SECONDS = 86400;
const DAY_MS = DAY_SECONDS * 1000;
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function dayOf(y, m, d) {
    return Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
}

export function today(now) {
    return dayOf(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

// [year, month, day] for a day number.
export function civil(day) {
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

// "Friday, 8 October 2027", or "Friday, 8 October" without the year.
export function formatDay(day, withYear = true) {
    const date = civil(day);
    const text = WEEKDAYS[weekdayOf(day)] + ", " + date[2] + " " + capitalize(MONTHS[date[1] - 1]);
    return withYear ? text + " " + date[0] : text;
}

// "oct", "october" and "octob" are all October. Two letters are too few.
export function monthFromName(token) {
    if (token.length < 3)
        return 0;
    for (let i = 0; i < MONTHS.length; i++) {
        if (MONTHS[i].startsWith(token))
            return i + 1;
    }
    return 0;
}
