import { test } from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";

import { parseCalendarFile } from "@/lib/calendarImport";

// Build a small xlsx workbook in-memory and feed it through the parser.
// We never write a file to disk — these tests run in the unit-test loop
// and prove the parser tolerates the real-world variability of season-
// plan spreadsheets ski coaches actually keep.
function buildWb(rows: unknown[][]): ArrayBuffer {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Plan");
  return XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

test("English column names: parses 3 events in order", () => {
  const buf = buildWb([
    ["Start date", "End date", "Type", "Location", "Notes"],
    ["2026-12-04", "2026-12-08", "camp", "Saas-Fee, CH", "First snow camp"],
    ["2027-01-10", "2027-01-12", "race", "Hemsedal, NO", "FIS GS"],
    ["2027-02-05", "", "training", "Trysil, NO", "Home base"],
  ]);
  const r = parseCalendarFile(buf);
  assert.equal(r.events.length, 3);
  assert.equal(r.events[0].type, "camp");
  assert.equal(r.events[0].location, "Saas-Fee, CH");
  assert.equal(r.events[0].startDate.getUTCFullYear(), 2026);
  assert.equal(r.events[1].type, "race");
  assert.equal(r.events[2].endDate, null);
});

test("Italian column names: still parses", () => {
  const buf = buildWb([
    ["Data inizio", "Data fine", "Tipo", "Luogo", "Note"],
    ["04/12/2026", "08/12/2026", "ritiro", "Saas-Fee", "Primo blocco"],
    ["10/01/2027", "12/01/2027", "gara", "Hemsedal", "GS"],
  ]);
  const r = parseCalendarFile(buf);
  assert.equal(r.events.length, 2);
  assert.equal(r.events[0].type, "camp");        // ritiro → camp
  assert.equal(r.events[1].type, "race");        // gara → race
  assert.equal(r.events[0].startDate.getUTCMonth(), 11); // December
});

test("Unknown type → falls back to 'other' with no row dropped", () => {
  const buf = buildWb([
    ["Date", "Type", "Location"],
    ["2026-12-04", "weird_event", "Trysil"],
  ]);
  const r = parseCalendarFile(buf);
  assert.equal(r.events.length, 1);
  assert.equal(r.events[0].type, "other");
});

test("Missing start date → row skipped with warning", () => {
  const buf = buildWb([
    ["Start", "Type", "Location"],
    ["", "camp", "Saas-Fee"],
    ["2026-12-04", "race", "Hemsedal"],
  ]);
  const r = parseCalendarFile(buf);
  assert.equal(r.events.length, 1);
  assert.equal(r.warnings.length, 1);
  assert.match(r.warnings[0], /Row 2.*start date/);
});

test("Header row preceded by a title block (row 0/1 free text)", () => {
  const buf = buildWb([
    ["Trysil Race Academy — 2026/27 Calendar"],     // free-text title row
    [""],                                            // blank
    ["Start", "End", "Type", "Location"],            // real header at row 2
    ["2026-12-04", "2026-12-08", "camp", "Saas-Fee"],
  ]);
  const r = parseCalendarFile(buf);
  assert.equal(r.events.length, 1);
  assert.equal(r.events[0].location, "Saas-Fee");
});

test("Title auto-generated when missing", () => {
  const buf = buildWb([
    ["Start", "Type", "Location"],
    ["2026-12-04", "camp", "Saas-Fee"],
  ]);
  const r = parseCalendarFile(buf);
  assert.equal(r.events[0].title, "Camp · Saas-Fee");
});

test("EU dd/mm/yyyy date format parses correctly (not interpreted as US)", () => {
  const buf = buildWb([
    ["Start", "Type"],
    ["04/12/2026", "camp"],   // 4 December, not April 12
  ]);
  const r = parseCalendarFile(buf);
  assert.equal(r.events[0].startDate.getUTCMonth(), 11); // December = 11
  assert.equal(r.events[0].startDate.getUTCDate(), 4);
});
