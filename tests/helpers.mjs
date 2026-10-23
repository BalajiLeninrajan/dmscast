import fs from "node:fs";
import { answer, setFileReader, setRates } from "../src/answer.mjs";

// Same contract as the plugin's FileView reader.
export function read(path, binary) {
    try {
        const b = fs.readFileSync(path);
        return binary ? b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) : b.toString("utf8");
    } catch (e) {
        return "";
    }
}

setFileReader(read);
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
