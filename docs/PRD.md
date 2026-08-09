# WriteWise — Product Requirements Document

**A Computer Vision and CNN-Based Diagnostic Cursive Handwriting Assessment and Progress Monitoring System**

- **Document type:** Internal engineering PRD (build guide for the dev team, companion to ARCHITECTURE.md, DESIGN.md, CV_PIPELINE.md, ML_PIPELINE.md, DATABASE.md, API_SPEC.md, TECH_STACK.md, SECURITY.md)
- **Team:** Ryan Christopher B. Estoque, John Lawrence V. Monleon, James David B. Asoy, Saara Eliana G. Ibag
- **Institution:** Holy Cross of Davao College, BSIT
- **Research locale:** Matina Aplaya Elementary School, Talomo, Davao City
- **Target technical defense:** October 2026
- **Target Phase 1 launch:** September 2026 (or earlier)
- **Status:** Draft v1

---

## 1. Problem Statement & Vision

Cursive handwriting assessment in basic education is manual, time-consuming, and subjective — teachers evaluate letter formation, spacing, slant, baseline alignment, and size consistency by eye, across dozens of students, with no consistent standard. Parents, meanwhile, often lack the reference knowledge to judge whether their child's handwriting is on track, especially post-pandemic where cursive instruction gaps widened.

WriteWise is a web-based system that uses computer vision (OpenCV) and a fine-tuned CNN to automatically assess uploaded cursive handwriting activity sheets against five measurable criteria, generate explainable diagnostic feedback, and track a student's handwriting development over time — giving teachers an objective, faster grading tool and giving parents visibility into their child's progress.

Standard OCR is not a substitute: OCR transcribes text and discards the physical/structural quality of the handwriting, which is exactly what this system needs to evaluate.

---

## 2. Goals

1. Automatically assess uploaded cursive handwriting using five criteria: **letter formation, size consistency, spacing, slant, and baseline alignment**.
2. Provide explainable, criterion-based diagnostic feedback and a progress monitoring dashboard.
3. Statistically validate system-generated scores against manual teacher scores (Spearman's Rho).
4. Evaluate the fine-tuned CNN model (Accuracy, Precision, Recall, F1-Score).
5. Evaluate the finished system against the ISO/IEC 25010 software quality model.

---

## 3. Users & Roles

| Role | Who | What they do |
|---|---|---|
| **Teacher** | Basic education teacher (primary user) | Creates handwriting activities, uploads/reviews student submissions, views class-wide results and diagnostics, manages their class roster |
| **Parent/Guardian** | Parent of an enrolled student | Views their own child's assessment history and progress dashboard; can upload their child's completed sheet for a teacher-assigned activity |
| **Student** | Grade 3 learner (minor) | No account, no direct system access. Exists only as a roster record a teacher creates and links submissions to. All interaction happens on paper. |

There is no separate admin role for the pilot — the teacher setting up the class is the local admin. (Flagged as a future enhancement if the system expands beyond one school.)

**Access control:** a parent only ever sees their own child's record; a teacher only sees their own class roster and submissions.

---

## 4. Scope

### 4.1 In scope (full proposal scope = MVP — no feature cuts)
- Teacher-defined handwriting activities (freeform text: letters, words, or sentences — no fixed template library)
- Photo upload of a full worksheet per activity (not per-letter)
- Image preprocessing: grayscale conversion, noise removal, thresholding, segmentation, deskewing
- CNN-based letter formation analysis (fine-tuned on the Kaggle cursive alphabet dataset)
- OpenCV-based feature extraction: spacing, slant, baseline alignment, size consistency
- Diagnostic engine generating criterion scores and feedback
- Progress monitoring dashboard (role-specific views, see §7)
- Teacher portal and Parent portal (web-based, mobile-responsive — accessed via phone browser for photo capture/upload, not a native app)

### 4.2 Out of scope
- Freeform compositions, essays, journals, or classroom notes (only standardized, teacher-predefined activities are assessed)
- Handwriting instruction, coaching, or real-time feedback while writing
- Auto-generated handwriting practice worksheets
- Automatic remediation-exercise recommendations
- System assumes uploaded images are clear, properly oriented, and of sufficient quality

---

## 5. Build Roadmap (Phased, Parallel-Track)

The scoring system cannot be "designed" up front the normal way — the rubric thresholds (how many pixels/mm/degrees of deviation equal what percentage/rubric band) don't exist yet. They have to be *derived* from real paired data: raw CV measurements vs. a teacher's manual rubric score on the same worksheet. So the build is split into two functional phases that run on a shared, parallel timeline to fit the Aug–Oct runway.

### Phase 1 — Instrumentation & Calibration Data Collection (target: live by September)
**Goal:** collect paired data (raw CV measurements ↔ teacher manual scores) to derive scoring thresholds.

- Teacher portal only (no parent portal needed yet)
- Activity creation (freeform target text)
- Worksheet photo upload
- CV pipeline runs and displays **raw measurements only** — pixel/mm distances, angles, ratios — no rubric grade or percentage shown
- Manual rubric-score entry field: teacher independently grades the same worksheet using the adapted rubric, entered against the same submission record
- No CNN-based auto-scoring yet, no diagnostic feedback UI yet

### Between Phases — Calibration Analysis (offline)
- Analyze the paired raw-measurement / teacher-score dataset
- Derive threshold ranges per criterion (what raw-unit range maps to what percentage/rubric band)
- Validate via Spearman's Rho correlation
- Fine-tune and evaluate the CNN model (Accuracy, Precision, Recall, F1-Score) on the Kaggle dataset in parallel with this step

### Phase 2 — Calibrated Scoring & Full System (built in parallel with Phase 1, integrated after calibration)
**Built concurrently while Phase 1 is live**, using placeholder/manual scores as stand-in data so the UI doesn't block on calibration finishing:
- Parent portal (view child's progress, upload for assigned activities)
- Progress monitoring dashboard (role-specific views)
- Diagnostic feedback UI (visual overlay annotations + criterion breakdown)

**Once calibration is done:** swap the manual-entry step for the calibrated auto-scoring engine (a backend integration, not a UI rebuild) — the manual teacher-score field is then **removed** from the live product.

### Suggested Timeline (Aug–Oct)
| Window | Focus |
|---|---|
| Now – early Sept | Build Phase 1 (teacher tooling + raw CV pipeline); in parallel, build Phase 2 UI (parent portal, dashboard, diagnostic feedback layout) against placeholder data |
| September | Phase 1 live — 5 teachers / 30 students generating paired calibration data; Phase 2 UI work continues in parallel |
| Late Sept | Threshold/correlation analysis; CNN evaluation; calibrate scoring engine |
| Late Sept – early Oct | Integrate calibrated engine into Phase 2 UI; remove manual-entry field; full system complete |
| Early–mid Oct | Full user evaluation: 5 teachers, 30 parents, IT experts (ISO/IEC 25010 questionnaire) + diagnostic accuracy validation |
| October | Technical defense |

⚠️ **Risk flag:** this is a compressed runway (~9-10 weeks) for a system with a real statistical validation study embedded in it. The parallel-track approach exists specifically to protect the October defense date — if Phase 1 data collection slips past mid-September, the calibration → integration → evaluation chain has very little slack left. Track this weekly.

---

## 6. Core User Flows

### Teacher — Create & Assess an Activity
1. Teacher logs in, selects/creates their class roster (student name + section)
2. Teacher creates a new activity: types target text (letters/words/sentence)
3. Students complete the activity on paper (outside the system)
4. Teacher (or parent, if take-home) photographs the completed worksheet and uploads it
5. System processes synchronously — teacher sees a short loading state ("Analyzing handwriting...") — no background queue for MVP
6. **Phase 1:** teacher sees raw measurements and manually enters their own rubric score
7. **Phase 2:** teacher sees the calibrated score, qualitative band, and diagnostic feedback (visual overlay + text breakdown) immediately
8. Result is saved to that student's assessment history

### Parent — View Progress (Phase 2 only)
1. Parent logs in, sees their child's profile
2. Views per-criterion score trend over time + overall composite trend
3. Views latest diagnostic feedback for the most recent submission
4. Can upload their child's completed sheet for a teacher-assigned take-home activity

---

## 7. Functional Requirements by Module

### 7.1 Teacher Portal
- Class roster management (add/edit students: real name + section)
- Activity creation (freeform target text entry)
- Submission upload (single photo per activity per student)
- **Phase 1:** raw CV measurement display + manual rubric score entry
- **Phase 2:** calibrated score, qualitative band, diagnostic feedback (overlay + text)
- Class-wide dashboard: roster table sortable by weakest criterion, class-average trend
- Per-student drill-down: individual score trend per criterion

### 7.2 Parent Portal (Phase 2)
- View own child's record only
- Per-criterion trend chart + composite trend
- Latest diagnostic feedback view
- Upload submission for a teacher-assigned activity

### 7.3 Computer Vision & CV/CNN Module
- Image preprocessing: grayscale conversion, noise removal, thresholding, deskewing
- Segmentation: isolate individual letters/words from the full worksheet image
- CNN letter-formation analysis (fine-tuned on Kaggle cursive uppercase/lowercase dataset, 80/10/10 train/val/test split)
- OpenCV feature extraction: slant angle, spacing distance, baseline deviation, size consistency ratio
- Phase 1 output: raw measurement values only
- Phase 2 output: calibrated numeric score (0–100) per criterion + composite score

### 7.4 Diagnostic Engine (Phase 2)
- Converts calibrated numeric scores into qualitative bands (e.g., Needs Improvement / Developing / Satisfactory / Excellent)
- Generates visual overlay annotations on the submitted image (e.g., baseline drift line, spacing/size highlight boxes)
- Generates a criterion-by-criterion text explanation (score, band, one-line diagnostic note)

### 7.5 Progress Monitoring Dashboard (Phase 2)
- Teacher view: per-student trend + class-wide roster sortable by weakest criterion + class-average trend
- Parent view: own child's per-criterion trend + composite trend

---

## 8. Data Model (key entities)

- **User** — teacher or parent account, role, linked auth (Supabase Auth)
- **Student** — name, section, linked teacher(s) and linked parent account
- **Activity** — target text, creator (teacher), created date
- **Submission** — activity reference, student reference, uploaded image, timestamp, uploader (teacher or parent)
- **Measurement** — per-submission raw CV values per criterion (Phase 1) / calibrated scores per criterion (Phase 2)
- **ManualScore** (Phase 1 only, removed after calibration) — teacher's independent rubric rating per criterion, per submission

---

## 9. Non-Functional Requirements

- **Performance:** synchronous processing; each submission should return results within the same session (no background job queue at pilot scale)
- **Platform:** mobile-responsive web app (not a native app) — accessed via phone browser on Android 9+/iOS 15+ for photo capture and upload, and via desktop/laptop browser for review
- **Privacy & data protection:** compliant with the Data Privacy Act of 2012 (RA 10173); real student names stored in-app for practical teacher/parent use, restricted by role-based access; anonymization applied only when exporting data for thesis analysis; informed consent collected via paper forms outside the app
- **Reliability & Usability:** evaluated post-build via the ISO/IEC 25010 questionnaire (Functional Suitability, Performance Efficiency, Usability, Reliability, Compatibility)

---

## 10. Technical Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js, React, TypeScript |
| UI | Tailwind CSS, shadcn/ui |
| Backend | Python, FastAPI |
| Computer Vision | OpenCV |
| Machine Learning | TensorFlow/Keras (transfer learning on pretrained CNN) |
| Database | Supabase (PostgreSQL) |
| File Storage | Supabase Storage |
| Auth | Supabase Authentication |
| Data Visualization | Recharts |
| Dev Tools | VS Code, Git, GitHub, Postman |
| Deployment | Vercel (frontend), Railway (backend) |

---

## 11. Success Metrics (proposed — literature-grounded, pending adviser sign-off)

The program has not issued specific required thresholds, so the following are proposed targets based on standard practice and related literature (e.g., comparable rubric-based studies landing in the 86–87% "satisfactory" range):

- **CNN letter-formation model:** ≥ 90% accuracy on the held-out test split
- **Diagnostic correlation:** Spearman's Rho ≥ 0.70 between system scores and teacher scores, per criterion ("strong" correlation)
- **ISO/IEC 25010 evaluation:** mean rating ≥ 4.0 / 5.0 ("Very Satisfactory") across all five quality characteristics

---

## 12. Risks & Assumptions

- **Timeline risk:** ~9-10 weeks from Phase 1 launch to defense is tight for a system with an embedded validation study; parallel-track development is the mitigation, but slippage in Phase 1 data collection directly threatens the October defense date.
- **Calibration risk:** if the correlation between raw CV measurements and teacher scores comes out weak, the rubric-to-threshold mapping may need rework, which would cascade into Phase 2 timing.
- **Image quality assumption:** the system assumes clear, well-oriented photos; poor lighting, skew, or low resolution will degrade both segmentation and CNN accuracy.
- **Generalization risk:** the CNN is fine-tuned on a public Kaggle dataset of individual letters, not on the actual Grade 3 handwriting samples — real student handwriting may behave differently than the training distribution, which is exactly why Phase 1's calibration step exists.

---

## 13. Deferred / Future Enhancements (explicitly not in MVP)

- Dedicated Admin role (needed only if expanding beyond a single school)
- Curriculum-aligned template library for activity creation (DepEd word/sentence sets)
- Background/async processing (revisit if per-submission processing time becomes a bottleneck)
- Notifications (e.g., parent alerted when a new assessment is ready)
- Permanent manual-score override for teachers post-calibration
