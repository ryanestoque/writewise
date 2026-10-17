# October 19, 2026 — Manual Scoring and Calibration Pilot

Status: research design agreed in the planning interview on October 17. The worksheet texts and analytic rubric in this packet are drafts for the two teachers to review before use. Software readiness items are planned work, not implemented changes.

## 1. Purpose and limits

Collect teacher-reference ratings paired with WriteWise measurements, perform preliminary scoring calibration, and obtain exploratory predictions for children excluded from that round of calibration. Assess five criteria separately: letter formation, size consistency, spacing, slant uniformity, and baseline alignment.

This is a small, accelerated pilot for the October 21–24 defense window. It provides preliminary content-review, rater-agreement, calibration, and system-coverage evidence. It does not establish grade-specific norms, effectiveness at improving handwriting, general applicability across Philippine schools, or validated word-level formation scores. Report actual results even when a target is not met or a statistic cannot be estimated.

The team stated that formal permissions are not currently needed to proceed; administrative arrangements remain with the team. This packet does not determine institutional requirements or certify permission status.

## 2. Agreed design

| Item | Agreement |
| --- | --- |
| Collection date | October 19, 2026; all schedule times below are Asia/Singapore / Philippine time |
| Participants | 5–10 distinct children total, from available Grades 2–6; no per-grade quota |
| Recruitment | Record how children were actually recruited; use “convenience sample” if there was no random draw from an eligible roster |
| Core work | Four short English copying worksheets per child, A–D |
| Optional work | Two additional worksheets, E–F, offered after a break if the child is comfortable |
| Counts | 20–40 core worksheets planned; 30–60 total only if everyone completes both optional worksheets |
| Main analysis | Core worksheets A–D |
| Optional analysis | E–F supplementary; identify actual participation and do not merge silently into the primary result |
| Raters | Two teachers independently rate every readable completed study worksheet using separate forms |
| Reference labels | Preserve both first ratings, then record an agreed band or unresolved status per criterion |
| Population interpretation | One common observable handwriting standard across grades; scores are task-quality ratings, not grade-level proficiency judgments |
| System evaluation | Leave one child out at a time; keep all their pages, retries, crops, and augmentations together |
| Teacher review | The same two teachers review the rubric before formal scoring; describe this as preliminary two-teacher content review |

More pages provide repeated observations of these writers, not additional independent children. Neither these counts nor the proposed workload establish statistical sample-size adequacy. Grouped evaluation is needed when observations from the same person are dependent: [scikit-learn grouped cross-validation](https://scikit-learn.org/stable/modules/cross_validation.html#cross-validation-iterators-for-grouped-data).

## 3. Packet and responsibilities

- [WORKSHEETS.md](WORKSHEETS.md): exact draft prompts, line breaks, administration script, and material preparation.
- [TEACHER_RUBRIC_AND_FORMS.md](TEACHER_RUBRIC_AND_FORMS.md): analytic rubric, teacher review, independent ratings, adjudication, and collection records.
- [SOFTWARE_READINESS.md](SOFTWARE_READINESS.md): confirmed code gaps and the checks required before analysis can support the agreed design.

Assign a collection coordinator, materials/coding operator, capture/upload operator, and data checker. Team members may combine roles. T1 and T2 are the teacher rater codes. A responsible teacher performs app actions requiring teacher authorization; researchers do not obtain teacher passwords or use service-role credentials through a browser.

## 4. Preparation on October 17–18

1. Give both teachers the draft analytic rubric and all six prompt cards. They first record their own content-review observations, then discuss revisions. Check clarity, observability, acceptable cursive forms, language difficulty, and applicability to the recruited children. Record each teacher's experience and the actual scope of their expertise.
2. Resolve the slant and baseline inconsistencies listed in SOFTWARE_READINESS.md. The teacher-facing rubric uses observable descriptors; pixel tolerances and unverified angle targets are not grading rules. Record any agreed school-specific style conventions.
3. Prepare 3–5 researcher-written practice sheets using the same ruling and prompts, with varied but plausible handwriting. Teachers check that these illustrate the rubric usefully. Mark them `PRACTICE`; they are not child observations and never enter calibration or evaluation.
4. Teachers independently practice, discuss disagreements, and refine instructions. Record the duration to replace the provisional three-minutes-per-page workload assumption. If independent use remains unclear, revise and repeat practice before formal study scoring. No numerical reliability cutoff is claimed from these practice examples.
5. Freeze a dated rubric and prompt version after review and practice. Begin at `v1.0` only after both teachers approve use. Preserve the draft, individual comments, changes, approved version, and practice records. If an important rubric change becomes necessary during formal scoring, stop, version it, and arrange independent rescoring of affected study pages; do not combine unlabeled versions.
6. Prepare the paper, pencils, separate prompt cards, coded forms, private identity-to-code key, device, charging equipment, and secure storage. Use blank study forms from this packet; completed records and images must not be committed to Git.
7. Run the camera/upload rehearsal with practice sheets. Verify all printed rulings and handwritten words are visible, prompt text is outside the captured writing region, and each expected activity text is correct. Document actual pipeline, HTR, and CNN artifact/stub modes.
8. Freeze the feature definitions, model recipe, epoch-selection rule, rubric-to-band mapping, evaluation script version, and metric choices before examining held-out predictions. Complete or explicitly flag the analysis readiness checklist. Field collection can proceed independently of unfinished analysis software.

Expert review supports particular interpretations and uses; it is not comprehensive validation by itself. Clear scoring rules, examples, practice, independent ratings, and disagreement procedures follow [AERA/APA/NCME Standards](https://www.testingstandards.net/uploads/7/6/6/4/76643089/standards_2014edition.pdf) and [ETS constructed-response scoring guidance](https://www.ets.org/pdfs/about/cr_best_practices.pdf).

## 5. October 19 field procedure

### 5.1 Codes and materials

Use participant codes `S01`–`S10` and worksheet codes such as `S01-A`. Put the physical code on the back or outside the writing capture area, and pair the captured file with that code immediately. Keep the identifiable key separately under the responsible teacher's control. Grade and prior cursive-instruction exposure belong in the restricted collection manifest, not the scoring packet.

Use the same three-line paper format and writing implement where practical. Record deviations such as a different ruling or pencil; preserve ordinary left-handed writing and normal paper positioning. Record actual prior cursive exposure rather than silently excluding or replacing a child whose writing cannot be processed. Children who do not produce assessable cursive remain relevant to the participation/coverage account.

### 5.2 Administration

1. Explain the activity using the script in WORKSHEETS.md. Record each worksheet's order, completion status, and any assistance.
2. Give A–D to every participating child. Alternate sequence by participant code: odd codes A–B, break, C–D; even codes C–D, break, A–B. Keep the assigned sequence even when grades differ. Record deviations. This order rule is an operational default to distribute practice/fatigue effects, not a separate experimental comparison.
3. Allow a comfortable pace. Timing estimates are for scheduling, not grading or speed testing. Offer a break after two worksheets and whenever requested. Do not coach letter shapes, retrace strokes, demonstrate corrections, or ask for deliberately poor handwriting. Normal access assistance can be given and recorded without turning the task into a handwriting lesson.
4. Offer E–F only after the core work and a break, if the child is willing and comfortable and time permits. Record a declined or unfinished optional page without treating it as failure.
5. Preserve the child's original marks. Natural self-corrections can remain; do not ask for a neater replacement to improve system acceptance.

### 5.3 Capture and rejection handling

1. Photograph the writing region straight-on with the full three-line groups visible, even illumination, and adequate focus. Exclude names, faces, model text, printed instructions, and unused page regions that confuse segmentation.
2. Associate each attempt with a worksheet code and capture number, e.g. `S01-A-C01`. A better photograph of the same physical writing is C02, not a new worksheet or independent observation.
3. Preview for capture defects, then upload through the authorized app path. Log submission ID, accepted/rejected status, exact error code, pipeline version, capture sequence, and whether the same writing was recaptured. Keep rejected Submission rows and their reasons.
4. If focus, framing, lighting, or another capture problem can be corrected, retake the same sheet. Do not overwrite the attempt log or ask the child to rewrite. If analysis needs one canonical capture, use the first capture that passes the frozen technical criteria, without looking at scores. Human-readable cases with no passing capture remain coverage failures, with their teacher ratings retained separately.
5. Keep the paper and controlled input captures. The current upload route stores images for persisted quality/segmentation/HTR rejections, but the paired-data exporter filters these cases out. Extend the authorized exporter for coverage/image access when needed; do not assume the existing paired export contains them. Other failed upload requests may have no persisted image. Preserve the paper and record availability explicitly. Do not bypass image security checks or Storage controls to rescue a sample.
6. Freeze the canonical scoring-photo manifest before teachers score. Both teachers see the same image version. Strip metadata and use the repository's upload/export controls. If a photo is unreadable, mark it unscorable; do not guess a low band.

Record capture attempts and distinct physical worksheets separately. A readable worksheet rejected for handwriting/script/segmentation reasons is still a completed worksheet and a system-coverage observation.

### 5.4 Independent teacher scoring

1. Prepare separate coded-photo packets containing no child name, grade label, previous score, CV metrics, CNN result, diagnostic overlay, or other teacher's rating. The collection coordinator can retain the manifest privately. Masking labels does not guarantee teachers cannot recognize a child's writing; document the masking actually achieved.
2. Shuffle the worksheet order separately for T1 and T2. Each teacher rates every readable core and optional worksheet against the frozen rubric, criterion by criterion, on their own form. All five criteria are considered on every activity.
3. Record band 1–4 or `U` (unscorable), plus a short reason when needed. Preserve first ratings without later erasure or replacement. A low-quality but assessable handwriting performance gets the appropriate band; insufficient visible evidence gets U.
4. Lock or copy both independent form sets before discussion. Calculate teacher agreement from these first ratings only, using paired scorable ratings for that criterion and reporting the omitted count.
5. Compare disagreements using the same image and rubric. Record an agreed band and brief reason, or `UNRESOLVED`. Do not average two ordinal bands or insert a midpoint as though it were an agreed rating. Original U statuses remain in the raw record even if discussion later establishes an agreed assessable rating.
6. The responsible teacher enters the five final bands into WriteWise only when the accepted submission has a complete agreed five-criterion rating. The current app cannot store two independent raters or a partial rating. Partially resolved pages stay in the controlled study records; do not invent a missing app band. Their usable criterion labels require the planned offline research support before they can be analyzed.
7. Two teachers' agreement does not make their judgment objective ground truth. Describe agreed bands as the teacher reference standard and retain the original ratings for sensitivity analysis.

## 6. Working timetable

Times are a planning example; preserve the sequence and independent scoring if venue availability requires changes.

| Date/time | Work |
| --- | --- |
| October 17–18 | Teacher review, practice sheets, rubric/prompt freeze, materials and camera rehearsal; software preparation |
| October 19, 08:00–08:30 | Team setup and final teacher orientation; version and code checks |
| 08:30–10:00 | Core activities in comfortable small batches, with breaks; capture operator works alongside collection |
| 10:00–10:30 | Optional activities where practical; finish capture checks and freeze scoring packets |
| 10:30–12:30 | Independent core scoring; 40 pages at an assumed 3 minutes/page = 2 hours per teacher |
| 12:30–13:00 | Break |
| 13:00–14:00 | Optional scoring if up to 20 additional pages were collected; secure both first-rating sets |
| 14:00–15:00 | Disagreement discussion and final reference labels; extend if needed rather than forcing agreement |
| 15:00–15:30 | Verify codes, counts, unresolved fields, teacher entry, manifests, and controlled backups |
| October 20 | Official export, data checks, grouped calibration/evaluation, figures and written results |
| October 21–24 | Use verified results available for the actual defense date; disclose unfinished analyses |

At five children, core scoring is approximately one hour per teacher at the same assumed speed. Children do not need to remain for scoring. Teacher review/practice time and capture failures can extend the timetable; re-estimate after rehearsal.

## 7. Data organization and reference labels

Retain these linked records: participant code and restricted grade manifest; worksheet/activity/core-or-optional/order/completion; capture attempts and canonical image; app submission ID; rubric/prompt/pipeline/artifact versions; both independent criterion ratings; adjudicated criterion ratings/status/reason; and raw measurements/crop provenance from the authorized export.

Only blank forms and protocol text belong in version-controlled documentation. Place completed controlled research records and official exports in the ignored `research/data/` and `research/output/` locations with access controlled by the team. Keep the name-to-code key separately with the responsible teacher. Export/anonymization of app data happens only through `research/export_dataset.py`, locally with authorized credentials. Preserve a controlled export-run linkage from app submission IDs to worksheet codes and anonymized submission/student codes: the current exporter assigns fresh codes per run. Do not join different exports by a coincidentally identical generated code. No browser service-role keys or ad hoc database extraction.

Map teacher bands to the existing application representation only after recording the ordinal bands: 1 Needs Improvement = 12.5; 2 Developing = 37.5; 3 Satisfactory = 62.5; 4 Excellent = 87.5. These are representative numeric anchors, not a teacher's exact percentage estimate or demonstrated within-band precision. For a final system score clamped to 0–100, use the shared application criterion boundaries: band 1 [0,25), band 2 [25,50), band 3 [50,75), band 4 [75,100]. Do not use the manual form's inconsistent 30/55 composite boundaries for criterion evaluation. Assess each criterion separately; any equal-weight composite is secondary and requires all five values.

## 8. Calibration and exploratory evaluation

### 8.1 Eligibility and coverage

Primary evaluation uses A–D only. For each criterion, include canonical accepted captures with usable measurements and an agreed reference label for that criterion. Exclude practice pages, duplicate captures, unresolved criterion labels, and missing/unusable measurements from that criterion's fitting/scoring, while retaining their counts and reasons. Do not silently drop the other usable criteria on a partially resolved page; this requires the offline support described in SOFTWARE_READINESS.md.

Show a flow table from recruited children to attempted/completed worksheets, readable teacher-rated worksheets, accepted canonical captures, and usable pairs per criterion. Count each physical worksheet once. Report first-capture acceptance and eventual acceptance after permitted recapture separately. Handwriting-related rejections must remain visible, including their teacher-band distribution where assessable. Scoring agreement on accepted pairs is conditional on pipeline acceptance, not the performance of the whole upload system.

Check the distribution of bands per criterion, child, and activity. Do not invent missing bands or synthetic child labels. If a criterion or training fold has only one observed reference band, report that discrimination/calibration is not estimable there. An explicitly labeled training-only constant baseline may produce predictions, but it is not evidence that the criterion was successfully calibrated. Two observed bands also do not validate the two missing bands.

### 8.2 Leave one child out

Use the participant/student code as the group identifier. For each of the 5–10 children:

1. Set aside every page, capture, crop, and augmentation from that child. Use only eligible core pages from the remaining children for primary fitting.
2. Fit all data-derived CV thresholds, penalties, targets, transformations, and CNN Stage 2 parameters using those training children only. No global feature selection, threshold derivation, early stopping, or normalization fitted on the held-out child. Stage 1's independently pretrained fixed backbone can be reused.
3. Use the recipe fixed before inspecting held-out results. A practical small-pilot rule is a predeclared training epoch count; if early stopping or model selection is used instead, its validation children must come exclusively from that outer round's training children. Record the exact rule and software version. Do not use the outer held-out child for epoch selection.
4. Predict the held-out child's eligible core worksheets. Record per-criterion predictions, final rubric bands using the frozen application band conversion, reference bands, and train/held-out IDs. For formation, aggregate word predictions to the worksheet before evaluation against the worksheet label. Each worksheet has equal weight in the evaluation; word crops are not independent teacher-labeled test cases.
5. Fit a simple training-only baseline for comparison: training modal band for exact-band agreement and training mean anchor score for numeric anchor error. Choose the lowest tied band if the training mode is tied, and record that fixed rule in the analysis configuration. Save all out-of-fold predictions before fitting a final artifact.

Pool these out-of-fold core predictions for the primary exploratory report and show results by held-out child as well. Shared training sets make fold scores dependent; neither the number of pages nor folds is an independent sample-size claim. The method is supported by [LeaveOneGroupOut](https://scikit-learn.org/stable/modules/generated/sklearn.model_selection.LeaveOneGroupOut.html); choosing it for this pilot is a practical design choice, not proof of adequate precision.

The optional analysis may repeat the same grouped procedure with E–F included, with core and optional results explicitly separated. All material from the held-out child remains excluded. Do not choose whether to report primary or supplementary results based on which looks better.

After the evaluation recipe and report are frozen, a final provisional model can be refit on all eligible core pages using the same recipe. Archive the out-of-fold results first. Scores fitted and assessed on the full same dataset are training fit, not a replacement for the grouped evaluation. Any later model/feature changes require a clearly separate exploratory analysis; the exposed evaluation is no longer an untouched confirmation set.

### 8.3 Reported measures

For each criterion, report:

- Teacher-versus-teacher: paired rating count, 4-by-4 band table, exact agreement, and linearly weighted Cohen's kappa where defined, using original independent core ratings. Report optional-page agreement separately.
- System-versus-agreed-reference: usable worksheet count and distinct children; a 4-by-4 band table; exact agreement; linearly weighted kappa where defined; and Spearman rho between out-of-fold system scores and reference bands/anchors where defined.
- Optional secondary error: mean absolute error relative to the numeric anchors, explicitly described as error on the chosen anchor scale. It does not measure error against a teacher-provided continuous percentage.
- Per-child results, band/activity coverage, baseline performance, unresolved labels, missing predictions, and rejection/recapture counts.

Use a positive system-score direction: larger system scores should match better reference bands. Do not pass a criterion because `abs(rho)` exceeds a target; a negative correlation of final scores is not success. Raw defect metrics can legitimately correlate negatively with quality, and are a separate exploratory relationship. The PRD's proposed rho >= 0.70 target can be reported descriptively; a point estimate from this sample does not establish precise population performance.

Kappa supports specified linear weighting: [scikit-learn Cohen's kappa](https://scikit-learn.org/stable/modules/generated/sklearn.metrics.cohen_kappa_score.html). Report undefined statistics as not estimable with the reason, not as zero or perfect agreement. Avoid ordinary page-independent significance claims or narrow confidence intervals; repeated pages are clustered within only 5–10 children. Do not report grade-specific effectiveness estimates from one or two children in a grade.

### 8.4 Formation model limitations

The existing Stage 2 design assigns a worksheet formation label to its word crops. That is weak supervision: words within a page need not deserve the same rating. The agreement study validates worksheet-level predictions only, not individual word scores or saliency overlays. Keep the backbone frozen as specified in ML_PIPELINE.md, weight each page equally during primary evaluation, and record the training weighting convention so longer pages do not silently determine the target population. A future word-level claim needs independent word-level labels. See [ML_PIPELINE.md sections 6.1–6.4](../../ML_PIPELINE.md) and the distinction between observed bag labels and unobserved instance labels in [Sabato and Tishby, 2012](https://www.jmlr.org/papers/v13/sabato12a.html).

## 9. Analysis completion and defense reporting

The October 20 outputs are: de-identified collection/coverage counts; rubric version and two-teacher review summary; independent agreement tables; original and adjudicated label audit; grouped fold manifest; out-of-fold prediction table; per-criterion report and baselines; software/artifact provenance; and explicit unavailable or unfinished analyses. Store actual data/results only in controlled ignored locations.

Suggested methods wording, completed only with actual values:

> A preliminary pilot used a convenience sample of [actual number] children from [actual grades], who attempted four core English cursive-copying activities and optional supplementary activities. Two teachers reviewed the analytic rubric and independently rated coded worksheet images before adjudication. Calibration and exploratory evaluation were grouped by child using leave-one-child-out prediction. Results describe the observed sample and accepted measurement–rating pairs; rejected worksheets, unresolved ratings, and limited band coverage were reported separately.

Use “random sample” only if a real random selection procedure was performed and documented. Add actual dates, counts, deviations, and mode/artifact versions. Do not describe an initialized baseline or synthetic stub as a teacher-calibrated CNN. Stage 1 character-classification accuracy is a different evaluation from worksheet formation-quality agreement.

Completion of collection does not authorize an automatic production scoring switch. Keep any deployment decision separate and base it on verified artifacts and results. If calibration/evaluation is incomplete by the defense, present the completed evidence and the remaining work accurately.
