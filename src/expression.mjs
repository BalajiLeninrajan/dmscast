// A tokenizer and recursive descent parser for arithmetic. It never calls
// eval, so a query can only ever produce a number.

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

function tokenize(src) {
    const tokens = [];
    const push = (kind, value) => tokens.push({
            kind: kind,
            value: value
        });
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
            push("num", parseInt(m[2], radix));
            i += m[0].length;
            continue;
        }
        // "1,000,000", but only outside parentheses, where "," separates
        // function arguments: max(100,200).
        if (depth === 0 && (m = /^\d{1,3}(?:,\d{3})+(?:\.\d+)?(?![\d,])/.exec(rest))) {
            push("num", parseFloat(m[0].replace(/,/g, "")));
            i += m[0].length;
            continue;
        }
        if ((m = /^(\d+(\.\d*)?|\.\d+)(e[+-]?\d+)?/i.exec(rest))) {
            push("num", parseFloat(m[0]));
            i += m[0].length;
            continue;
        }
        if (rest.startsWith("**")) {
            push("op", "^");
            i += 2;
            continue;
        }
        // "1920 x 1080" and "1920x1080" are how people type multiplication.
        if (/^x(?![a-z])/i.test(rest)) {
            push("op", "*");
            i += 1;
            continue;
        }
        if ((m = /^[a-zπ][a-z0-9]*/i.exec(rest))) {
            const word = m[0].toLowerCase();
            push(word === "of" || word === "mod" ? "op" : "ident", word);
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
        push("op", OPERATORS[c]);
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
