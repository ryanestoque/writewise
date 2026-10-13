# WriteWise assessment dry run and future teacher-rating guide

Prepared October 14, 2026 for the October 16 evaluation-results deadline.

**Status: provisional protocol for a research-team rehearsal.** Teacher review of the adapted rubric and genuine teacher-based evaluation remain pending. This guide does not certify the rubric, the scoring engine, or diagnostic accuracy. No evaluation results are supplied here.

## 1. Purpose and permitted claims

Run two separate activities:

| Activity | Inputs | What it establishes |
| --- | --- | --- |
| Statistical workflow check | Clearly synthetic system/reference pairs | Whether calculations and reporting handle known examples |
| Exploratory worksheet comparison | Actual worksheet images, independently assigned team ratings, frozen provisional system scores | How the present scoring formulas compare with these team raters on these examples |

Neither activity fulfills the objective of comparing system scores with teacher evaluators. Label team observations **independent research-team ratings**, not synthetic ratings or teacher ratings. Label invented observations **synthetic**. Keep their reports and records separate.

For this rehearsal, compare only size consistency, spacing, slant, and baseline alignment. Collect manual letter-formation ratings as practice, but omit system formation and the five-criterion composite from performance calculations while the quality-scoring CNN is untrained or stubbed. Missing scores are not zero.

## 2. Assign roles and freeze the protocol

Recommended minimum roles:

- **Coordinator:** prepares coded worksheets, records exclusions, and collects sealed rating sheets.
- **Rater R1 and rater R2:** independently assess every evaluation worksheet. They must not see system scores or each other's ratings before submitting their own.
- **Analyst:** runs the frozen scoring configuration and merges the records after ratings are locked. The coordinator can also be the analyst.

Use writers other than the raters where practical. Record any overlap and authorship familiarity as a limitation. Future teachers should meet the adviser-approved evaluator eligibility criteria; do not silently relabel team members as teacher evaluators.

Before rating, record: purpose; worksheet instructions and exemplar; rubric version; raters and role; inclusion rules; planned sample size; code commit/configuration identifier; score-formula version; four system band boundaries; planned metrics; treatment of missing values; and date.

Freeze formulas before examining evaluation ratings. If you change them afterward, describe the work as development and evaluate the revised formulas on new independent samples. Do not treat tuning and testing on the same ratings as independent validation.

## 3. Prepare the worksheet packet

For the two-day rehearsal, aim for **12-20 evaluation worksheets plus 3 separate practice worksheets**, if feasible. This is a practical workload suggestion, not a statistically sufficient validation sample size.

Use the same approved cursive prompt, letter exemplar, and three-line ruling where possible. The prompt should provide opportunities to observe ordinary lowercase letters, ascenders, descenders, joins, and word gaps. Keep writing instructions consistent and record the prompt version.

Use adult/team-created demonstration worksheets if student material is not already authorized for this purpose. Such examples are not representative evidence about elementary learners. Deliberately varied handwriting can exercise the workflow, but record that it was selected or created for variation; do not describe it as a random classroom sample.

Assign opaque codes: worksheet `DR-001`, writer `W-01`, image `IMG-001`. Remove names from the rater-visible images. Keep the code-to-person lookup separate from analytical records. Retain the same image file for both raters and the system.

Prepare a packet containing only coded images, writing instructions, the chosen exemplar, the rating instructions, and blank rating sheets. Exclude scores, overlays, CV measurements, previous grades, names, and progress history. Give each rater a randomized worksheet order and retain the order used.

Multiple photos of one page are capture-repeatability observations, not additional independent handwriting samples. Keep a stable writer and worksheet code so this distinction is preserved.

## 4. Orient raters using practice pages

Spend approximately 20-30 minutes on the three practice pages. Both raters first score them independently, then discuss how they interpreted the rubric. Agree on what a minor versus recurring problem looks like and retain illustrated examples as provisional anchors.

This is **rater familiarization**, not model calibration. Practice pages are excluded from the reported evaluation comparison. Once evaluation starts, do not discuss individual evaluation ratings or change the rubric midway. If instructions need revision, version the protocol and start a new batch.

The current repository contains conflicting slant-angle references and scale-dependent pixel tolerances. For this provisional packet, do not prescribe an exact numerical angle, pixel tolerance, or newly invented percentage-of-errors cutoff as an authoritative Zaner-Bloser standard. Use the chosen letter exemplar and qualitative consistency descriptors. A qualified teacher/expert must confirm the intended standard before formal evaluation.

## 5. Instructions to give each rater

> Please assess the visible handwriting on the coded worksheet using the supplied exemplar and rubric. Select one band for each criterion independently. Judge the whole submission rather than one unusually good or poor letter. Do not infer pen movements that cannot be observed in the image. Do not consult another evaluator or view system output before submitting your ratings. If an image or criterion cannot be judged, mark it not assessable and explain why. Your ratings will be preserved as submitted; disagreements will not be silently corrected.

### What to inspect

| Criterion | Observable evidence | Avoid these errors |
| --- | --- | --- |
| Letter formation | Shapes, closures, loops, and joins relative to the supplied exemplar | Treating every permitted letter variant as wrong; inferring pencil lifts or stroke order from a still image |
| Size consistency and proportion | Similar heights for comparable letters; appropriate lowercase, ascender, and descender proportions relative to ruling | Expecting every letter to be equally tall or treating normal descenders as size errors |
| Spacing | Distinguishable word gaps and reasonably consistent letter/connector rhythm | Requiring detached printed-letter gaps in connected cursive |
| Slant | Consistent direction of comparable strokes relative to the exemplar | Confusing camera/page rotation with letter slant; enforcing unresolved degree cutoffs |
| Baseline alignment | Comparable letter bodies resting consistently on the baseline | Penalizing normal descenders merely for extending below the baseline |

### Bands and numeric encoding

Use the existing four project bands separately for each criterion:

| Code | Band | Provisional qualitative interpretation | Existing internal anchor |
| --- | --- | --- | --- |
| 1 | Needs Improvement | Substantial or recurring difficulties with this criterion across the submission | 12.5 |
| 2 | Developing | Control is emerging, but noticeable inconsistencies recur | 37.5 |
| 3 | Satisfactory | Mostly controlled, with minor or occasional deviations | 62.5 |
| 4 | Excellent | Consistently controlled across the observable submission | 87.5 |

These are a practical summary of existing project descriptions, not a newly validated criterion-specific rubric. Confirm with illustrated teacher-reviewed anchors before a formal study. The numeric anchors are internal scale positions, **not measured percentages of correct letters**. Raters select bands, not arbitrary percentages.

Rate each criterion on its own evidence. A formation problem does not automatically lower spacing, slant, or every other criterion. When unsure, compare with the agreed practice anchors, record uncertainty and a brief observation, and choose the best-supported band. If necessary evidence is absent or obscured, use `NA` with a reason instead of guessing.

### Copyable rating sheet

Worksheet code: ______  Image code: ______  Rater code: ______

Rater role: team / teacher   Rubric version: ______   Date: ______

Image assessable: yes / no   Reason if no: ____________________

| Criterion | Band (1-4 or NA) | Brief observable evidence / uncertainty |
| --- | --- | --- |
| Letter formation | | |
| Size consistency | | |
| Spacing | | |
| Slant | | |
| Baseline alignment | | |

Confirmation: I rated independently, without seeing system scores or another rater's ratings. ______

## 6. Preserve independent ratings

Collect and lock the two original sheets before revealing scores or discussing disagreements. Preserve one record per **worksheet-image-rater**, including missingness and notes. Keep numeric band codes and original band labels.

The current app stores only one manual-score record per submission; a later entry can overwrite an earlier one. Preserve R1 and R2 separately in external research records. Do not have them successively enter ratings into the same app record and assume both survive.

For the rehearsal, compare the system separately with R1 and R2. Do not select whichever rater gives the larger correlation. Do not average the band codes and pretend the result is a new observed rubric category.

After locking, discuss differences for improving future instructions. Retain originals. Any later consensus/adjudicated label must be a separate field with its method documented. Agreement between raters is computed from the original independent ratings, before consensus.

## 7. Obtain actual provisional system scores

Run the same coded image files through a frozen WriteWise version. Record the four CV-derived scores and the raw measurements separately, along with configuration/version and processing status.

Current manual mode returns empty automatic rubric-score fields. Current calibrated mode can populate all five fields even when formation is a stub or an untrained output. Therefore, score extraction/presentation must explicitly exclude that formation output and its composite; switching the flag alone is not evidence of genuine quality scoring. The agreed app pending-state changes are a separate implementation task from this guide.

Do not manually invent system scores for the actual-image comparison. If actual four-criterion scores cannot be obtained in time, present only the synthetic statistical demonstration and the collected manual-rating workflow, identifying this limitation.

When exporting stored submissions, use the authorized `research/export_dataset.py` route; do not add ad hoc SQL exports. Preserve the separate rater sheets and pair them by coded worksheet/submission identity afterward. Validate the join: never pair records merely because they occupy the same row position.

Report quality-gate failures and reasons. Exclude unassessable or missing pairs criterion by criterion, using rules established beforehand, and report the exclusions. Do not count rejected submissions as successful assessments or replace missing scores with zero.

## 8. Assemble the paired analysis table

Use one record per worksheet-image-criterion-rater:

| Field | Example or meaning |
| --- | --- |
| dataset_source | `team_dry_run`, `synthetic`, or later `teacher_evaluation` |
| writer_code, worksheet_code, image_code | Opaque stable identifiers |
| criterion | `spacing`, for example |
| rater_code, rater_role | `R1`, `team` |
| manual_band | Original ordinal code 1-4, or missing |
| system_score | Actual frozen four-criterion output on 0-100, or missing |
| system_band | Frozen mapping of score to 1-4, or missing |
| protocol_version, rubric_version, scoring_version | Reproducibility information |
| status, exclusion_reason | Processing and assessability information |

For the dry run, a documented provisional band mapping can use: `[0,25)` -> 1; `[25,50)` -> 2; `[50,75)` -> 3; `[75,100]` -> 4. These boundaries follow the reference display's broad ranges, are not teacher-calibrated, and must remain unchanged after results are seen. Avoid the conflicting composite-band helpers; no five-criterion composite is evaluated now.

## 9. Analyze three separate questions

### A. Does the system order worksheets similarly to each rater?

For each of the four criteria, compute Spearman correlation between **system score** and **manual band**, separately for R1 and R2. The internal numeric anchors have the same rank order as bands. Use average ranks for tied values; do not use the simple no-ties rank-difference shortcut on tied rubric ratings.

Do not pool all criteria, count two ratings as two independent worksheets, or count word crops as worksheet-level observations. Record paired N and unique writers. A constant score or constant band makes correlation undefined; report `NA/undefined`, not zero association or success.

For a small, tied rehearsal, emphasize descriptive estimates. SciPy cautions that its usual Spearman p-value approximation is accurate only for very large samples and recommends permutation testing for small samples. Repeated worksheets from the same writer introduce dependence; formal inference must account for that design. Do not use an unqualified small-sample p-value as proof of accuracy. Report uncertainty only using a method appropriate to the sampling structure.

The existing `research/analyze_correlations.py` mainly correlates raw measurements/deviations with manual ratings for calibration. It does not by itself cover this final-score comparison or all agreement/reliability metrics. Do not relabel its raw-measurement report as evaluation of final system scores.

### B. Do system bands match the rater's bands?

For each criterion and each rater report:

- Exact band agreement: identical system/manual bands divided by assessable pairs.
- Mean absolute band difference: average of `abs(system_band - manual_band)`; describe it as band steps, not a percentage error in handwriting quality.
- A 4-by-4 band confusion table, retaining categories 1-4 even if some are absent.
- Optionally, linear-weighted Cohen's kappa, with weighting and missing-pair rules stated. It can be unstable or undefined in degenerate samples; do not force a result.

Inspect systematic over/under-scoring. High correlation can coexist with poor exact agreement. These band measures supplement rather than replace the required correlation.

### C. Do the raters agree with one another?

Compare original R1 versus R2 bands per criterion using exact agreement and, where estimable, linear-weighted Cohen's kappa. Describe this as **team-rater agreement** now; later it becomes teacher-rater agreement when genuine teachers independently rate the samples.

Do not automatically apply ICC to individual ordinal bands. If the formal study chooses ICC for an appropriate numeric outcome, specify and justify its model, single/average measure, and agreement/consistency definition. One repeat of identical software input establishes computational repeatability, not teacher agreement.

## 10. Check statistical calculations with synthetic examples

Use completely separate labeled fixtures to check:

- Same ordered values: Spearman +1, provided there is variation.
- Reversed ordered values: Spearman -1.
- Identical valid bands: 100% exact agreement and zero mean band difference.
- Similar ranking but shifted bands: high association with lower exact agreement.
- Tied bands, constant inputs, missing values, and no assessable pairs: appropriate handling and clear reporting.

Never adjust synthetic ratings to obtain an impressive number and present that number as observed performance. Synthetic fixtures test calculations, not the assessment's correctness. A single random fixture is not guaranteed to have zero correlation.

## 11. Report for October 16

Prepare two separately labeled outputs:

1. **Statistical Workflow Check - Synthetic Data:** expected versus obtained calculations and handling of edge cases.
2. **Exploratory System Comparison - Research-Team Ratings:** actual four-criterion scores and team ratings, sampling method, N and unique writers, rater independence, formula/rubric version, exclusions, per-criterion correlations, band agreement, and rater agreement.

Include the rating packet, original independent sheets, paired data, frozen configuration, and calculation method as supporting material. Retain inconvenient results. Do not claim to meet a correlation target merely because an intentionally constructed fixture does so.

Suggested presentation statement:

> We rehearsed the independent rating and statistical evaluation workflow using research-team ratings of actual worksheets and separate synthetic calculation checks. The system comparison covers four provisional CV-scored criteria. These observations do not establish teacher agreement, elementary-classroom validity, or CNN letter-formation scoring accuracy. The original teacher-based evaluation remains pending.

Score correlation also does not validate every diagnostic highlight or coaching recommendation. Those require an additional appropriate expert review/annotation study before claims about diagnostic localization correctness.

### Two-day working schedule

| When | Work |
| --- | --- |
| October 14 | Freeze protocol/configuration; prepare coded packet and three practice pages; orient raters; start independent ratings |
| October 15 | Lock ratings; obtain actual scores; check pairing and calculations; analyze four criteria; prepare clearly labeled reports |
| October 16 | Present the actual observations, synthetic workflow check, limitations, and proposed teacher-evaluation continuation |

## 12. Transition to genuine teacher evaluation

Have qualified teachers/adviser review the adapted rubric, exemplar alphabet, qualitative anchors, unresolved slant standards, tolerances, and study protocol first. The expert rubric-validation instrument evaluates content/clarity, not system-versus-teacher score accuracy; complete both kinds of evaluation where required.

Repeat familiarization with pages excluded from evaluation. Obtain independent teacher ratings, preserve their identities as opaque rater codes, retain original sheets, and use the same blinding/pairing procedures.

Before using teacher ratings for training or formula tuning, separate development/calibration and independent evaluation data. Keep all pages, repeated photos, and derived crops from a writer together when evaluating generalization to new writers. Plan an adequate sample size and uncertainty analysis with the adviser/statistician; the rehearsal's convenience count is not the final study design.

Choose a reference-label rule before evaluation (for example, a documented teacher panel/adjudication process). Preserve raw ratings for reliability analysis even if an adjudicated label is used for training. Do not silently infer a majority from only two disagreeing raters.

Train and verify the real formation-quality model on appropriate development labels. Freeze the full scoring pipeline. Only then include formation and the full composite in an independent five-criterion teacher comparison. Team rehearsal ratings do not silently become teacher labels, and synthetic pairs must never be included in empirical evaluation.

## References and project sources

- Existing project definitions and anchors: [Expert Rubric & Criteria Validation Instrument](EXPERT_RUBRIC_VALIDATION_INSTRUMENT.md), sections 3 and 6; [DESIGN](../DESIGN.md), criterion-specific feedback; [Calibration Scoring Guide](../CALIBRATION_SCORING_GUIDE.md). Their current descriptions require the clarifications noted above.
- [SciPy Spearman documentation](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.spearmanr.html): rank correlation, constant inputs, and small-sample inference caveat.
- [Scikit-learn Cohen's kappa documentation](https://scikit-learn.org/stable/modules/generated/sklearn.metrics.cohen_kappa_score.html): category agreement and linear/quadratic weighting.
- [Scikit-learn grouped cross-validation](https://scikit-learn.org/stable/modules/cross_validation.html#cross-validation-iterators-for-grouped-data): separate subjects/groups across model development and evaluation.
- [Koo and Li, ICC guidance](https://pubmed.ncbi.nlm.nih.gov/27330520/): selecting/reporting ICC according to the study design.
- [Bland and Altman, measurement agreement](https://pubmed.ncbi.nlm.nih.gov/2868172/): correlation does not establish agreement.
- [ASA Ethical Guidelines](https://www.amstat.org/your-career/ethical-guidelines-for-statistical-practice): disclose sources, intended use, methods, and limitations.
