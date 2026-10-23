import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { parsePosixTz, parseTzif, zoneAt } from "../src/tzif.mjs";
import { read } from "./helpers.mjs";

// Zones with unusual rules: half-hour and 45-minute offsets, DST of 30
// minutes or 2 hours, negative DST (Dublin), DST at midnight or 24:00,
// transitions listed year by year (Casablanca, Gaza), the southern
// hemisphere, and Winnipeg's 2026 move to permanent EST. ALL_ZONES=1 checks
// every zone in zone.tab instead, which takes a while.
const TRICKY_ZONES = ["America/New_York", "America/Los_Angeles", "America/Winnipeg", "America/St_Johns", "America/Santiago", "America/Asuncion", "America/Sao_Paulo", "America/Havana", "America/Nuuk", "Europe/London", "Europe/Dublin", "Europe/Moscow", "Africa/Casablanca", "Asia/Tehran", "Asia/Kolkata", "Asia/Kathmandu", "Asia/Gaza", "Australia/Sydney", "Australia/Adelaide", "Australia/Lord_Howe", "Pacific/Auckland", "Pacific/Chatham", "Pacific/Kiritimati", "Pacific/Pago_Pago", "Antarctica/Troll", "UTC"];

function zones() {
    if (!process.env.ALL_ZONES)
        return TRICKY_ZONES;
    return read("/usr/share/zoneinfo/zone.tab", false).split("\n").filter(line => line && line[0] !== "#").map(line => line.split("\t")[2]);
}

// Python's zoneinfo is the reference: it parses the same system files with
// its own code. ICU isn't, because Node bundles its own copy of the tz
// database, which lags the system's.
const REFERENCE = `
import json, sys
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
out = {}
for zone, times in json.load(sys.stdin).items():
    tz = ZoneInfo(zone)
    out[zone] = []
    for t in times:
        d = datetime.fromtimestamp(t, timezone.utc).astimezone(tz)
        out[zone].append([int(d.utcoffset().total_seconds()), d.tzname()])
json.dump(out, sys.stdout)
`;

function reference(timesByZone) {
    const result = spawnSync("python3", ["-I", "-c", REFERENCE], {
        input: JSON.stringify(timesByZone),
        encoding: "utf8",
        maxBuffer: 1 << 28
    });
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout);
}

// Every 6 hours for two years, and every 15 minutes across each change the
// parser sees. A change it misses still shows up on the 6-hour grid.
function sampleTimes(rules, start) {
    const times = [];
    let previous = null;
    for (let t = start; t < start + 2 * 365 * 86400; t += 6 * 3600) {
        const type = zoneAt(rules, t);
        if (previous && (type.offset !== previous.offset || type.name !== previous.name)) {
            for (let u = t - 6 * 3600 + 15 * 60; u < t; u += 15 * 60)
                times.push(u);
        }
        times.push(t);
        previous = type;
    }
    return times;
}

// Distros that ship "fat" TZif files list transitions up to 2037, so 2026
// tests the transition table. Past 2037, and on distros with slim files,
// the POSIX TZ string decides.
for (const year of [2026, 2040]) {
    test("matches zoneinfo in " + year + " and " + (year + 1), () => {
        const start = Date.UTC(year, 0, 1) / 1000 + 15 * 60;
        const rules = {};
        const times = {};
        for (const zone of zones()) {
            rules[zone] = parseTzif(read("/usr/share/zoneinfo/" + zone, true), start);
            assert.ok(rules[zone], zone);
            times[zone] = sampleTimes(rules[zone], start);
        }
        const expected = reference(times);
        for (const zone in times) {
            times[zone].forEach((t, i) => {
                const got = zoneAt(rules[zone], t);
                const [offset, name] = expected[zone][i];
                // === because POSIX rules give UTC as -0.
                if (got.offset !== offset || got.name !== name)
                    assert.fail(zone + " at " + new Date(t * 1000).toISOString() + ": " + got.offset + " " + got.name + " != " + offset + " " + name);
            });
        }
    });
}

test("POSIX TZ strings", () => {
    assert.deepEqual(parsePosixTz("<+0545>-5:45"), {
        std: {
            name: "+0545",
            offset: 20700
        },
        dst: null
    });
    const ny = parsePosixTz("EST5EDT,M3.2.0,M11.1.0");
    assert.equal(ny.std.offset, -18000);
    assert.equal(ny.dst.offset, -14400);
    assert.equal(ny.start.time, 7200);
});

test("rejects files that aren't TZif", () => {
    assert.equal(parseTzif(new ArrayBuffer(0), 0), null);
    assert.equal(parseTzif(new TextEncoder().encode("not a zone file, just some text here at all").buffer, 0), null);
});
