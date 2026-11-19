import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildForecast,
  sumDates,
  sundayOnOrAfter,
  weekDates,
  windowDates,
} from "./forecast";

// Thursday 2026-11-19 → tomorrow Fri 20, closest Sunday 22.
const T = "2026-11-19";
const TM = "2026-11-20";
const END = "2026-11-22";
const ALL = { today: true, tomorrow: true, rest: true };

test("closest Sunday on or after tomorrow", () => {
  assert.equal(sundayOnOrAfter(TM), END);
  assert.equal(sundayOnOrAfter(END), END); // Saturday: tomorrow is Sunday
  assert.equal(sundayOnOrAfter("2026-11-23"), "2026-11-29"); // Sunday: Mon → next Sun
});

test("rest of week runs from tomorrow to Sunday", () => {
  const w = windowDates(T, TM, END);
  assert.deepEqual(w.rest, ["2026-11-20", "2026-11-21", "2026-11-22"]);
  assert.deepEqual(weekDates(w, ALL).sort(), [T, "2026-11-20", "2026-11-21", END]);
});

test("full week never counts tomorrow twice; unticking works", () => {
  const rows = [
    { department: "meat" as const, product: "Beef", specs: "Ribeye · AAA", deliveryDate: T, quantity: 2, weight: "10.5" },
    { department: "meat" as const, product: "Beef", specs: "Ribeye · AAA ", deliveryDate: TM, quantity: 4, weight: null },
    { department: "meat" as const, product: "Beef", specs: "Ribeye · AAA", deliveryDate: "2026-11-21", quantity: 3, weight: null },
    { department: "meat" as const, product: "Beef", specs: "Ribeye · AA", deliveryDate: T, quantity: 1, weight: null },
    { department: "other" as const, product: "Beef", specs: "Ribeye · AAA", deliveryDate: T, quantity: 9, weight: null },
  ];
  const groups = buildForecast(rows);
  assert.equal(groups.length, 3);
  const g = groups.find((x) => x.department === "meat" && x.specs === "Ribeye · AAA")!;
  const w = windowDates(T, TM, END);
  assert.equal(sumDates(g, w.rest).quantity, 7); // tomorrow 4 + Sat 3
  assert.equal(sumDates(g, weekDates(w, ALL)).quantity, 9); // 2 + 4 + 3, not 13
  assert.equal(sumDates(g, weekDates(w, { ...ALL, today: false })).quantity, 7);
  // Unticking Tomorrow removes tomorrow even though Rest of week covers it.
  assert.equal(sumDates(g, weekDates(w, { ...ALL, tomorrow: false })).quantity, 5);
  // Unticking Rest keeps Today + Tomorrow.
  assert.equal(sumDates(g, weekDates(w, { ...ALL, rest: false })).quantity, 6);
  assert.equal(sumDates(g, weekDates(w, { today: true, tomorrow: false, rest: false })).weight, 10.5);
});
