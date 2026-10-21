import { answer, setRates } from "../src/answer.mjs";

setRates({
    USD: 1.08,
    CAD: 1.5,
    GBP: 0.85,
    JPY: 160,
    INR: 90
}, "2026-10-26");

// Saturday, 24 October 2026, 13:53 UTC.
export const NOW = new Date(Date.UTC(2026, 9, 24, 13, 53, 20));

export function ask(query, now = NOW) {
    return answer(query, now);
}

export function title(query, now = NOW) {
    const result = answer(query, now);
    return result && result.title;
}
