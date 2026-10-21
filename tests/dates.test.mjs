import assert from "node:assert/strict";
import { test } from "node:test";
import { ask, title } from "./helpers.mjs";

test("days until the next occurrence", () => {
    assert.deepEqual(ask("days until december 25"), {
        title: "62 days",
        subtitle: "until Friday, 25 December 2026",
        icon: "event"
    });
    assert.equal(title("days until october 8"), "349 days");
    assert.equal(title("how many days until march 1st"), "128 days");
    assert.equal(title("days till tomorrow"), "1 day");
    assert.equal(title("days to today"), "0 days");
});

test("days since the last occurrence", () => {
    assert.equal(title("days since january 1"), "296 days");
    assert.equal(title("days since 2020-01-01"), "2488 days");
});

test("invalid dates", () => {
    assert.equal(ask("days until 2027-02-29"), null);
    assert.equal(title("days until 2028-02-29"), "493 days");
    assert.equal(ask("days until feb 30"), null);
});

test("spans from today", () => {
    assert.equal(title("30 days from now"), "Monday, 23 November 2026");
    assert.equal(title("2 weeks ago"), "Saturday, 10 October 2026");
    assert.equal(title("in 3 months"), "Sunday, 24 January 2027");
    assert.equal(title("1 fortnight later"), "Saturday, 7 November 2026");
});

test("month arithmetic clamps to the month's end", () => {
    assert.equal(title("in 1 month", new Date(2027, 0, 31)), "Sunday, 28 February 2027");
});
