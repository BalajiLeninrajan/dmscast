import { CURRENCY_PREFIX, currencyAnswer, lookupCurrency } from "./currency.mjs";
import { evaluate } from "./expression.mjs";
import { formatNumber } from "./format.mjs";
import { convertUnit, lookupUnit } from "./units.mjs";

const BASES = {
    dec: 10,
    decimal: 10,
    hex: 16,
    hexadecimal: 16,
    bin: 2,
    binary: 2,
    oct: 8,
    octal: 8
};

const BASE_PREFIX = {
    16: "0x",
    8: "0o",
    2: "0b"
};

// "25 GB to MB", "255 to hex", "$20 to cad". The keyword can be "to", "in",
// "into" or "as".
export function conversionAnswer(text) {
    // The trailing space is a lookahead so "5 in to cm" yields both cuts.
    const splitter = /\s+(?:to|in|into|as)(?=\s)/gi;
    const cuts = [];
    let m;
    while ((m = splitter.exec(text)))
        cuts.push(m);
    // Try the rightmost keyword first: in "5 in to cm" the "in" is a unit.
    for (let i = cuts.length - 1; i >= 0; i--) {
        const lhs = text.slice(0, cuts[i].index).trim();
        const rhs = text.slice(cuts[i].index + cuts[i][0].length).trim();
        const result = convert(lhs, rhs);
        if (result)
            return result;
    }
    return null;
}

function convert(lhs, rhs) {
    const radix = BASES[rhs.toLowerCase()];
    if (radix)
        return baseAnswer(lhs, rhs, radix);

    const to = lookupUnit(rhs) || lookupCurrency(rhs);
    if (!to)
        return null;
    // The amount ends at a digit, ")" or "%" and the unit is whatever
    // follows, except for currency symbols, which come first.
    let amountText, unitText;
    let m = CURRENCY_PREFIX.exec(lhs);
    if (m) {
        unitText = m[1];
        amountText = m[2];
    } else if ((m = /^(.*[\d).%])\s*([^\d\s()][^()]*?)$/.exec(lhs))) {
        amountText = m[1];
        unitText = m[2];
    } else {
        return null;
    }
    const from = lookupUnit(unitText) || lookupCurrency(unitText);
    const amount = evaluate(amountText);
    if (!from || amount === null || from.category !== to.category)
        return null;

    if (to.category === "currency")
        return currencyAnswer(amount, from, to, lhs);
    const result = formatNumber(convertUnit(amount, from, to));
    if (result === null)
        return null;
    return {
        title: result + " " + (to.temp ? to.temp.symbol : rhs),
        subtitle: lhs + " =",
        icon: to.temp ? "thermostat" : "swap_horiz"
    };
}

function baseAnswer(lhs, rhs, radix) {
    const value = evaluate(lhs);
    if (value === null)
        return null;
    let result;
    if (radix === 10)
        result = formatNumber(value);
    else if (Math.floor(value) === value && Math.abs(value) <= Number.MAX_SAFE_INTEGER)
        result = (value < 0 ? "-" : "") + BASE_PREFIX[radix] + Math.abs(value).toString(radix);
    else
        return null;
    return result === null ? null : {
        title: result,
        subtitle: lhs + " in " + rhs.toLowerCase(),
        icon: "tag"
    };
}
