# Software Readiness for the October 19 Pilot

Status: planning checklist based on source inspection on October 17, 2026. Items below have not been implemented or verified by writing this packet. No migration or product code change is included in the packet.

Research design: [PROTOCOL.md](PROTOCOL.md). The field data can be collected using coded paper forms even while offline analysis work remains unfinished. Do not describe the current scripts as implementing the agreed grouped evaluation.

## 1. Confirmed gaps and required behavior

### Independent and partial teacher ratings

Current source: `supabase/migrations/0007_manual_score.sql` declares a unique `submission_id` and five non-null bands. `backend/app/api/submissions.py` updates the existing score row, including `graded_by`. The app cannot retain both independent teachers' ratings, adjudication history, or a partial five-criterion score. Phase 1 UI exposes evaluative CV information.

- [ ] Use this packet's separate coded-photo/form workflow for independence; preserve both first ratings and final adjudication outside the single app row.
- [ ] Validate all five final values before authorized app entry. Do not overwrite an original teacher record and then call the remaining row independent agreement evidence.
- [ ] Add controlled offline support for criterion-level agreed/unresolved labels. Its input must be research forms linked to officially exported anonymized worksheet/student codes, not an ad hoc database extraction or browser service-role path.
- [ ] Preserve unresolved/U status, original rater IDs, rubric version, canonical capture ID, core/optional status, and worksheet code in the research manifest. Require exactly one final label/status per worksheet/criterion and detect duplicate/conflicting entries.

### Export provenance and label encoding

Current source: `research/export_dataset.py` exports only completed submissions with measurements and full manual scores. It exports `student_code` with worksheet measurements and `submission_code` with crops. Crop rows have `crop_path`, `submission_code`, `word_index`, `band`, and `score`, but lack direct child-group and activity/core/optional/retry metadata. Codes are assigned using fresh dictionaries per run. The measurement-to-crop and app-to-study-code joins must be preserved. Exported bands are snake_case, while `research/analyze_correlations.py` uses title-case band names for band grouping.

- [ ] Extend or join the official exporter outputs to retain the anonymized student-to-submission-to-crop relationship and the study manifest fields. All app dataset export/anonymization remains in `research/export_dataset.py`.
- [ ] Preserve an export-run ID and controlled app-ID-to-anonymized-code/worksheet linkage, or implement a controlled stable mapping. Do not assume newly assigned codes match previous runs. Add explicit export support for rejected-attempt coverage and criterion-partial records; the current completed/full-score filter omits them.
- [ ] Join crop rows to the measurement/student manifest before any split; fail on unknown or ambiguous child grouping. Do not treat submission code alone as a child identifier.
- [ ] Normalize the four valid band encodings at a documented boundary. Reject unknown values explicitly; do not silently replace an unrecognized label with Satisfactory.
- [ ] Include only one canonical capture per physical worksheet in fitting/evaluation; retain all rejected attempts in a separate coverage record.
- [ ] Preserve criterion-specific eligibility. An unresolved spacing label must not discard an otherwise agreed formation label just because app storage requires all five.
- [ ] Validate crop provenance against the upload pipeline. The current exporter resegments images without the upload path's `expected_word_count`; verify consistent crop count/order or version and explain differences before using inherited labels.

### Child-grouped analysis

Current source: `training/stage2_calibrate.py::load_paired_dataset` randomly splits individual crops 90/10, and uses identical training and validation data when fewer than ten crops exist. It does not consume a child-group manifest. `research/analyze_correlations.py` computes raw-measurement correlations and derives constants on the supplied same records; it does not perform leave-one-child-out calibrated-score prediction. Its report can compare `abs(rho)` with 0.70. Its generated `calibration_constants.json` is not loaded by the current ScoreProvider. No existing Stage 2 evaluator implements the agreed grouped worksheet evaluation.

- [ ] Build leave-one-child-out splits from the anonymized child ID, not crop/page/attempt IDs. Assert no held-out child's page, crop, retry, or augmentation is in training or internal validation.
- [ ] Fit mappings, transformations, and Stage 2 only on the outer training children. If an internal validation split is required, use training children only; never use the outer child's loss for early stopping.
- [ ] Freeze the model recipe before examining held-out predictions. Save its exact feature list, numeric band boundaries, training epoch/selection rule, seeds, and software versions. Set the baseline modal-band tie rule explicitly; a reproducible default is the lowest tied training band.
- [ ] Run final calibrated scoring on the outer held-out worksheets and evaluate those outputs. Raw metric correlation and fitted-on-all-data correlation must be labeled separately.
- [ ] Connect fitted per-fold constants to the scoring invocation through the ScoreProvider abstraction. Merely generating a JSON file does not change the provider's hardcoded placeholders. Never silently replace missing formation evidence with the provider's fallback score during research evaluation.
- [ ] Fail or explicitly flag insufficient training-band variation. Never hide a placeholder threshold behind the term “empirical calibration.” Report which folds/criteria could not be fit and which used an explicitly labeled constant baseline.
- [ ] Compare with training-only baselines and save out-of-fold predictions before any final full-data refit. Report positive-direction final-score rho; a negative final-score correlation does not pass via absolute value.
- [ ] Use original independent ratings for teacher agreement and adjudicated labels for reference comparison. Prespecify linear kappa weighting. Treat undefined statistics as not estimable and report contributing children/pages.
- [ ] Core A–D defines primary fitting/evaluation. Any E–F-inclusive procedure produces a separate supplementary report while preserving child grouping.
- [ ] Keep formation evaluation at worksheet level. Preserve the document's weak-label limitation and record how word/page weighting is handled during training. No word-level accuracy claim follows from page labels.

### Construct-to-feature alignment

Existing teacher references conflict before any calibration: `docs/validation_tools/EXPERT_RUBRIC_VALIDATION_INSTRUMENT.md` equates 60–68 degrees from horizontal with 10–15 degrees from vertical, which are not complementary intervals. `frontend/components/rubric-reference-dialog.tsx` uses a different horizontal slant range and a scale-dependent baseline tolerance of ±2 pixels. The CV design instead normalizes distances by guideline height. Reconcile these references with the teacher-approved construct before issuing them; this packet's draft rubric does not adopt their numeric cutoffs.

Current source: `backend/app/cv/features/slant.py` estimates each word's mean Hough-stroke angle; aggregation computes worksheet mean/std across those word means. `backend/app/scoring/provider.py` currently scores distance of the slant mean from a placeholder target and does not use that std. That std does not itself describe all within-word angle variation.

Current source: `backend/app/cv/features/size.py` derives a word core-ink vertical-span ratio within a guideline-related band; worksheet mean/std summarize word ratios. The provider currently scores the distance of the mean from a placeholder target. These are proxies, not individually verified letter-body heights.

- [ ] Have teachers approve the intended slant and size constructs before scoring. Do not redefine teacher ratings to match placeholder formula outputs.
- [ ] Document the selected existing features and their limitations before evaluating held-out data. If the rubric measures consistency, justify how the selected summary measures consistency rather than only average target distance.
- [ ] Check baseline measurement treatment of legitimate descenders and spacing's within-word gap approximation against the approved rubric and practice photos. Retain limitations even if numerical agreement looks favorable.
- [ ] If a needed feature change is made, version it and regenerate measurements consistently through the authorized research workflow; keep pipeline versions separate. Do not mix changed measurements silently or repeatedly choose features using the reported held-out results.
- [ ] Keep scoring changes behind the ScoreProvider abstraction. Backend scoring/API changes require their repository-mandated test scopes; no phase-specific scoring branch in the frontend.

### Model and image provenance

- [ ] Record `SCORING_ENGINE`, actual CNN/HTR artifact identifiers, and whether inference is real, stubbed, or baseline-initialized. Do not print secrets in manifests or logs.
- [ ] Verify a real teacher-trained Stage 2 artifact before calling formation scores calibrated. A file called `stage2_calibrated.keras` does not establish how it was trained. The current `--baseline` option initializes outputs around 72.5 without teacher data; stub scores are also synthetic. Neither is calibration evidence, and existing exports do not label these modes explicitly.
- [ ] Keep Stage 1 character-classifier metrics separate from worksheet formation-quality metrics. Stage 1's CCC held-out accuracy does not validate the Stage 2 regression output.
- [ ] Preserve the original page/crop lineage, prompt version, segmentation/HTR settings, rejected rows, and image availability. A failed HTR/script/segmentation gate is part of coverage, not automatically a bad teacher grade.
- [ ] Keep EXIF removal, signature/dimension checks, normal authorization, RLS boundaries, and single-worker deployment rules intact. No model artifacts or actual child data in Git.

## 2. Minimum verification evidence for the later code work

These are acceptance checks for subsequent implementation, not tests executed by this documentation task.

| Concern | Required evidence |
| --- | --- |
| Grouping | A fixture with several pages/crops/retries per child shows zero child overlap in every outer and internal split; a missing group ID causes a clear failure |
| Fold isolation | Changing only held-out labels does not change that fold's fitted parameters or predictions |
| Label normalization | Real exporter snake_case bands populate the intended four distributions; unknown labels fail rather than default |
| Canonical capture | Two captures of the same sheet contribute one fitting/evaluation observation while both attempts remain in coverage |
| Partial adjudication | One unresolved criterion excludes only that label; eligible other criterion records remain traceable and no fabricated full app score is inserted |
| Predictions and metrics | Report uses saved held-out calibrated outputs; negative final-score rho is not accepted; tied/constant labels yield an explicit undefined/insufficient result |
| Weighting and scope | Crop counts do not become independent evaluated cases; primary/supplementary and worksheet-level formation results are distinct |
| Provenance | Export/report names rubric, prompts, child groups, data/code/model versions, modes, exclusions, and final refit separately |

For later code work, run the relevant research/training/backend tests plus the always-required lint/type checks in AGENTS.md. If `app/api/`, `app/scoring/`, or a migration changes, run the full backend suite against the ephemeral Supabase stack. Regenerate generated API/DB types when their source contract changes. No new database schema is required for the agreed paper-form workaround.

## 3. Status language

Before these checks are met, use “field protocol prepared” or “analysis implementation pending.” After collection, report actual data counts and completed teacher review. Call the engine empirically calibrated only for the criteria and recipe actually fit to teacher data; report grouped evaluation independently. Deployment and removal of manual entry remain separate product work, not an automatic consequence of collecting the worksheets.
