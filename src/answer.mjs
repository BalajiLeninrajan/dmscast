import { conversionAnswer } from "./conversion.mjs";
import { dateAnswer } from "./dates.mjs";
import { setReader } from "./files.mjs";
import { mathAnswer } from "./maths.mjs";
import { setPlacesPath } from "./places.mjs";
import { timeAnswer } from "./times.mjs";

export { setRates } from "./currency.mjs";

// Answers for the launcher's search box. Each answerer returns
// { title, subtitle, icon } or null; answer() returns the first hit, and
// null for anything else so app searches never grow a junk result.
const ANSWERERS = [dateAnswer, conversionAnswer, mathAnswer, timeAnswer];

export function answer(query, now) {
    const text = String(query || "").trim();
    if (text.length < 2)
        return null;
    now = now || new Date();
    for (const answerer of ANSWERERS) {
        const result = answerer(text, now);
        if (result)
            return result;
    }
    return null;
}

export function setFileReader(read, placesPath) {
    setReader(read);
    setPlacesPath(placesPath);
}
