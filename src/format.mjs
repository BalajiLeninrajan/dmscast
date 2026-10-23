// Numbers are 64-bit floats shown to 10 significant digits. null means the
// value can't be shown, so the caller gives no answer.
export function formatNumber(x) {
    if (typeof x !== "number" || !isFinite(x))
        return null;
    // toPrecision(10) hides float noise like 0.1 + 0.2 = 0.30000000000000004.
    const r = Number(x.toPrecision(10));
    if (r === 0)
        return "0";
    const abs = Math.abs(r);
    if (abs >= 1e15 || abs < 1e-9)
        return r.toExponential().replace(/\.?0+e/, "e");
    return String(r);
}

export function plural(n, unit) {
    return n + " " + unit + (n === 1 ? "" : "s");
}

export function pad2(n) {
    return (n < 10 ? "0" : "") + n;
}

export function capitalize(word) {
    return word.charAt(0).toUpperCase() + word.slice(1);
}
