import { evaluate } from "./expression.mjs";
import { formatNumber } from "./format.mjs";

// Cheap gate so ordinary app searches never reach the parser. Bare words like
// "pi" or "e" would otherwise evaluate to numbers.
function looksLikeMath(text) {
    if (!/\d/.test(text))
        return false;
    if (/[+*\/^%()!×÷]/.test(text))
        return true;
    if (/\d\s*[-−]\s*[\d(.]/.test(text) || /\s[-−]\s/.test(text))
        return true;
    if (/\d\s*x\s*\d/i.test(text) || /\b(of|mod|off|on)\b/i.test(text))
        return true;
    if (/\d\s*(pi|π|tau)\b/i.test(text))
        return true;
    return /\b0[xbo][0-9a-f]+\b/i.test(text);
}

// Phrasings that read as sentences rather than expressions. Each captures two
// sub-expressions; the function turns their values into the answer.
const PERCENT_PHRASES = [
    [/^(.+?) as an? ?% of (.+)$/, (a, b) => a / b * 100, "%"],
    [/^(.+?) is what ?% of (.+)$/, (a, b) => a / b * 100, "%"],
    [/^(.+?) is (.+?) ?% of what$/, (a, p) => a / (p / 100), ""],
    [/^(.+?) ?% off (.+)$/, (p, b) => b * (1 - p / 100), ""],
    [/^(.+?) ?% on (.+)$/, (p, b) => b * (1 + p / 100), ""]
];

function percentPhrase(text) {
    for (let i = 0; i < PERCENT_PHRASES.length; i++) {
        const phrase = PERCENT_PHRASES[i];
        const m = phrase[0].exec(text);
        if (!m)
            continue;
        const a = evaluate(m[1]);
        const b = evaluate(m[2]);
        const result = a === null || b === null ? null : formatNumber(phrase[1](a, b));
        if (result !== null)
            return result + phrase[2];
    }
    return null;
}

// "1920 * 0.85", "what is 2pi?", "15% of 240", "20 as a % of 80".
export function mathAnswer(raw) {
    const text = raw.replace(/^what(?:'s| is) /i, "").replace(/\?$/, "").trim();
    if (!looksLikeMath(text))
        return null;
    const phrased = percentPhrase(text.toLowerCase());
    if (phrased !== null)
        return {
            title: phrased,
            subtitle: text + " =",
            icon: "percent"
        };
    const result = formatNumber(evaluate(text));
    // A result that echoes the input ("42") tells the user nothing.
    if (result === null || result === text.replace(/\s+/g, ""))
        return null;
    return {
        title: result,
        subtitle: text + " =",
        icon: "calculate"
    };
}
