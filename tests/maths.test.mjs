import assert from "node:assert/strict";
import { test } from "node:test";
import { ask, title } from "./helpers.mjs";

test("arithmetic", () => {
    assert.equal(title("1920 * 0.85"), "1632");
    assert.equal(title("0.1 + 0.2"), "0.3");
    assert.equal(title("1/3"), "0.3333333333");
    assert.equal(title("1e20 * 1e5"), "1e+25");
    assert.equal(title("1,000,000 / 4"), "250000");
});

test("operators people type", () => {
    assert.equal(title("2**10"), "1024");
    assert.equal(title("1920x1080"), "2073600");
    assert.equal(title("1920 x 1080"), "2073600");
    assert.equal(title("5!"), "120");
    assert.equal(title("10 mod 3"), "1");
    assert.equal(title("7 % -3"), "-2");
});

test("precedence and implicit multiplication", () => {
    assert.equal(title("-2^2"), "-4");
    assert.equal(title("2pi"), "6.283185307");
    assert.equal(title("3(4 + 5)"), "27");
});

test("functions and an unclosed paren", () => {
    assert.equal(title("max(100,200)"), "200");
    assert.equal(title("sqrt(16"), "4");
});

test("number bases in expressions", () => {
    assert.equal(title("0xff"), "255");
    assert.equal(title("0b101 + 1"), "6");
    assert.equal(title("0b102"), null);
});

test("questions", () => {
    assert.deepEqual(ask("what is 5 * 5?"), {
        title: "25",
        subtitle: "5 * 5 =",
        icon: "calculate"
    });
});

test("no answer for non-finite results", () => {
    assert.equal(title("1/0"), null);
    assert.equal(title("0 / 0"), null);
    assert.equal(title("171!"), null);
});

test("no answer for plain words or echoes", () => {
    for (const query of ["pi", "e", "42", "firefox", "hello world", "x", "a"])
        assert.equal(ask(query), null, query);
});

test("percentages", () => {
    assert.equal(title("15% of 240"), "36");
    assert.equal(title("240 + 15%"), "276");
    assert.equal(title("240 - 15%"), "204");
    assert.equal(title("10 % 3"), "1");
});
