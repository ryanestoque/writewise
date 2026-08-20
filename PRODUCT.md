# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary user: Teachers** — basic education teachers (pilot: Matina Aplaya Elementary School, Talomo, Davao City) who create cursive handwriting activities, upload/review student worksheet submissions, view per-student and class-wide assessment results, and manage their class roster. They access the system via desktop/laptop browser for review and via phone browser (Android 9+/iOS 15+) for photo capture and upload.

**Secondary user: Parents/Guardians** — parents of enrolled students who view their own child's assessment history, progress dashboard, and latest diagnostic feedback, and can upload a completed take-home worksheet. Same device profile as teachers.

**Students** (Grade 3 learners, minors) — no account, no direct system access. They exist only as roster records a teacher creates and links submissions to. All student interaction happens on paper.

There is no separate admin role for the pilot. The teacher setting up the class is the local admin.

## Product Purpose

WriteWise is a web-based system that uses computer vision (OpenCV) and a fine-tuned CNN to automatically assess uploaded cursive handwriting activity sheets against five measurable criteria — letter formation, size consistency, spacing, slant, and baseline alignment — generate explainable diagnostic feedback, and track a student's handwriting development over time.

It gives teachers an objective, faster grading tool (replacing manual, time-consuming, subjective assessment-by-eye) and gives parents visibility into their child's progress that they otherwise lack, especially given post-pandemic cursive instruction gaps.

Success means: validated scoring correlation (Spearman's Rho ≥ 0.70 per criterion between system and teacher scores), CNN accuracy ≥ 90% on held-out test split, and ISO/IEC 25010 evaluation ≥ 4.0/5.0 across five quality characteristics.

## Positioning

Standard OCR transcribes text and discards the physical/structural quality of the handwriting — which is exactly what WriteWise evaluates. The core differentiator is CV + CNN-based objective cursive assessment with explainable, per-criterion diagnostic feedback (visual overlay annotations + text breakdowns), paired with a progress monitoring dashboard that tracks handwriting development over time. No comparable tool offers criterion-decomposed cursive assessment with this degree of transparency into the scoring.

## Operating Context

- **Research locale:** Matina Aplaya Elementary School, Talomo, Davao City
- **Academic context:** BSIT thesis project (Holy Cross of Davao College); target technical defense October 2026
- **Team:** Ryan Christopher B. Estoque, John Lawrence V. Monleon, James David B. Asoy, Saara Eliana G. Ibag
- **Pilot scale:** 5 teachers, 30 students, 30 parents
- **Workflow:** Teacher defines a freeform-text cursive activity → students complete it on paper → teacher (or parent, for take-home) photographs the completed worksheet → uploads via phone browser → system processes synchronously (no background queue) → results displayed immediately
- **Two-phase build:** Phase 1 collects raw CV measurements + paired manual teacher scores (calibration data); Phase 2 swaps in calibrated auto-scoring, diagnostic feedback UI, parent portal, and progress dashboards

## Capabilities and Constraints

**Capabilities:**
- Teacher portal: roster management, activity creation (freeform target text), submission upload (single photo per activity per student), raw measurement display (Phase 1), calibrated scoring + diagnostic feedback (Phase 2), class-wide and per-student dashboards
- Parent portal (Phase 2): own child's assessment history, progress trend, latest diagnostic feedback, take-home submission upload
- CV pipeline: quality gate, preprocessing (grayscale, denoise, threshold, deskew), line/word segmentation, feature extraction (slant, spacing, baseline alignment, size consistency)
- CNN: fine-tuned on CCC/C-Cube cursive character dataset for letter formation analysis
- Diagnostic engine: qualitative bands (Needs Improvement / Developing / Satisfactory / Excellent), visual overlay annotations, criterion-by-criterion text explanations

**Constraints:**
- Only standardized, teacher-predefined activities are assessed — no freeform compositions, essays, journals, or classroom notes
- System assumes uploaded images are clear, properly oriented, and of sufficient quality (quality gate rejects failures, not corrects them)
- Synchronous processing only (no background job queue at pilot scale)
- Mobile-responsive web app (not a native app)
- No automated dependency bots; updates are manual and deliberate
- Single Uvicorn worker; CNN model loads from Supabase Storage at container startup
- RA 10173 (Data Privacy Act of 2012) compliant; EXIF stripping unconditional on every image write

**Undecided / deferred:**
- Dedicated admin role (needed only if expanding beyond one school)
- Curriculum-aligned template library
- Background/async processing
- Push notifications
- Permanent manual-score override post-calibration

## Brand Commitments

- **Name:** WriteWise
- **Wordmark:** Poppins typeface + custom pen-stroke/flourish SVG mark. Appears in nav header and login screen; reusable on thesis defense materials.
- **Voice:** warm, encouraging, never punitive — feedback language carefully avoids discouraging minors (students are the ultimate audience for the diagnostic notes, mediated through teachers and parents)

## Evidence on Hand

- CCC/C-Cube cursive character dataset (public, with predefined train/val/test split) — for CNN fine-tuning
- Adapted rubric for the five criteria — derives from cursive handwriting assessment literature
- Diagnostic note templates per criterion per band (first draft; to be reviewed with a participating teacher before Phase 2 ships)
- No real student handwriting samples collected yet (Phase 1 is the collection mechanism)
- No testimonials, press, case studies, or benchmark claims exist

## Product Principles

1. **Objective over subjective.** Replace gut-feel grading with measurable, reproducible, criterion-decomposed assessment — and show the work (overlay + breakdown), not just a number.
2. **Encouraging over judgmental.** Every piece of feedback a child eventually sees through their teacher or parent should be constructive, specific, and non-punitive.
3. **Privacy by default.** Students are minors with no login; real names are access-controlled by role; EXIF is stripped unconditionally; logs never contain identifiable data; anonymization happens only through a controlled export script.
4. **Calibration before automation.** The system earns the right to auto-score by first proving statistical agreement with human expert judgment — no black-box scoring.
5. **Ship the pilot, not the platform.** Scope is deliberately tight (one school, ~65 users, synchronous processing, no admin role) to protect the October defense date.

## Accessibility & Inclusion

- WCAG 2.1 AA compliance (4.5:1 text contrast minimum, semantic landmarks, visible keyboard focus, screen reader context for interactive elements)
- Color is never the sole signal — every band indicator pairs color with text label (accommodates the ~8% male color-blindness prevalence)
- `prefers-reduced-motion` respected throughout (Framer Motion sequences, dialog overlays)
- Mobile-responsive design for phone-browser access (Android 9+/iOS 15+) — teachers and parents in the pilot locale commonly access via smartphone
