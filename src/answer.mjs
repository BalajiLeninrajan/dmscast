import { conversionAnswer } from "./conversion.mjs";
import { dateAnswer } from "./dates.mjs";
import { mathAnswer } from "./maths.mjs";
import { timeAnswer } from "./times.mjs";

export { setRates } from "./conversion.mjs";
export { setFileReader } from "./times.mjs";

// Answers for the launcher's search box. Each answerer returns
// { title, subtitle, icon } or null; answer() returns the first hit, and
// null for anything else so app searches never grow a junk result.
//
// answer() runs on every keystroke in QV4, the engine DMS runs these
// modules in. There, for...of and array destructuring cost about 10x and
// 40x an indexed loop or a plain assignment, so code on the per-query
// path uses neither.
const ANSWERERS = [dateAnswer, conversionAnswer, mathAnswer, timeAnswer];

export function answer(query, now) {
    const text = String(query || "").trim();
    if (text.length < 2)
        return null;
    now = now || new Date();
    for (let i = 0; i < ANSWERERS.length; i++) {
        const result = ANSWERERS[i](text, now);
        if (result)
            return result;
    }
    return null;
}
