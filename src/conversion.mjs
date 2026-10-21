import { evaluate } from "./expression.mjs";
import { formatNumber } from "./format.mjs";
import { convertUnit, lookupUnit } from "./units.mjs";

// "25 GB to MB", "5 in to cm". The keyword can be "to", "in",
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
    const to = lookupUnit(rhs);
    if (!to)
        return null;
    // The amount ends at a digit, ")" or "%" and the unit is whatever follows.
    const parts = /^(.*[\d).%])\s*([^\d\s()][^()]*?)$/.exec(lhs);
    if (!parts)
        return null;
    const from = lookupUnit(parts[2]);
    const amount = evaluate(parts[1]);
    if (!from || amount === null || from.category !== to.category)
        return null;

    const result = formatNumber(convertUnit(amount, from, to));
    if (result === null)
        return null;
    return {
        title: result + " " + (to.temp ? to.temp.symbol : rhs),
        subtitle: lhs + " =",
        icon: to.temp ? "thermostat" : "swap_horiz"
    };
}
