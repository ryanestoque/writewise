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

test("worksheet links retain attempt view controls and omit conversation destinations", () => {
  const params = new URLSearchParams(
    "group=grouped&status=ready&layout=photos&q=Ada&sort=name_desc&student=private&view=comments"
  );
  const query = new URLSearchParams(review.reviewQueueQuery(params));
  assert.equal(query.get("group"), "grouped");
  assert.equal(query.get("status"), "ready");
  assert.equal(query.get("layout"), "photos");
  assert.equal(query.get("q"), "Ada");
  assert.equal(query.get("sort"), "name_desc");
  assert.equal(query.has("student"), false);
  assert.equal(query.has("view"), false);
});

test("attempt navigation keeps historical uploads inside their status filter", () => {
  const rows = review.buildReviewRows(students, [
    { id: "a-official", student_id: "ada", status: "completed", created_at: "2026-11-14" },
    { id: "a-returned", student_id: "ada", status: "returned", created_at: "2026-11-12" },
    { id: "b-official", student_id: "ben", status: "completed", created_at: "2026-11-15" },
    { id: "b-returned", student_id: "ben", status: "returned", created_at: "2026-11-13" },
  ], [
    { student_id: "ada", active_submission_id: "a-official" },
    { student_id: "ben", active_submission_id: "b-official" },
  ]);
  const navigation = review.getAttemptReviewNavigation(rows, "all", "", "oldest", attempt => attempt.status === "returned", () => null);
  assert.deepEqual(navigation.map(attempt => attempt.id), ["a-returned", "b-returned"]);
});

test("grouped navigation sorts the displayed official attempts after refresh", () => {
  const rows = review.buildReviewRows(students, [
    { id: "a-official", student_id: "ada", status: "completed", created_at: "2026-11-12" },
    { id: "a-newer", student_id: "ada", status: "rejected", created_at: "2026-11-16" },
    { id: "b-official", student_id: "ben", status: "completed", created_at: "2026-11-14" },
  ], [
    { student_id: "ada", active_submission_id: "a-official" },
    { student_id: "ben", active_submission_id: "b-official" },
  ]);
  const navigation = review.getAttemptReviewNavigation(rows, "grouped", "", "newest", () => true, () => null);
  assert.deepEqual(navigation.map(attempt => attempt.id), ["b-official", "a-official"]);
});
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

test("student navigation follows the filtered queue and keeps one worksheet per student", () => {
  const rows = review.buildReviewRows(students, uploads, states);
  const queue = review.getReviewQueueRows(
    rows,
    {
      searchQuery: "",
      statusFilter: "attention",
      uploadFilter: "all",
      sortBy: "name_desc",
    },
    () => null
  );
  const navigation = review.getReviewNavigation(
    rows,
    uploads[1],
    queue.map((row) => row.student.id)
  );
  assert.deepEqual(
    navigation.map((item) => item.student_id),
    queue.filter((row) => row.selected).map((row) => row.student.id)
  );
  assert.equal(navigation.find((item) => item.student_id === "ada").id, "retry");
  assert.equal(navigation.filter((item) => item.student_id === "ada").length, 1);
});

test("review session retains its order after sharing and does not invent a navigation position outside the queue", () => {
  const rows = review.buildReviewRows(students, uploads, states);
  assert.deepEqual(
    review.getReviewNavigation(rows, uploads[0], ["cy", "ada", "ben"]).map((item) => item.id),
    ["scored", "official"]
  );
  assert.deepEqual(review.getReviewNavigation(rows, uploads[0], ["cy"]), []);
  assert.deepEqual(review.getReviewNavigation(rows, undefined, ["cy", "ada"]), []);
});

test("queue navigation respects combined upload and search filters", () => {
  const rows = review.buildReviewRows(students, uploads, states);
  const queue = review.getReviewQueueRows(
    rows,
    {
      searchQuery: "Ada",
      statusFilter: "all",
      uploadFilter: "rejected",
      sortBy: "newest",
    },
    () => null
  );
  assert.deepEqual(
    queue.map((row) => row.student.id),
    ["ada"]
  );
});

test("shared review rows include assigned students without uploads and preserve official work", () => {
  const rows = review.buildReviewRows(students, uploads, states);
  assert.equal(rows.length, 3);
  assert.equal(rows[0].counted.id, "official");
  assert.equal(rows[0].latest.id, "retry");
  assert.equal(rows[0].selected.id, "official");
  assert.equal(rows[1].latest, undefined);
  assert.deepEqual(
    review.filterReviewRows(rows, "awaiting", "").map((r) => r.student.id),
    ["ben"]
  );
  assert.equal(review.filterReviewRows(rows, "attention", "").length, 3);
});

test("filter counts use latest upload status even when an older official worksheet completed", () => {
  const rows = review.buildReviewRows(students, uploads, states);
  const counts = review.countReviewRows(rows);
  for (const filter of [
    "all",
    "attention",
    "awaiting",
    "completed",
    "rejected",
    "returned",
    "processing",
  ]) {
    assert.equal(counts[filter], review.filterReviewRows(rows, filter, "").length);
  }
  assert.equal(counts.completed, 1);
  assert.deepEqual(
    review.filterReviewRows(rows, "completed", "").map((r) => r.student.id),
    ["cy"]
  );
  assert.deepEqual(
    review.filterReviewRows(rows, "all", "  BEN  ").map((r) => r.student.id),
    ["ben"]
  );
});

test("every roster sort applies and students without uploads remain last for upload sorts", () => {
  const rows = review.buildReviewRows(students, uploads, states);
  const score = (submission) => (submission?.id === "scored" ? 90 : null);
  const ids = (sort) => review.sortReviewRows(rows, sort, score).map((r) => r.student.id);
  assert.deepEqual(ids("newest"), ["ada", "cy", "ben"]);
  assert.deepEqual(ids("oldest"), ["cy", "ada", "ben"]);
  assert.deepEqual(ids("name_desc"), ["cy", "ben", "ada"]);
  assert.deepEqual(ids("name_asc"), ["ada", "ben", "cy"]);
  assert.deepEqual(ids("score_desc"), ["cy", "ada", "ben"]);
  assert.deepEqual(
    rows.map((r) => r.student.id),
    ["ada", "ben", "cy"]
  );
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

test("score sorting follows official results instead of newer attempts", () => {
  const rows = review.buildReviewRows(
    students,
    [
      {
        id: "ada-official",
        student_id: "ada",
        status: "completed",
        created_at: "2026-11-14",
        score: 40,
      },
      {
        id: "ada-newer",
        student_id: "ada",
        status: "completed",
        created_at: "2026-11-15",
        score: 95,
      },
      {
        id: "ben-official",
        student_id: "ben",
        status: "completed",
        created_at: "2026-11-14",
        score: 70,
      },
      {
        id: "cy-latest",
        student_id: "cy",
        status: "completed",
        created_at: "2026-11-15",
        score: 100,
      },
    ],
    [
      { student_id: "ada", active_submission_id: "ada-official", work_status: "Released" },
      { student_id: "ben", active_submission_id: "ben-official", work_status: "Draft" },
      { student_id: "cy", active_submission_id: null, work_status: "Turned in" },
    ]
  );
  const sorted = review.sortReviewRows(
    rows,
    "score_desc",
    (submission) => submission?.score ?? null
  );
  assert.deepEqual(
    sorted.map((row) => row.student.id),
    ["ben", "ada", "cy"]
  );
  assert.deepEqual(
    sorted.slice(0, 2).map((row) => row.selected.id),
    ["ben-official", "ada-official"]
  );
});
