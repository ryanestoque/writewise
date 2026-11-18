import { test } from "node:test";
import assert from "node:assert/strict";
import { summarizeAttemptSelection } from "./attempt-selection.ts";

const attempts = [
  { id: "old-a", student_id: "a" },
  { id: "new-a", student_id: "a" },
  { id: "new-b", student_id: "b" },
];

test("includes selected historical and filtered-out attempts in deletion review", () => {
  const result = summarizeAttemptSelection(attempts, new Set(["old-a", "new-a", "new-b"]), [
    "new-a",
  ]);
  assert.equal(result.studentCount, 2);
  assert.equal(result.hiddenCount, 2);
  assert.equal(result.unavailableCount, 0);
  assert.deepEqual(
    result.entries.map(({ attempt, hidden }) => [attempt.id, hidden]),
    [
      ["old-a", true],
      ["new-a", false],
      ["new-b", true],
    ]
  );
});

test("does not silently omit selected IDs absent after a refresh", () => {
  const result = summarizeAttemptSelection(attempts, new Set(["deleted", "new-a"]), ["new-a"]);
  assert.equal(result.unavailableCount, 1);
  assert.equal(result.entries.length, 1);
  assert.equal(result.studentCount, 1);
});

test("empty selection has no students or hidden attempts", () => {
  const result = summarizeAttemptSelection(attempts, new Set(), ["new-a"]);
  assert.deepEqual(result, { entries: [], studentCount: 0, hiddenCount: 0, unavailableCount: 0 });
});
