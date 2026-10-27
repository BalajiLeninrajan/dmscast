// Arithmetic and percentages. A tokenizer and recursive descent parser
// read the query; nothing calls eval, so a query can only ever produce a
// number.

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

// ------------------------------------------------------------- expressions

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

const OPERATORS = {
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

const RADIX = {
    x: 16,
    b: 2,
    o: 8
};

const RADIX_DIGITS = {
    16: /^[0-9a-f]+$/i,
    8: /^[0-7]+$/,
    2: /^[01]+$/
};

function token(kind, value) {
    return {
        kind: kind,
        value: value
    };
}

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
            const radix = RADIX[m[1].toLowerCase()];
            if (!RADIX_DIGITS[radix].test(m[2]))
                return null;
            tokens.push(token("num", parseInt(m[2], radix)));
            i += m[0].length;
            continue;
        }
        // "1,000,000", but only outside parentheses, where "," separates
        // function arguments: max(100,200).
        if (depth === 0 && (m = /^\d{1,3}(?:,\d{3})+(?:\.\d+)?(?![\d,])/.exec(rest))) {
            tokens.push(token("num", parseFloat(m[0].replace(/,/g, ""))));
            i += m[0].length;
            continue;
        }
        if ((m = /^(\d+(\.\d*)?|\.\d+)(e[+-]?\d+)?/i.exec(rest))) {
            tokens.push(token("num", parseFloat(m[0])));
            i += m[0].length;
            continue;
        }
        if (rest.startsWith("**")) {
            tokens.push(token("op", "^"));
            i += 2;
            continue;
        }
        // "1920 x 1080" and "1920x1080" are how people type multiplication.
        if (/^x(?![a-z])/i.test(rest)) {
            tokens.push(token("op", "*"));
            i += 1;
            continue;
        }
        if ((m = /^[a-zπ][a-z0-9]*/i.exec(rest))) {
            const word = m[0].toLowerCase();
            tokens.push(token(word === "of" || word === "mod" ? "op" : "ident", word));
            i += m[0].length;
            continue;
        }
        const c = src[i];
        if (!(c in OPERATORS))
            return null;
        if (c === "(")
            depth++;
        else if (c === ")")
            depth--;
        tokens.push(token("op", OPERATORS[c]));
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

// Each value carries a `pct` flag so that "240 + 15%" means 240 * 1.15
// rather than 240.15.
function number(value) {
    return {
        value: value,
        pct: false
    };
}

function plain(v) {
    return v.pct ? v.value / 100 : v.value;
}

class Parser {
    constructor(tokens) {
        this.tokens = tokens;
        this.pos = 0;
    }

    peek() {
        return this.tokens[this.pos];
    }

    isOp(value, offset) {
        const t = this.tokens[this.pos + (offset || 0)];
        return !!t && t.kind === "op" && t.value === value;
    }

    startsOperand(offset) {
        const t = this.tokens[this.pos + (offset || 0)];
        if (!t)
            return false;
        return t.kind === "num" || t.kind === "ident" || (t.kind === "op" && (t.value === "(" || t.value === "-" || t.value === "+"));
    }

    expect(value) {
        if (!this.isOp(value))
            throw new Error("expected " + value);
        this.pos++;
    }

    // Forgive a missing ")" at the very end; it is still being typed.
    closeParen() {
        if (this.peek())
            this.expect(")");
    }

    parseExpr() {
        let left = this.parseTerm();
        while (this.isOp("+") || this.isOp("-")) {
            const sign = this.peek().value === "+" ? 1 : -1;
            this.pos++;
            const right = this.parseTerm();
            left = number(right.pct ? plain(left) * (1 + sign * right.value / 100) : plain(left) + sign * plain(right));
        }
        return left;
    }

    parseTerm() {
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
            const a = plain(left);
            const b = plain(this.parseUnary());
            if (op === "*" || op === "of")
                left = number(a * b);
            else if (op === "/")
                left = number(a / b);
            else
                left = number(a - b * Math.floor(a / b));
        }
    }

    parseUnary() {
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
    }

    parsePower() {
        const base = this.parsePostfix();
        if (!this.isOp("^"))
            return base;
        this.pos++;
        // Right-associative, and binds tighter than unary minus on its left: -2^2 = -4.
        const exponent = this.parseUnary();
        return number(Math.pow(plain(base), plain(exponent)));
    }

    parsePostfix() {
        let v = this.parsePrimary();
        for (;;) {
            if (this.isOp("!")) {
                this.pos++;
                v = number(factorial(plain(v)));
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
    }

    parsePrimary() {
        const t = this.peek();
        if (!t)
            throw new Error("unexpected end");
        if (t.kind === "num") {
            this.pos++;
            return number(t.value);
        }
        if (t.kind === "op" && t.value === "(") {
            this.pos++;
            const v = this.parseExpr();
            this.closeParen();
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
                this.closeParen();
                return number(FUNCTIONS[t.value].apply(null, args));
            }
            if (t.value in CONSTANTS)
                return number(CONSTANTS[t.value]);
        }
        throw new Error("unexpected token");
    }
}

// The value of src, or null if it isn't arithmetic or isn't finite.
export function evaluate(src) {
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

// ----------------------------------------------------------------- answers

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
