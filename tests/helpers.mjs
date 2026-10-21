import { answer, setRates } from "../src/answer.mjs";

setRates({
    USD: 1.08,
    CAD: 1.5,
    GBP: 0.85,
    JPY: 160,
    INR: 90
}, "2026-10-26");

export function ask(query) {
    return answer(query);
}

export function title(query) {
    const result = answer(query);
    return result && result.title;
}
