import { conversionAnswer } from "./conversion.mjs";
import { mathAnswer } from "./maths.mjs";

// Answers for the launcher's search box. Each answerer returns
// { title, subtitle, icon } or null; answer() returns the first hit, and
// null for anything else so app searches never grow a junk result.
const ANSWERERS = [conversionAnswer, mathAnswer];

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
