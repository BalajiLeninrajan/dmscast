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

// "1920 * 0.85", "what is 2pi?", "15% of 240".
export function mathAnswer(raw) {
    const text = raw.replace(/^what(?:'s| is) /i, "").replace(/\?$/, "").trim();
    if (!looksLikeMath(text))
        return null;
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
