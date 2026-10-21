.pragma library

// Inline answers for the spotlight search box: arithmetic, percentages, unit,
// currency and base conversion, and calendar arithmetic. answer() returns null
// for anything else, so app searches never grow a junk result. Time zones need
// `date` for DST rules, so timeQuery() only describes the command to run.

const DAY_MS = 86400000;
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Units per euro, from the ECB feed the plugin fetches. Empty until the
// first fetch lands, so currency queries just return nothing until then.
let currencyRates = {};
let currencyDate = "";

function setRates(rates, date) {
    currencyRates = Object.assign({
        EUR: 1
    }, rates || {});
    currencyDate = date || "";
}

function answer(query, now) {
    const text = String(query || "").trim();
    if (text.length < 2)
        return null;
    return dateAnswer(text, now || new Date()) || conversionAnswer(text) || mathAnswer(text);
}

// ---------------------------------------------------------------- numbers

function format(x) {
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

// ---------------------------------------------------------------- expressions

const FUNCTIONS = {
    sqrt: Math.sqrt,
    cbrt: Math.cbrt,
    abs: Math.abs,
    sin: Math.sin,
    cos: Math.cos,
    tan: Math.tan,
    asin: Math.asin,
    acos: Math.acos,
    atan: Math.atan,
    ln: Math.log,
    log: Math.log10,
    log2: Math.log2,
    log10: Math.log10,
    exp: Math.exp,
    floor: Math.floor,
    ceil: Math.ceil,
    round: Math.round,
    min: Math.min,
    max: Math.max
};
const CONSTANTS = {
    pi: Math.PI,
    "π": Math.PI,
    tau: 2 * Math.PI,
    e: Math.E
};

function tokenize(src) {
    const tokens = [];
    let depth = 0;
    let i = 0;
    while (i < src.length) {
        const rest = src.slice(i);
        let m;
        if ((m = /^\s+/.exec(rest))) {
            i += m[0].length;
            continue;
        }
        if ((m = /^0([xbo])([0-9a-f]+)\b/i.exec(rest))) {
            const radix = {
                x: 16,
                b: 2,
                o: 8
            }[m[1].toLowerCase()];
            const digits = radix === 16 ? /^[0-9a-f]+$/i : radix === 8 ? /^[0-7]+$/ : /^[01]+$/;
            if (!digits.test(m[2]))
                return null;
            tokens.push({
                kind: "num",
                value: parseInt(m[2], radix)
            });
            i += m[0].length;
            continue;
        }
        // "1,000,000", but only outside parentheses, where "," separates
        // function arguments: max(100,200).
        if (depth === 0 && (m = /^\d{1,3}(?:,\d{3})+(?:\.\d+)?(?![\d,])/.exec(rest))) {
            tokens.push({
                kind: "num",
                value: parseFloat(m[0].replace(/,/g, ""))
            });
            i += m[0].length;
            continue;
        }
        if ((m = /^(\d+(\.\d*)?|\.\d+)(e[+-]?\d+)?/i.exec(rest))) {
            tokens.push({
                kind: "num",
                value: parseFloat(m[0])
            });
            i += m[0].length;
            continue;
        }
        if ((m = /^\*\*/.exec(rest))) {
            tokens.push({
                kind: "op",
                value: "^"
            });
            i += 2;
            continue;
        }
        // "1920 x 1080" and "1920x1080" are how people type multiplication.
        if ((m = /^x(?![a-z])/i.exec(rest))) {
            tokens.push({
                kind: "op",
                value: "*"
            });
            i += 1;
            continue;
        }
        if ((m = /^[a-zπ][a-z0-9]*/i.exec(rest))) {
            const word = m[0].toLowerCase();
            if (word === "of" || word === "mod")
                tokens.push({
                    kind: "op",
                    value: word
                });
            else
                tokens.push({
                    kind: "ident",
                    value: word
                });
            i += m[0].length;
            continue;
        }
        const c = src[i];
        const ops = {
            "+": "+",
            "-": "-",
            "−": "-",
            "*": "*",
            "×": "*",
            "·": "*",
            "/": "/",
            "÷": "/",
            "^": "^",
            "%": "%",
            "!": "!",
            "(": "(",
            ")": ")",
            ",": ","
        };
        if (!(c in ops))
            return null;
        if (c === "(")
            depth++;
        else if (c === ")")
            depth--;
        tokens.push({
            kind: "op",
            value: ops[c]
        });
        i += 1;
    }
    return tokens;
}

function factorial(n) {
    if (n < 0 || n > 170 || Math.floor(n) !== n)
        return NaN;
    let r = 1;
    for (let k = 2; k <= n; k++)
        r *= k;
    return r;
}

// Recursive descent over the tokens. Each value carries a `pct` flag so that
// "240 + 15%" means 240 * 1.15 rather than 240.15.
function Parser(tokens) {
    this.tokens = tokens;
    this.pos = 0;
}

Parser.prototype.peek = function () {
    return this.tokens[this.pos];
};

Parser.prototype.isOp = function (value, offset) {
    const t = this.tokens[this.pos + (offset || 0)];
    return !!t && t.kind === "op" && t.value === value;
};

Parser.prototype.startsOperand = function (offset) {
    const t = this.tokens[this.pos + (offset || 0)];
    if (!t)
        return false;
    return t.kind === "num" || t.kind === "ident" || (t.kind === "op" && (t.value === "(" || t.value === "-" || t.value === "+"));
};

Parser.prototype.expect = function (value) {
    if (!this.isOp(value))
        throw new Error("expected " + value);
    this.pos++;
};

function plain(v) {
    return v.pct ? v.value / 100 : v.value;
}

Parser.prototype.parseExpr = function () {
    let left = this.parseTerm();
    while (this.isOp("+") || this.isOp("-")) {
        const op = this.peek().value;
        this.pos++;
        const right = this.parseTerm();
        const sign = op === "+" ? 1 : -1;
        const value = right.pct ? plain(left) * (1 + sign * right.value / 100) : plain(left) + sign * plain(right);
        left = {
            value: value,
            pct: false
        };
    }
    return left;
};

Parser.prototype.parseTerm = function () {
    let left = this.parseUnary();
    for (;;) {
        let op = null;
        if (this.isOp("*") || this.isOp("/") || this.isOp("of") || this.isOp("mod"))
            op = this.peek().value;
        // "%" is modulo only between two operands; otherwise parsePostfix took it.
        else if (this.isOp("%") && this.startsOperand(1))
            op = "mod";
        let implicit = false;
        // "2pi" and "3(4 + 5)" multiply.
        if (!op && this.peek() && (this.peek().kind === "ident" || this.isOp("("))) {
            op = "*";
            implicit = true;
        }
        if (!op)
            return left;
        if (!implicit)
            this.pos++;
        const right = this.parseUnary();
        const a = plain(left);
        const b = plain(right);
        let value;
        if (op === "*" || op === "of")
            value = a * b;
        else if (op === "/")
            value = a / b;
        else
            value = a - b * Math.floor(a / b);
        left = {
            value: value,
            pct: false
        };
    }
};

Parser.prototype.parseUnary = function () {
    if (this.isOp("-")) {
        this.pos++;
        const v = this.parseUnary();
        return {
            value: -v.value,
            pct: v.pct
        };
    }
    if (this.isOp("+")) {
        this.pos++;
        return this.parseUnary();
    }
    return this.parsePower();
};

Parser.prototype.parsePower = function () {
    const base = this.parsePostfix();
    if (!this.isOp("^"))
        return base;
    this.pos++;
    // Right-associative, and binds tighter than unary minus on its left: -2^2 = -4.
    const exponent = this.parseUnary();
    return {
        value: Math.pow(plain(base), plain(exponent)),
        pct: false
    };
};

Parser.prototype.parsePostfix = function () {
    let v = this.parsePrimary();
    for (;;) {
        if (this.isOp("!")) {
            this.pos++;
            v = {
                value: factorial(plain(v)),
                pct: false
            };
        } else if (this.isOp("%") && !v.pct && !this.startsOperand(1)) {
            this.pos++;
            v = {
                value: v.value,
                pct: true
            };
        } else {
            return v;
        }
    }
};

Parser.prototype.parsePrimary = function () {
    const t = this.peek();
    if (!t)
        throw new Error("unexpected end");
    if (t.kind === "num") {
        this.pos++;
        return {
            value: t.value,
            pct: false
        };
    }
    if (t.kind === "op" && t.value === "(") {
        this.pos++;
        const v = this.parseExpr();
        // Forgive a missing ")" at the very end; it is still being typed.
        if (this.peek())
            this.expect(")");
        return v;
    }
    if (t.kind === "ident") {
        this.pos++;
        if (FUNCTIONS[t.value] && this.isOp("(")) {
            this.pos++;
            const args = [plain(this.parseExpr())];
            while (this.isOp(",")) {
                this.pos++;
                args.push(plain(this.parseExpr()));
            }
            if (this.peek())
                this.expect(")");
            return {
                value: FUNCTIONS[t.value].apply(null, args),
                pct: false
            };
        }
        if (t.value in CONSTANTS)
            return {
                value: CONSTANTS[t.value],
                pct: false
            };
    }
    throw new Error("unexpected token");
};

function evaluate(src) {
    const tokens = tokenize(src);
    if (!tokens || tokens.length === 0)
        return null;
    const parser = new Parser(tokens);
    try {
        const v = parser.parseExpr();
        if (parser.pos !== tokens.length)
            return null;
        const value = plain(v);
        return isFinite(value) ? value : null;
    } catch (e) {
        return null;
    }
}

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
    for (const [pattern, fn, suffix] of PERCENT_PHRASES) {
        const m = pattern.exec(text);
        if (!m)
            continue;
        const a = evaluate(m[1]);
        const b = evaluate(m[2]);
        const result = a === null || b === null ? null : format(fn(a, b));
        if (result !== null)
            return result + suffix;
    }
    return null;
}

function mathAnswer(raw) {
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
    const value = evaluate(text);
    const result = format(value);
    // A result that echoes the input ("42") tells the user nothing.
    if (result === null || result === text.replace(/\s+/g, ""))
        return null;
    return {
        title: result,
        subtitle: text + " =",
        icon: "calculate"
    };
}

// ---------------------------------------------------------------- units

// Each unit converts to its category's base unit by multiplying with `f`.
// Temperatures need an offset, so they get to/from functions instead.
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

function lookupUnit(raw) {
    const name = raw.trim().replace(/\s+/g, " ");
    const lower = name.toLowerCase();
    for (const t of TEMPERATURES) {
        if (t.names.indexOf(lower) >= 0)
            return {
                category: "temperature",
                temp: t
            };
    }
    const unit = UNITS_EXACT[name] || UNITS_LOWER[lower];
    if (unit)
        return unit;
    const code = CURRENCY_ALIASES[lower] || name.toUpperCase();
    if (/^[A-Z]{3}$/.test(code) && currencyRates[code])
        return {
            category: "currency",
            factor: 1 / currencyRates[code],
            code: code
        };
    return null;
}

function convertBase(value, radix) {
    if (radix === 10)
        return format(value);
    if (Math.floor(value) !== value || Math.abs(value) > Number.MAX_SAFE_INTEGER)
        return null;
    const prefix = {
        16: "0x",
        8: "0o",
        2: "0b"
    }[radix];
    return (value < 0 ? "-" : "") + prefix + Math.abs(value).toString(radix);
}

function conversionAnswer(text) {
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
    if (radix) {
        const value = evaluate(lhs);
        const result = value === null ? null : convertBase(value, radix);
        return result === null ? null : {
            title: result,
            subtitle: lhs + " in " + rhs.toLowerCase(),
            icon: "tag"
        };
    }

    const to = lookupUnit(rhs);
    if (!to)
        return null;
    // The amount ends at a digit, ")" or "%" and the unit is whatever follows,
    // except for currency symbols, which come first: "$20", "C$20", "€5".
    let parts = /^((?:[a-z]{1,2})?[$€£¥₹])\s*(.+)$/i.exec(lhs);
    if (parts)
        parts = [lhs, parts[2], parts[1]];
    else
        parts = /^(.*[\d).%])\s*([^\d\s()][^()]*?)$/.exec(lhs);
    if (!parts)
        return null;
    const from = lookupUnit(parts[2]);
    const amount = evaluate(parts[1]);
    if (!from || amount === null || from.category !== to.category)
        return null;

    if (to.category === "currency") {
        const converted = amount * from.factor / to.factor;
        if (!isFinite(converted))
            return null;
        // Cents, unless that would round "1 jpy to usd" down to nothing.
        const shown = Math.abs(converted) >= 1 || converted === 0 ? converted.toFixed(2) : String(Number(converted.toPrecision(4)));
        return {
            title: shown + " " + to.code,
            subtitle: lhs + " · ECB, " + currencyDate,
            icon: "currency_exchange"
        };
    }

    let value;
    if (to.category === "temperature")
        value = to.temp.fromK(from.temp.toK(amount));
    else
        value = amount * from.factor / to.factor;
    const result = format(value);
    if (result === null)
        return null;
    return {
        title: result + " " + (to.temp ? to.temp.symbol : rhs),
        subtitle: lhs + " =",
        icon: to.category === "temperature" ? "thermostat" : "swap_horiz"
    };
}

// ---------------------------------------------------------------- dates

// Dates are whole days since the Unix epoch, built from the local calendar
// date so "days until" never trips over timezones or DST.
function dayOf(y, m, d) {
    return Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
}

function civil(day) {
    const d = new Date(day * DAY_MS);
    return [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()];
}

function daysInMonth(y, m) {
    return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function formatDay(day) {
    const [y, m, d] = civil(day);
    const month = MONTHS[m - 1];
    return WEEKDAYS[new Date(day * DAY_MS).getUTCDay()] + ", " + d + " " + month.charAt(0).toUpperCase() + month.slice(1) + " " + y;
}

function monthFromName(token) {
    if (token.length < 3)
        return 0;
    for (let i = 0; i < MONTHS.length; i++) {
        if (MONTHS[i].startsWith(token))
            return i + 1;
    }
    return 0;
}

// "days until march 1" means the next 1 March; "days since march 1" the last
// one. Resolving bare dates this way keeps either answer from going negative.
function parseDate(input, today, preferFuture) {
    const text = input.trim();
    if (text === "today" || text === "now")
        return today;
    if (text === "tomorrow")
        return today + 1;
    if (text === "yesterday")
        return today - 1;

    const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text);
    if (iso) {
        const y = +iso[1], m = +iso[2], d = +iso[3];
        return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m) ? dayOf(y, m, d) : null;
    }

    const tokens = text.split(/[\s,]+/).filter(t => t.length > 0);
    if (tokens.length === 0 || tokens.length > 3)
        return null;
    let month = 0, day = 0, year = 0;
    for (const token of tokens) {
        const named = monthFromName(token);
        if (named) {
            if (month)
                return null;
            month = named;
            continue;
        }
        // Ordinals are how dates get typed: "8th", "1st".
        const numeric = token.replace(/(st|nd|rd|th)$/, "");
        if (!/^\d+$/.test(numeric))
            return null;
        const value = +numeric;
        if (numeric.length === 4 || value > 31) {
            if (year)
                return null;
            year = value;
        } else {
            if (day)
                return null;
            day = value;
        }
    }
    if (!month || !day)
        return null;
    if (!year) {
        year = civil(today)[0];
        const candidate = dayOf(year, month, Math.min(day, daysInMonth(year, month)));
        if (preferFuture && candidate < today)
            year += 1;
        else if (!preferFuture && candidate > today)
            year -= 1;
    }
    return day <= daysInMonth(year, month) ? dayOf(year, month, day) : null;
}

function addMonths(day, months) {
    const [y, m, d] = civil(day);
    const total = y * 12 + (m - 1) + months;
    const ny = Math.floor(total / 12);
    const nm = total - ny * 12 + 1;
    // Jan 31 + 1 month lands on the last day of February, not in March.
    return dayOf(ny, nm, Math.min(d, daysInMonth(ny, nm)));
}

function plural(n, unit) {
    return n + " " + unit + (n === 1 ? "" : "s");
}

function stripAny(text, prefixes) {
    for (const p of prefixes) {
        if (text.startsWith(p))
            return text.slice(p.length).trim();
    }
    return null;
}

function dateAnswer(raw, now) {
    let text = raw.toLowerCase().replace(/\s+/g, " ");
    if (!/day|week|fortnight|month|year/.test(text))
        return null;
    text = text.replace(/^how many /, "");
    const today = dayOf(now.getFullYear(), now.getMonth() + 1, now.getDate());

    let rest = stripAny(text, ["days until ", "days till ", "days til ", "days untill ", "days to "]);
    if (rest !== null) {
        const target = parseDate(rest, today, true);
        if (target === null)
            return null;
        return {
            title: plural(target - today, "day"),
            subtitle: "until " + formatDay(target),
            icon: "event"
        };
    }

    rest = stripAny(text, ["days since ", "days from "]);
    if (rest !== null) {
        const target = parseDate(rest, today, false);
        if (target === null)
            return null;
        return {
            title: plural(today - target, "day"),
            subtitle: "since " + formatDay(target),
            icon: "event"
        };
    }

    // "30 days from now", "2 weeks ago", "in 3 months".
    let m = /^(\d+) (day|week|fortnight|month|year)s? (from now|from today|ahead|later|ago|before now|before today|back)$/.exec(text);
    let count, unit, sign;
    if (m) {
        count = +m[1];
        unit = m[2];
        sign = /ago|before|back/.test(m[3]) ? -1 : 1;
    } else if ((m = /^in (\d+) (day|week|fortnight|month|year)s?$/.exec(text))) {
        count = +m[1];
        unit = m[2];
        sign = 1;
    } else {
        return null;
    }

    let target;
    if (unit === "month" || unit === "year")
        target = addMonths(today, sign * count * (unit === "year" ? 12 : 1));
    else
        target = today + sign * count * {
            day: 1,
            week: 7,
            fortnight: 14
        }[unit];
    const span = plural(count, unit);
    return {
        title: formatDay(target),
        subtitle: sign > 0 ? span + " from today" : span + " ago",
        icon: "event"
    };
}

// ---------------------------------------------------------------- time zones

// Time zone abbreviations and nicknames. Cities and airport codes come from
// data/places.tsv and countries from the system's iso3166.tab, via setZones().
const ZONE_ALIASES = {
    utc: "UTC",
    gmt: "UTC",
    pst: "America/Los_Angeles",
    pdt: "America/Los_Angeles",
    pt: "America/Los_Angeles",
    pacific: "America/Los_Angeles",
    mst: "America/Denver",
    mdt: "America/Denver",
    mt: "America/Denver",
    mountain: "America/Denver",
    cst: "America/Chicago",
    cdt: "America/Chicago",
    ct: "America/Chicago",
    central: "America/Chicago",
    est: "America/New_York",
    edt: "America/New_York",
    et: "America/New_York",
    eastern: "America/New_York",
    ast: "America/Halifax",
    adt: "America/Halifax",
    nst: "America/St_Johns",
    akst: "America/Anchorage",
    hst: "Pacific/Honolulu",
    bst: "Europe/London",
    cet: "Europe/Paris",
    cest: "Europe/Paris",
    eet: "Europe/Athens",
    eest: "Europe/Athens",
    wet: "Europe/Lisbon",
    msk: "Europe/Moscow",
    ist: "Asia/Kolkata",
    pkt: "Asia/Karachi",
    sgt: "Asia/Singapore",
    hkt: "Asia/Hong_Kong",
    jst: "Asia/Tokyo",
    kst: "Asia/Seoul",
    aest: "Australia/Sydney",
    aedt: "Australia/Sydney",
    awst: "Australia/Perth",
    nzst: "Pacific/Auckland",
    nzdt: "Pacific/Auckland",
    sf: "America/Los_Angeles",
    la: "America/Los_Angeles",
    "bay area": "America/Los_Angeles",
    "silicon valley": "America/Los_Angeles",
    dc: "America/New_York",
    kl: "Asia/Kuala_Lumpur",
    usa: "America/New_York",
    us: "America/New_York",
    america: "America/New_York",
    uk: "Europe/London",
    england: "Europe/London",
    britain: "Europe/London"
};

// Countries spanning several zones resolve to their best-known one.
const COUNTRY_DEFAULTS = {
    US: "America/New_York",
    CA: "America/Toronto",
    AU: "Australia/Sydney",
    BR: "America/Sao_Paulo",
    RU: "Europe/Moscow",
    CN: "Asia/Shanghai",
    MX: "America/Mexico_City",
    ID: "Asia/Jakarta",
    KZ: "Asia/Almaty",
    AR: "America/Argentina/Buenos_Aires",
    ES: "Europe/Madrid",
    PT: "Europe/Lisbon",
    DE: "Europe/Berlin",
    NZ: "Pacific/Auckland"
};

let zoneNames = {};
let placeNames = {};
let localZone = "";

// localName is the system zone ("America/Toronto"). `date -d 15:00` reads the
// time in $TZ, so "3pm to berlin" has to name the local zone explicitly.
function setZones(zoneTab, isoTab, localName, placesTsv) {
    localZone = localName || "";
    const places = {};
    for (const line of String(placesTsv || "").split("\n")) {
        const tab = line.indexOf("\t");
        if (tab > 0 && line[0] !== "#")
            places[line.slice(0, tab)] = line.slice(tab + 1);
    }
    placeNames = places;
    const names = {};
    const byCountry = {};
    for (const line of String(zoneTab || "").split("\n")) {
        if (!line || line[0] === "#")
            continue;
        const cols = line.split("\t");
        if (!cols[2])
            continue;
        names[cols[2].split("/").pop().replace(/_/g, " ").toLowerCase()] = cols[2];
        (byCountry[cols[0]] = byCountry[cols[0]] || []).push(cols[2]);
    }
    for (const line of String(isoTab || "").split("\n")) {
        if (!line || line[0] === "#")
            continue;
        const cols = line.split("\t");
        const zones = byCountry[cols[0]];
        if (zones && cols[1])
            names[cols[1].toLowerCase()] = COUNTRY_DEFAULTS[cols[0]] || zones[0];
    }
    zoneNames = names;
}

// "" means the local zone; null means not a place.
function lookupZone(raw) {
    const name = raw.trim().replace(/^the /, "");
    if (name === "local" || name === "here" || name === "local time")
        return "";
    return ZONE_ALIASES[name] || placeNames[name] || zoneNames[name] || null;
}

function titleCase(text) {
    return text.length <= 4 ? text.toUpperCase() : text.replace(/\b[a-z]/g, c => c.toUpperCase());
}

// "3pm", "3:30 pm", "15:00", "noon". A bare "3" is too ambiguous to be a time.
function parseClock(text) {
    if (text === "noon")
        return "12:00";
    if (text === "midnight")
        return "00:00";
    const m = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/.exec(text);
    if (!m || (!m[2] && !m[3]))
        return null;
    let h = +m[1];
    const min = m[2] ? +m[2] : 0;
    if (m[3]) {
        if (h < 1 || h > 12)
            return null;
        h = h % 12 + (m[3] === "pm" ? 12 : 0);
    }
    if (h > 23 || min > 59)
        return null;
    return (h < 10 ? "0" : "") + h + ":" + (min < 10 ? "0" : "") + min;
}

// Recognises "time in tokyo", "tokyo time", "3pm pst to london" and
// "3pm london". Returns the `date` command to run and how to label its
// output, or null.
function timeQuery(raw) {
    const text = raw.trim().toLowerCase().replace(/\s+/g, " ").replace(/\?$/, "");
    let from = "", to = "", at = null, label = "";

    let m = /^(?:what(?:'s| is) the |what )?(?:current )?(?:time|now) (?:is it )?(?:in|at) (.+)$/.exec(text) || /^(.+?) time$/.exec(text);
    const place = m ? lookupZone(m[1]) : null;
    if (place) {
        to = place;
        label = titleCase(m[1]);
    } else {
        m = /^(noon|midnight|\d{1,2}(?::\d{2})? ?(?:am|pm)?) (.+)$/.exec(text);
        if (!m || !(at = parseClock(m[1].replace(" ", ""))))
            return null;
        const rest = m[2].replace(/ time$/, "");
        const cut = /^(?:(.+?) )?(?:to|in) (.+)$/.exec(rest);
        const fromName = cut ? cut[1] || "local" : rest;
        const toName = cut ? cut[2] : "local";
        from = lookupZone(fromName);
        to = lookupZone(toName);
        if (from === null || to === null || from === to)
            return null;
        label = (from ? titleCase(fromName) : "Local") + " → " + (to ? titleCase(toName) : "local time");
    }

    const command = to ? ["env", "TZ=" + to, "date"] : ["date"];
    const source = from || localZone;
    if (at)
        command.push("-d", (source ? 'TZ="' + source + '" ' : "") + at);
    command.push("+%-I:%M %p %Z|%A, %-d %B");
    return {
        command: command,
        label: label,
        live: !at
    };
}

// Turns the `date` output for a timeQuery() into a result.
function timeAnswer(spec, output) {
    const parts = String(output).trim().split("|");
    if (parts.length !== 2)
        return null;
    return {
        title: parts[0],
        subtitle: parts[1] + " · " + spec.label,
        icon: "schedule"
    };
}
