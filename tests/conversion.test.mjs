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
