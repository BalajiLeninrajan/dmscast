import { evaluate, formatNumber } from "./maths.mjs";

// "X to Y" for units, number bases and currencies.

// ------------------------------------------------------------------- units

// Each unit converts to its category's base unit by multiplying with its
// factor. Temperatures need an offset, so they get to/from functions instead.
const UNIT_DEFS = [
    // data, base: byte
    ["data", 1, ["b", "B", "byte", "bytes"]],
    ["data", 1e3, ["kB", "KB", "kilobyte", "kilobytes"]],
    ["data", 1e6, ["MB", "megabyte", "megabytes"]],
    ["data", 1e9, ["GB", "gigabyte", "gigabytes"]],
    ["data", 1e12, ["TB", "terabyte", "terabytes"]],
    ["data", 1e15, ["PB", "petabyte", "petabytes"]],
    ["data", 1024, ["KiB", "kibibyte", "kibibytes"]],
    ["data", Math.pow(1024, 2), ["MiB", "mebibyte", "mebibytes"]],
    ["data", Math.pow(1024, 3), ["GiB", "gibibyte", "gibibytes"]],
    ["data", Math.pow(1024, 4), ["TiB", "tebibyte", "tebibytes"]],
    ["data", Math.pow(1024, 5), ["PiB", "pebibyte", "pebibytes"]],
    ["data", 1 / 8, ["bit", "bits"]],
    ["data", 1e3 / 8, ["Kb", "kbit", "kilobit", "kilobits"]],
    ["data", 1e6 / 8, ["Mb", "mbit", "megabit", "megabits"]],
    ["data", 1e9 / 8, ["Gb", "gbit", "gigabit", "gigabits"]],
    ["data", 1e12 / 8, ["Tb", "tbit", "terabit", "terabits"]],
    // length, base: metre
    ["length", 1, ["m", "meter", "meters", "metre", "metres"]],
    ["length", 1e3, ["km", "kilometer", "kilometers", "kilometre", "kilometres"]],
    ["length", 1e-2, ["cm", "centimeter", "centimeters", "centimetre", "centimetres"]],
    ["length", 1e-3, ["mm", "millimeter", "millimeters", "millimetre", "millimetres"]],
    ["length", 1e-6, ["um", "µm", "micrometer", "micrometers", "micron", "microns"]],
    ["length", 1e-9, ["nm", "nanometer", "nanometers"]],
    ["length", 1609.344, ["mi", "mile", "miles"]],
    ["length", 0.9144, ["yd", "yard", "yards"]],
    ["length", 0.3048, ["ft", "foot", "feet", "'"]],
    ["length", 0.0254, ["in", "inch", "inches", "\""]],
    ["length", 1852, ["nmi", "nautical mile", "nautical miles"]],
    ["length", 9.4607304725808e15, ["ly", "light year", "light years", "lightyear", "lightyears"]],
    // mass, base: kilogram
    ["mass", 1, ["kg", "kilogram", "kilograms", "kilo", "kilos"]],
    ["mass", 1e-3, ["g", "gram", "grams"]],
    ["mass", 1e-6, ["mg", "milligram", "milligrams"]],
    ["mass", 1e-9, ["ug", "µg", "microgram", "micrograms"]],
    ["mass", 1e3, ["t", "tonne", "tonnes", "metric ton", "metric tons"]],
    ["mass", 0.45359237, ["lb", "lbs", "pound", "pounds"]],
    ["mass", 0.028349523125, ["oz", "ounce", "ounces"]],
    ["mass", 6.35029318, ["st", "stone", "stones"]],
    // time, base: second
    ["time", 1, ["s", "sec", "secs", "second", "seconds"]],
    ["time", 1e-3, ["ms", "millisecond", "milliseconds"]],
    ["time", 1e-6, ["us", "µs", "microsecond", "microseconds"]],
    ["time", 1e-9, ["ns", "nanosecond", "nanoseconds"]],
    ["time", 60, ["min", "mins", "minute", "minutes"]],
    ["time", 3600, ["h", "hr", "hrs", "hour", "hours"]],
    ["time", 86400, ["d", "day", "days"]],
    ["time", 604800, ["wk", "week", "weeks"]],
    ["time", 2629746, ["month", "months"]],
    ["time", 31556952, ["yr", "yrs", "year", "years"]],
    // volume, base: litre
    ["volume", 1, ["l", "L", "liter", "liters", "litre", "litres"]],
    ["volume", 1e-3, ["ml", "mL", "milliliter", "milliliters", "millilitre", "millilitres"]],
    ["volume", 1e-2, ["cl", "cL", "centiliter", "centiliters"]],
    ["volume", 1e-1, ["dl", "dL", "deciliter", "deciliters"]],
    ["volume", 1e3, ["m3", "m³", "cubic meter", "cubic meters"]],
    ["volume", 1e-3, ["cm3", "cm³", "cc"]],
    ["volume", 3.785411784, ["gal", "gallon", "gallons"]],
    ["volume", 0.946352946, ["qt", "quart", "quarts"]],
    ["volume", 0.473176473, ["pt", "pint", "pints"]],
    ["volume", 0.2365882365, ["cup", "cups"]],
    ["volume", 0.0295735295625, ["floz", "fl oz", "fluid ounce", "fluid ounces"]],
    ["volume", 0.01478676478125, ["tbsp", "tablespoon", "tablespoons"]],
    ["volume", 0.00492892159375, ["tsp", "teaspoon", "teaspoons"]],
    // speed, base: metre per second
    ["speed", 1, ["m/s", "mps"]],
    ["speed", 1 / 3.6, ["km/h", "kmh", "kph", "kmph"]],
    ["speed", 0.44704, ["mph", "mi/h"]],
    ["speed", 0.514444444444, ["kn", "kt", "knot", "knots"]],
    ["speed", 0.3048, ["ft/s", "fps"]],
    // area, base: square metre
    ["area", 1, ["m2", "m²", "sqm", "square meter", "square meters", "square metre", "square metres"]],
    ["area", 1e6, ["km2", "km²", "square kilometer", "square kilometers"]],
    ["area", 1e-4, ["cm2", "cm²"]],
    ["area", 1e4, ["ha", "hectare", "hectares"]],
    ["area", 4046.8564224, ["acre", "acres", "ac"]],
    ["area", 0.09290304, ["ft2", "ft²", "sqft", "square foot", "square feet"]],
    ["area", 2589988.110336, ["mi2", "mi²", "square mile", "square miles"]],
    // energy, base: joule
    ["energy", 1, ["J", "joule", "joules"]],
    ["energy", 1e3, ["kJ", "kilojoule", "kilojoules"]],
    ["energy", 4.184, ["cal", "calorie", "calories"]],
    ["energy", 4184, ["kcal", "Cal", "kilocalorie", "kilocalories"]],
    ["energy", 3600, ["Wh", "watt hour", "watt hours"]],
    ["energy", 3.6e6, ["kWh", "kilowatt hour", "kilowatt hours"]],
    // pressure, base: pascal
    ["pressure", 1, ["Pa", "pascal", "pascals"]],
    ["pressure", 1e3, ["kPa"]],
    ["pressure", 1e5, ["bar"]],
    ["pressure", 6894.757293168, ["psi"]],
    ["pressure", 101325, ["atm"]],
    // frequency, base: hertz
    ["frequency", 1, ["Hz", "hz", "hertz"]],
    ["frequency", 1e3, ["kHz", "khz"]],
    ["frequency", 1e6, ["MHz", "mhz"]],
    ["frequency", 1e9, ["GHz", "ghz"]],
    // angle, base: radian
    ["angle", 1, ["rad", "radian", "radians"]],
    ["angle", Math.PI / 180, ["deg", "degree", "degrees", "°"]],
    ["angle", Math.PI / 200, ["grad", "gon"]]
];

const TEMPERATURES = [
    {
        symbol: "°C",
        names: ["c", "°c", "celsius", "degc"],
        toK: c => c + 273.15,
        fromK: k => k - 273.15
    },
    {
        symbol: "°F",
        names: ["f", "°f", "fahrenheit", "degf"],
        toK: f => (f - 32) * 5 / 9 + 273.15,
        fromK: k => (k - 273.15) * 9 / 5 + 32
    },
    {
        symbol: "K",
        names: ["k", "kelvin", "kelvins"],
        toK: k => k,
        fromK: k => k
    }
];

// Exact spellings first ("Mb" is a megabit, "MB" a megabyte), then a
// case-insensitive fallback so "25 gb to mb" still works.
const UNITS_EXACT = {};
const UNITS_LOWER = {};
for (const [category, factor, names] of UNIT_DEFS) {
    for (const name of names) {
        const unit = {
            category: category,
            factor: factor
        };
        UNITS_EXACT[name] = unit;
        const lower = name.toLowerCase();
        if (!(lower in UNITS_LOWER))
            UNITS_LOWER[lower] = unit;
    }
}

// { category, factor } for a unit name, { category: "temperature", temp }
// for a temperature scale, or null.
function lookupUnit(raw) {
    const name = raw.trim().replace(/\s+/g, " ");
    const lower = name.toLowerCase();
    for (let i = 0; i < TEMPERATURES.length; i++) {
        if (TEMPERATURES[i].names.indexOf(lower) >= 0)
            return {
                category: "temperature",
                temp: TEMPERATURES[i]
            };
    }
    return UNITS_EXACT[name] || UNITS_LOWER[lower] || null;
}

function convertUnit(amount, from, to) {
    if (to.category === "temperature")
        return to.temp.fromK(from.temp.toK(amount));
    return amount * from.factor / to.factor;
}

// ---------------------------------------------------------------- currency

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

const CURRENCY_ALIASES = {
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
const CURRENCY_PREFIX = /^((?:[a-z]{1,2})?[$€£¥₹])\s*(.+)$/i;

// { category: "currency", code, factor } for a code, symbol or name the
// feed has a rate for, or null.
function lookupCurrency(raw) {
    const name = raw.trim();
    const code = CURRENCY_ALIASES[name.toLowerCase()] || name.toUpperCase();
    if (!/^[A-Z]{3}$/.test(code) || !perEuro[code])
        return null;
    return {
        category: "currency",
        code: code,
        factor: 1 / perEuro[code]
    };
}

function currencyAnswer(amount, from, to, query) {
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

// -------------------------------------------------------------- conversion

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
