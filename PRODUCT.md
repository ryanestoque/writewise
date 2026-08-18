# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Basic Education Teachers (Primary):** Elementary educators (specifically Grade 3 teachers in pilot) responsible for assessing cursive handwriting worksheets across dozens of students, identifying specific mechanical weaknesses (letter formation, slant, spacing, baseline alignment, size consistency), managing class rosters, and tracking longitudinal improvement.
- **Parents / Guardians (Secondary):** Parents of enrolled learners who need clear, jargon-free visibility into their child's handwriting development and progress over time, with the ability to upload completed take-home practice sheets.
- **Students (Paper-only Learners):** Minors who interact exclusively via physical paper worksheets. They have no direct system access, credentials, or digital logins.

## Product Purpose

WriteWise is an automated diagnostic cursive handwriting assessment and progress monitoring platform. It combines OpenCV computer vision feature extraction with a fine-tuned Convolutional Neural Network (CNN) to evaluate student handwriting against five structural criteria, provide explainable diagnostic feedback with visual overlays, and track student growth over time—replacing subjective, labor-intensive manual grading for teachers while giving parents actionable insight into their child's progress.

## Positioning

Unlike standard Optical Character Recognition (OCR) systems that transcribe text while discarding physical handwriting geometry, WriteWise evaluates the physical craft, structural stroke fidelity, and spatial consistency of handwriting. Unlike generic classroom grading forms, WriteWise is backed by an empirical two-phase calibration study (Spearman's Rho correlation with teacher evaluations) and structured against the ISO/IEC 25010 software quality model.

## Operating Context

- **Physical Worksheets & Classroom Setting:** Students write by hand on standardized lined activity sheets.
- **Photo Capture & Upload:** Teachers and parents photograph completed sheets using mobile device cameras (Android 9+ / iOS 15+ mobile browsers) or upload scanned images via desktop/laptop browsers.
- **Synchronous Diagnostic Processing:** Fast synchronous feedback loops during worksheet upload sessions.
- **Research Locale:** Matina Aplaya Elementary School, Talomo, Davao City (BSIT Capstone, Holy Cross of Davao College; defense target October 2026).

## Capabilities and Constraints

- **Two-Phase Architecture:**
  - *Phase 1 (Instrumentation & Calibration):* Teacher roster management, activity creation, worksheet photo upload, raw CV measurement display (pixel/mm metrics, angles, ratios), and independent manual rubric score capture for ground-truth pairing.
  - *Phase 2 (Calibrated Auto-Scoring & Full Experience):* Calibrated multi-criterion scoring (0–100), qualitative band assignment, interactive visual overlay annotations, plain-language diagnostic notes, parent portal, and longitudinal trend dashboards.
- **Assessment Criteria:** Letter Formation (CNN), Slant Angle (CV), Spacing (CV), Baseline Alignment (CV), Size Consistency (CV).
- **Privacy & Compliance (RA 10173):** Strict role-based isolation via Row Level Security (RLS), unconditional EXIF metadata stripping upon image upload, opaque logging (no student names or PII in logs/training sets), and anonymized exports for academic analysis.
- **Explicit Scope Boundaries:** No freeform essay grading, no real-time stylus/stroke coaching, no auto-generated practice generators, and no student-facing accounts.

## Brand Commitments

- **Name:** WriteWise
- **Voice & Tone:** Scholarly, encouraging, objective, and constructive. Diagnostic notes highlight positive progress and offer gentle, actionable tips rather than punitive scores.
- **Identity Assets:** Clean pen-stroke flourish icon paired with the "WriteWise" wordmark.
- **Design Philosophy:** Warm, focused, and academic—prioritizing scanability, accessible data visualization, and operational efficiency over frivolous gamification.

## Evidence on Hand

- Complete technical documentation suite (`docs/PRD.md`, `docs/ARCHITECTURE.md`, `docs/DESIGN.md`, `docs/CV_PIPELINE.md`, `docs/ML_PIPELINE.md`, `docs/DATABASE.md`, `docs/API_SPEC.md`, `docs/SECURITY.md`, `docs/TECH_STACK.md`, `docs/TESTING.md`, `docs/DEPLOYMENT.md`).
- Standardized cursive character benchmark dataset (CCC / C-Cube) for CNN fine-tuning.
- Active Next.js frontend, FastAPI backend, and Supabase database schema scaffolding.

## Product Principles

1. **Physical Craft over Character Recognition:** Evaluate the structural stroke geometry, slant, spacing, and baseline discipline of cursive handwriting rather than merely recognizing text.
2. **Zero Digital Burden for Students:** Keep the learning and writing experience entirely tactile and paper-based for young learners, meeting educators and families where they already are.
3. **Transparent & Constructive Diagnostics:** Pair every numerical rating with visual evidence (annotated overlays) and encouraging, plain-language guidance that teachers and parents can immediately understand.
4. **Empirical Grounding & Strict Ethics:** Derive scoring thresholds through rigorous statistical calibration against human educator judgment while upholding zero-compromise data privacy for minors under RA 10173.

## Accessibility & Inclusion

- **Dual-Coded Status Indicators:** Diagnostic score bands and chart metrics always pair color with explicit text labels to ensure full accessibility for color-blind users (WCAG 2.1 AA compliant).
- **High Contrast Ratios:** All text, badges, and overlays enforce strict contrast standards (minimum 4.5:1 for body copy; >6:1 for alerts and destructive indicators).
- **Keyboard & Screen Reader Support:** Full semantic HTML structure, dynamic `aria-label` context for student table actions, and visible focus rings on all interactive elements.
- **Motion Sensitivity:** Enforce `prefers-reduced-motion` compliance across all animations and transitions.
- **Mobile-Responsive Optimization:** Ergonomic touch targets and streamlined photo-upload workflows across mobile browser viewports.
