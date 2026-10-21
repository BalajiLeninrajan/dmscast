import assert from "node:assert/strict";
import { test } from "node:test";
import { ask, title } from "./helpers.mjs";

test("units", () => {
    assert.deepEqual(ask("25 GB to MB"), {
        title: "25000 MB",
        subtitle: "25 GB =",
        icon: "swap_horiz"
    });
    assert.equal(title("5 miles to km"), "8.04672 km");
    assert.equal(title("60 mph to km/h"), "96.56064 km/h");
    assert.equal(title("1 acre to sqft"), "43560 sqft");
    assert.equal(title("(2+3) km to m"), "5000 m");
});

test("case picks bits or bytes, with a fallback", () => {
    assert.equal(title("5 Mb to MB"), "0.625 MB");
    assert.equal(title("25 gb to mb"), "25000 mb");
});

test("'in' as a unit and as a keyword", () => {
    assert.equal(title("5 in to cm"), "12.7 cm");
    assert.equal(title("5 ft in m"), "1.524 m");
});

test("temperatures", () => {
    assert.equal(title("100 f to c"), "37.77777778 °C");
    assert.equal(title("300 k to c"), "26.85 °C");
});

test("no answer across categories", () => {
    assert.equal(ask("5 kg to km"), null);
});

test("bases", () => {
    assert.equal(title("255 to hex"), "0xff");
    assert.equal(title("255 to binary"), "0b11111111");
    assert.equal(title("-255 to hex"), "-0xff");
    assert.equal(title("0xff to decimal"), "255");
    assert.equal(title("1.5 to hex"), null);
});

test("currency", () => {
    assert.deepEqual(ask("20 usd to cad"), {
        title: "27.78 CAD",
        subtitle: "20 usd · ECB, 2026-10-26",
        icon: "currency_exchange"
    });
    assert.equal(title("$20 to cad"), "27.78 CAD");
    assert.equal(title("€5 to £"), "4.25 GBP");
    assert.equal(title("C$20 to usd"), "14.40 USD");
    assert.equal(title("100 rupees to euros"), "1.11 EUR");
});

test("currency keeps small amounts visible", () => {
    assert.equal(title("1 jpy to usd"), "0.00675 USD");
    assert.equal(title("0 usd to eur"), "0.00 EUR");
});

test("no answer for currencies without a rate", () => {
    assert.equal(ask("20 xyz to usd"), null);
});
