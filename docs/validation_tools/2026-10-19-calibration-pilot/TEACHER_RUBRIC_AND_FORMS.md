# Draft Analytic Rubric and Study Forms

Use with [PROTOCOL.md](PROTOCOL.md). Status: proposed rubric for two-teacher content review, practice, and revision before formal scoring. No completed expert review or empirical validation is implied.

Print separate independent scoring forms for T1 and T2. Store filled forms, actual images, and analytical records in controlled study storage, not in Git. The blanks here are intentional response fields.

## 1. How to apply the rubric

- Rate the visible handwriting, criterion by criterion, using the same expectations across available grades. Do not infer a score from the child's age, identity, language understanding, or previous work.
- Use one band per criterion: 1 Needs Improvement, 2 Developing, 3 Satisfactory, 4 Excellent. Choose the descriptor that best represents the page. “Occasional” and “frequent” are qualitative draft terms for teachers to clarify with approved examples; no empirical frequency thresholds have yet been established.
- Consider the whole page. A single weak word does not automatically determine every criterion. Formation, size, spacing, slant, and baseline can receive different bands.
- Accept legitimate cursive variants, necessary pen lifts for dots/crossbars and permitted joins, ordinary left-handed writing, and expected ascender/descender extensions. Agree on relevant school conventions during review and record them before use.
- Judge size using comparable letter bodies and appropriate tall/descending proportions. Judge baseline using the bodies/resting parts of letters, not the tips of legitimate descenders. Avoid counting the same feature as an automatic defect in every criterion.
- Use `U` if the image or amount of writing does not support a defensible criterion rating. Explain why. Readable weak handwriting can receive band 1; poor visibility or insufficient evidence must not automatically receive band 1.
- Record original ratings before any discussion. Assess original teacher agreement before adjudication. Pixel cutoffs, numeric slant targets, app badges, and CNN predictions are not grading instructions.

## 2. Proposed five-by-four analytic rubric

| Criterion | 1 — Needs Improvement | 2 — Developing | 3 — Satisfactory | 4 — Excellent |
| --- | --- | --- | --- | --- |
| Letter formation | Many shapes or joins are unclear, incomplete, or distorted enough to make words difficult to recognize. | Most intended forms are recognizable, but repeated shape, closure, or joining problems interrupt clarity. | Shapes and appropriate joins are mostly clear; occasional local defects do not substantially obscure words. | Forms and appropriate joins are consistently clear and controlled; only isolated minor defects appear. |
| Size consistency | Comparable letter bodies repeatedly vary greatly in height, or tall/body/descending proportions are often difficult to distinguish. | Repeated changes in comparable body height or proportions are visible, although the intended height groups can usually be identified. | Comparable bodies are mostly consistent and tall/descending proportions are mostly appropriate, with occasional deviations. | Comparable body heights and appropriate tall/descending proportions remain consistent across the page, with only isolated minor deviations. |
| Spacing | Frequent crowding or excessive separation obscures word boundaries or disrupts the rhythm within words. | Word boundaries are usually identifiable, but recurring crowding, large gaps, or uneven within-word rhythm interrupts flow. | Word separation and within-word rhythm are mostly clear and regular, with occasional uneven gaps. | Word boundaries are clear and comparable spacing remains regular across the page, with only isolated minor unevenness. |
| Slant uniformity | Principal strokes frequently change direction or inclination, producing visibly conflicting orientations. | A predominant inclination is apparent, but repeated changes in stroke direction disrupt parallelism. | Principal strokes mostly share a coherent accepted inclination, with occasional local changes. | Principal strokes maintain a coherent accepted inclination and parallel appearance across words and lines, with only isolated minor changes. |
| Baseline alignment | Letter bodies repeatedly float above, sink through, or drift substantially away from the intended baseline. | Repeated floating, sinking, or drift is visible, although much of the writing relates to the intended baseline. | Letter bodies mostly rest consistently in relation to the baseline, with occasional local floating, sinking, or drift. | Letter bodies maintain a stable relationship to the baseline across the page, with only isolated minor deviations. |

Draft convention for slant: assess coherent inclination/parallelism, with the teachers documenting acceptable cursive orientations before use. A separate preference for an exact angle is not silently part of these bands. The current scoring implementation's mean-angle target does not by itself measure this construct; see SOFTWARE_READINESS.md.

These descriptors deliberately avoid unverified “±2 pixels,” angle intervals, or an assumption that every letter should touch the baseline. Teachers can revise the language and examples before the version is frozen. A major construct change also requires checking the corresponding CV feature and analysis recipe.

## 3. Numeric representation after rating

| Recorded band | Label | Existing application anchor |
| --- | --- | --- |
| 1 | Needs Improvement | 12.5 |
| 2 | Developing | 37.5 |
| 3 | Satisfactory | 62.5 |
| 4 | Excellent | 87.5 |
| U | Unscorable | No numeric value |

The anchors are generated representations of ordinal labels. Teachers select bands; they do not claim to have measured an exact percentage. Unresolved/U values are not converted to zero. No score averaging is used to resolve band disagreements.

## Form A — Individual content review

Complete separately before the teachers' joint discussion. Record profile details in the controlled review record; no child information belongs here.

Reviewer code: T1 / T2  
Date: ____________________  Draft rubric version: ____________________  
Teaching role, grades taught, cursive/penmanship experience, and years of experience: ____________________

| Review item | Accept / revise / not assessable | Specific comment or proposed wording |
| --- | --- | --- |
| Formation is observable and distinguishes accepted variants from defects | ____________________ | ____________________ |
| Size compares appropriate bodies/proportions rather than different letter types indiscriminately | ____________________ | ____________________ |
| Spacing distinguishes word separation and within-word rhythm | ____________________ | ____________________ |
| Slant assesses the intended construct and agreed style conventions | ____________________ | ____________________ |
| Baseline permits legitimate descenders and uses the correct ruling reference | ____________________ | ____________________ |
| Four descriptors per criterion are distinguishable and usable | ____________________ | ____________________ |
| Shared expectations are appropriate for task-quality ratings across the actual children | ____________________ | ____________________ |
| Language, tasks, and expected effort are appropriate | ____________________ | ____________________ |
| U/unresolved rules are clear | ____________________ | ____________________ |

Independent recommendation: accept for this pilot / accept after stated revisions / substantial revision required.  
Comments and limits of review: ____________________

This form records preliminary qualitative content evidence. Do not turn two reviewers' agreement into a claim of comprehensive validation or independent validation by a larger expert panel. If the existing EXPERT_RUBRIC_VALIDATION_INSTRUMENT.md is also used, attach the reviewed rubric and reconcile conflicting angle/pixel wording before issuing it.

## Form B — Joint revision and practice record

| Field | Entry |
| --- | --- |
| Draft version and date | ____________________ |
| Teacher comments incorporated / reason for any not incorporated | ____________________ |
| Accepted cursive forms, joins, slant conventions, and size relationships | ____________________ |
| Practice sample IDs; identify researcher-written examples | ____________________ |
| Differences in practice ratings and agreed interpretation | ____________________ |
| Actual minutes per practice page, T1 / T2 | ____________________ |
| Approved rubric and prompt versions/date | ____________________ |
| T1 / T2 approval for use after revisions | ____________________ |
| Any limitations or need for further review | ____________________ |

Keep both initial review forms, the change record, and the approved rubric. Practice ratings never enter the formal agreement table or model dataset.

## Form C — Independent scoring sheet

One copy per rater. Do not show the other rater's copy. Include every worksheet in that rater's assigned shuffled order; attach additional blank rows as needed. Raters see coded canonical photos and the frozen rubric only.

Rater: T1 / T2  
Rubric version: ____________________  Date/time started: ____________________  Date/time finished: ____________________

Write 1–4 or U in each criterion cell. Do not write app percentages.

| Worksheet code | Canonical capture ID | Formation | Size | Spacing | Slant | Baseline | Brief evidence or U reason |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ____________________ | ____________________ | ____ | ____ | ____ | ____ | ____ | ____________________ |
| ____________________ | ____________________ | ____ | ____ | ____ | ____ | ____ | ____________________ |
| ____________________ | ____________________ | ____ | ____ | ____ | ____ | ____ | ____________________ |
| ____________________ | ____________________ | ____ | ____ | ____ | ____ | ____ | ____________________ |
| ____________________ | ____________________ | ____ | ____ | ____ | ____ | ____ | ____________________ |
| ____________________ | ____________________ | ____ | ____ | ____ | ____ | ____ | ____________________ |

Recorded without seeing system predictions or the other teacher's ratings: yes / deviation recorded here: ____________________  
Copy secured before discussion by: ____________________  Date/time: ____________________

## Form D — Adjudication record

One row per worksheet and criterion, including agreements. Enter the original values exactly; retain Form C unchanged. Write one agreed band 1–4 or `UNRESOLVED` in the final column. Agreement on a band may be reached after reviewing evidence even if an initial rating was U; preserve that fact and explain it.

Rubric version: ____________________  Discussion date/time: ____________________

| Worksheet / capture | Criterion | T1 original | T2 original | Final band / UNRESOLVED | Reason / confirmation |
| --- | --- | --- | --- | --- | --- |
| ____________________ | Formation | ____ | ____ | ____________________ | ____________________ |
| ____________________ | Size | ____ | ____ | ____________________ | ____________________ |
| ____________________ | Spacing | ____ | ____ | ____________________ | ____________________ |
| ____________________ | Slant | ____ | ____ | ____________________ | ____________________ |
| ____________________ | Baseline | ____ | ____ | ____________________ | ____________________ |

All five agreed and eligible for current app entry? yes / no  
Responsible teacher entry / app submission ID / date: ____________________  
If partial: keep in controlled records; do not insert a fabricated fifth band.

## Form E — Restricted participant and worksheet manifest

Keep this away from rater packets. No full name is required in the analytical manifest; the responsible teacher maintains any identifiable linkage separately.

| Participant code | Grade | Prior cursive instruction, as reported | Actual recruitment method | Assigned order | Notes on assistance/material deviations |
| --- | --- | --- | --- | --- | --- |
| ____________________ | ____ | ____________________ | ____________________ | ____________________ | ____________________ |

| Worksheet code | Activity / core or optional | Order / completion status | Prompt / rubric version | Physical sheet retained? | Canonical capture ID / submission ID |
| --- | --- | --- | --- | --- | --- |
| ____________________ | ____________________ | ____________________ | ____________________ | ____________________ | ____________________ |

Completion statuses: completed / partial / stopped / declined / not offered. Optional nonparticipation is recorded separately from core completion. Record actual assistance, including reading the prompt aloud.

## Form F — Capture attempts and coverage log

One row per capture attempt. Repeated captures do not become new worksheets. Do not delete rejected attempts after a successful retry.

| Worksheet | Capture ID / date-time | App submission ID | Accepted / rejected / not uploaded | Error code or capture defect | Same physical writing? | Retained source available? | Canonical? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ____________________ | ____________________ | ____________________ | ____________________ | ____________________ | ____________________ | ____________________ | ____________________ |

If no accepted capture: reason and teacher-readable photo/paper availability: ____________________  
Mode/artifact/pipeline version reference: ____________________

## End-of-day reconciliation

- [ ] Distinct participant count is separate from worksheet, capture, and crop counts.
- [ ] Every attempted core worksheet has a completion/capture outcome, including stopped or rejected cases.
- [ ] Core and optional pages are marked correctly; practice pages are excluded.
- [ ] Both teachers rated the same canonical image and both original form sets are retained.
- [ ] Missing/unscorable/unresolved entries have reasons and are not converted to zero or an invented band.
- [ ] All adjudicated bands are traceable to their worksheet, criterion, rubric version, and original ratings.
- [ ] App entry was checked against the final full five-band record; partial records remain separately identified.
- [ ] Filled forms/captures and the teacher-held linkage key have controlled storage; none are staged in Git.
