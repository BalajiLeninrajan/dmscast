import assert from "node:assert/strict";
import { test } from "node:test";
import { ask, title } from "./helpers.mjs";

// NOW is 13:53 UTC on Saturday, 24 October 2026: BST and EDT are still on,
// AEDT has started.

test("time in a zone city, country or abbreviation", () => {
    assert.deepEqual(ask("tokyo time"), {
        title: "10:53 PM JST",
        subtitle: "Saturday, 24 October · Tokyo",
        icon: "schedule"
    });
    assert.equal(title("time in new york"), "9:53 AM EDT");
    assert.equal(title("time in japan"), "10:53 PM JST");
    assert.equal(title("current time in the uk"), "2:53 PM BST");
    assert.equal(title("time in utc"), "1:53 PM UTC");
});

test("zones with odd offsets and rules", () => {
    assert.equal(title("time in kathmandu"), "7:38 PM +0545");
    assert.equal(title("time in adelaide"), "12:23 AM ACDT");
    assert.equal(title("time in dublin"), "2:53 PM IST");
});

test("converting a clock time between zones", () => {
    assert.deepEqual(ask("3pm pst to london"), {
        title: "11:00 PM BST",
        subtitle: "Saturday, 24 October · PST → London",
        icon: "schedule"
    });
    assert.equal(title("noon utc to est"), "8:00 AM EDT");
});

test("no answer for things that aren't times", () => {
    for (const query of ["3 tokyo", "25:00 utc", "13pm utc", "9am est to est", "constructor time", "toString time", "time in nowhereville"])
        assert.equal(ask(query), null, query);
});
