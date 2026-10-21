// Units per euro, from the ECB feed the plugin fetches. Empty until the
// first fetch lands, so currency queries return nothing until then.
let perEuro = {};
let ratesDate = "";

export function setRates(rates, date) {
    perEuro = Object.assign({
        EUR: 1
    }, rates || {});
    ratesDate = date || "";
}

const ALIASES = {
    "$": "USD",
    "us$": "USD",
    "c$": "CAD",
    "ca$": "CAD",
    "a$": "AUD",
    "€": "EUR",
    "£": "GBP",
    "¥": "JPY",
    "₹": "INR",
    "dollar": "USD",
    "dollars": "USD",
    "euro": "EUR",
    "euros": "EUR",
    "rupee": "INR",
    "rupees": "INR",
    "yen": "JPY"
};

// A symbol before the amount: "$20", "C$20", "€5". Captures symbol, amount.
export const CURRENCY_PREFIX = /^((?:[a-z]{1,2})?[$€£¥₹])\s*(.+)$/i;

// { category: "currency", code, factor } for a code, symbol or name the
// feed has a rate for, or null.
export function lookupCurrency(raw) {
    const name = raw.trim();
    const code = ALIASES[name.toLowerCase()] || name.toUpperCase();
    if (!/^[A-Z]{3}$/.test(code) || !perEuro[code])
        return null;
    return {
        category: "currency",
        code: code,
        factor: 1 / perEuro[code]
    };
}

export function currencyAnswer(amount, from, to, query) {
    const converted = amount * from.factor / to.factor;
    if (!isFinite(converted))
        return null;
    // Cents, unless that would round "1 jpy to usd" down to nothing.
    const shown = Math.abs(converted) >= 1 || converted === 0 ? converted.toFixed(2) : String(Number(converted.toPrecision(4)));
    return {
        title: shown + " " + to.code,
        subtitle: query + " · ECB, " + ratesDate,
        icon: "currency_exchange"
    };
}
