import { test } from "node:test";
import assert from "node:assert/strict";
import { selectReviewAttempt, needsReviewAttention } from "./activity-review.ts";
import * as review from "./activity-review.ts";

test("keeps counted work when a newer upload fails", () => {
  const attempts = [
    { id: "new", created_at: "2026-11-15", status: "rejected" },
    { id: "counted", created_at: "2026-11-14", status: "completed" },
  ];
  assert.equal(selectReviewAttempt(attempts, "counted").id, "counted");
});
test("falls back to newest upload without a counted result", () => {
  assert.equal(
    selectReviewAttempt(
      [
        { id: "old", created_at: "2026-11-14" },
        { id: "new", created_at: "2026-11-15" },
      ],
      null
    ).id,
    "new"
  );
  assert.equal(selectReviewAttempt([], null), undefined);
});
test("keeps missing work and failed newer uploads in attention queue", () => {
  assert.equal(needsReviewAttention("Released", "rejected"), true);
  assert.equal(needsReviewAttention("Missing"), true);
  assert.equal(needsReviewAttention("Draft"), true);
  assert.equal(needsReviewAttention("Released"), false);
  assert.equal(needsReviewAttention("Excused"), false);
});

const students = [
  { id: "ada", full_name: "Ada" },
  { id: "ben", full_name: "Ben" },
  { id: "cy", full_name: "Cy" },
];
const uploads = [
  { id: "official", student_id: "ada", status: "completed", created_at: "2026-11-14" },
  { id: "retry", student_id: "ada", status: "rejected", created_at: "2026-11-15" },
  { id: "scored", student_id: "cy", status: "completed", created_at: "2026-11-13" },
];
const states = [
  { student_id: "ada", active_submission_id: "official", work_status: "Released" },
  { student_id: "ben", active_submission_id: null, work_status: "Assigned" },
  { student_id: "cy", active_submission_id: "scored", work_status: "Draft" },
];

test("shared review rows include assigned students without uploads and preserve official work", () => {
  const rows = review.buildReviewRows(students, uploads, states);
  assert.equal(rows.length, 3);
  assert.equal(rows[0].counted.id, "official");
  assert.equal(rows[0].latest.id, "retry");
  assert.equal(rows[0].selected.id, "official");
  assert.equal(rows[1].latest, undefined);
  assert.deepEqual(review.filterReviewRows(rows, "awaiting", "" ).map(r => r.student.id), ["ben"]);
  assert.equal(review.filterReviewRows(rows, "attention", "").length, 3);
});

test("filter counts use latest upload status even when an older official worksheet completed", () => {
  const rows = review.buildReviewRows(students, uploads, states);
  const counts = review.countReviewRows(rows);
  for (const filter of ["all", "attention", "awaiting", "completed", "rejected", "returned", "processing"]) {
    assert.equal(counts[filter], review.filterReviewRows(rows, filter, "").length);
  }
  assert.equal(counts.completed, 1);
  assert.deepEqual(review.filterReviewRows(rows, "completed", "").map(r => r.student.id), ["cy"]);
  assert.deepEqual(review.filterReviewRows(rows, "all", "  BEN  ").map(r => r.student.id), ["ben"]);
});

test("every roster sort applies and students without uploads remain last for upload sorts", () => {
  const rows = review.buildReviewRows(students, uploads, states);
  const score = submission => submission?.id === "scored" ? 90 : null;
  const ids = sort => review.sortReviewRows(rows, sort, score).map(r => r.student.id);
  assert.deepEqual(ids("newest"), ["ada", "cy", "ben"]);
  assert.deepEqual(ids("oldest"), ["cy", "ada", "ben"]);
  assert.deepEqual(ids("name_desc"), ["cy", "ben", "ada"]);
  assert.deepEqual(ids("name_asc"), ["ada", "ben", "cy"]);
  assert.deepEqual(ids("score_desc"), ["cy", "ada", "ben"]);
  assert.deepEqual(rows.map(r => r.student.id), ["ada", "ben", "cy"]);
});

test("excused students are not awaiting an upload and unavailable work does not invent an official result", () => {
  const rows = review.buildReviewRows(students, uploads, [
    { student_id: "ben", work_status: "Excused", active_submission_id: null },
  ]);
  assert.equal(review.countReviewRows(rows).awaiting, 0);
  assert.equal(rows[0].selected, undefined);
  assert.equal(rows[0].counted, undefined);
  assert.equal(rows[0].attention, true);
});
