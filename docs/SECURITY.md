# WriteWise — SECURITY.md

**A Computer Vision and CNN-Based Diagnostic Cursive Handwriting Assessment and Progress Monitoring System**

- **Document type:** Internal engineering security reference (companion to PRD.md, ARCHITECTURE.md, DESIGN.md, CV_PIPELINE.md, ML_PIPELINE.md, DATABASE.md, API_SPEC.md, TECH_STACK.md, TESTING.md, DEPLOYMENT.md)
- **Team:** Ryan Christopher B. Estoque, John Lawrence V. Monleon, James David B. Asoy, Saara Eliana G. Ibag
- **Institution:** Holy Cross of Davao College, BSIT
- **Research locale:** Matina Aplaya Elementary School, Talomo, Davao City
- **Status:** Draft v1

**Audience & scope:** this document is written for the dev team and for a technical panel reviewing the repo — not for the public. There is no external vulnerability-disclosure process here: WriteWise is a closed, invite-only pilot (5 teachers, 30 students, one school) with no public signup surface, so there's no realistic outside party who'd need a formal "report a vuln" channel. What this document *does* do is consolidate every security-relevant decision already scattered across the other docs (RLS in DATABASE §10–11, JWT/role/ownership checks in API_SPEC §2.2, the RA 10173 rationale in ARCHITECTURE §7/§16, the quality gate in CV_PIPELINE) and make the decisions nobody had made yet.

---

## 1. Threat Model

Scoped to what's actually plausible for a 30-student, one-school academic pilot — not a generic enterprise threat list.

**In scope:**

1. **Horizontal privilege escalation** — a parent or teacher account viewing another family's/roster's data. This is the #1 threat given RA 10173 and that every data subject here is a minor.
2. **Service-role key compromise** — since it bypasses RLS entirely (ARCHITECTURE §4), a leaked key is close to a full breach. The single highest-impact secret in the system.
3. **Account takeover** — teacher/parent credential compromise via phishing or password reuse. Supabase Auth handles the mechanics; policy (password strength, session length) is still ours to set (§4).
4. **Malicious or malformed file upload** — the CV pipeline processes arbitrary uploaded images; a crafted file could exploit an image-parsing bug, or a small file could decode into an enormous bitmap and exhaust container memory before the quality gate ever runs (§5).
5. **Incidental privacy leakage via the image itself** — not an attacker scenario, but a real one: a phone photo of a worksheet can carry embedded EXIF GPS metadata — i.e., a photo of a child's schoolwork silently embedding where it was taken (§5).
6. **Insider/dev-team over-access** — four students having casual access to real children's names, sections, and images for a thesis project is itself a risk surface, not just an assumption to leave unstated (§3).
7. **Data lingering past its purpose** — no retention/deletion policy existed anywhere prior to this document (§7.3).

**Explicitly out of scope**, given architecture and pilot scale: DDoS/high-volume abuse (no public signup surface), sophisticated/targeted nation-state-style attacks, and payment/financial data (none exists in this system).

---

## 2. Secrets & Access Control

### 2.1 Prod key holders

The Supabase **service-role key** for `writewise-prod` bypasses RLS entirely (ARCHITECTURE §4) — it is the single highest-impact secret in this system. Access to it, and to the `writewise-prod` dashboard generally, is restricted to **two named team members**: Ryan Christopher B. Estoque and one designated teammate *[name to be finalized by the team]*. The remaining team members work exclusively against `writewise-dev`'s seeded fake data (ARCHITECTURE §3) — which already costs nothing, since dev already exists precisely to keep local work off real data.

**This restriction covers Railway's dashboard too, not just Supabase's.** `SUPABASE_SERVICE_ROLE_KEY` is a required backend env var and is readable in plaintext from Railway's Settings → Variables (TECH_STACK.md §8.3) — normal Railway collaborator access for all four team members would silently bypass this policy. Railway dashboard access is restricted to the same two named key-holders; the other two team members work against `writewise-dev` locally and via Vercel/GitHub collaborator access only (DEPLOYMENT.md §7).

**Why restrict rather than share with all four:** "who could touch 30 real children's names and photos" is a question a thesis panel will ask, and RA 10173 asks it too, if implicitly. "Two named individuals" is a materially stronger answer than "the whole team, unrestricted."

### 2.2 Acceptable use of prod access

Holding prod access is not a license to browse it. Prod data (dashboard, direct DB queries, Storage) is accessed **only** for active debugging, calibration-data export (§6, `research/export_dataset.py`), or incident response (§7.2) — never out of casual curiosity about how a particular student's scores are trending. No technical enforcement is built for this at 2-key-holder scale; it's a stated norm, not tooling — any prod access should have a reason its holder could state out loud if asked.

### 2.3 Secret handling (extends TECH_STACK's conventions)

TECH_STACK.md already establishes the mechanics — `.env`/`.env.local` gitignored, `.env.example` templates committed, prod secrets set directly in Vercel/Railway dashboards, never in files. This section adds the policy layer TECH_STACK didn't cover:

- Secrets are **never** pasted into chat, issue trackers, or committed anywhere, even temporarily "to test something."
- If a secret is suspected leaked (e.g. accidentally committed, pasted somewhere it shouldn't be, or a key-holder's machine is compromised), it is rotated immediately via the Supabase dashboard — rotation is a same-day action, not a "get to it eventually" one. This is also step 1 of the breach-response checklist in §7.2.

---

## 3. Authentication & Session Security

| Setting | Decision | Rationale |
|---|---|---|
| **Password minimum length** | 10 characters | Supabase's 6-char default is thin for accounts guarding real children's data; 10 is readable for a Grade 3 teacher setting up on a phone but well past trivially-crackable. |
| **Leaked-password protection** | Enabled (Supabase Auth's HaveIBeenPwned-backed check) | Zero engineering cost — one config toggle — and a genuinely strong, citable line for the ISO/IEC 25010 security writeup, versus "we used the defaults." |
| **Complexity rules (symbols/mixed-case required)** | Not added | Modern guidance treats these as weaker than length alone — they push users toward predictable substitutions (`Password1!`) rather than genuinely stronger passwords. |
| **Session (JWT) expiry** | Supabase default (1 hour, transparently renewed via refresh token) | No reason to deviate; renewal is invisible to the user. |
| **Refresh token lifetime** | Supabase default (7 days, sliding) | Shortening it adds re-login friction for teachers/parents with no meaningful security gain at this threat level — this isn't a banking app, and the realistic threat (device left unlocked) isn't meaningfully mitigated by a shorter window. |
| **MFA (TOTP)** | Not offered for the pilot | Adds real setup friction for non-technical teachers/parents on a live school rollout; the threat it defends against (credential theft) is comparatively low-probability here — invite-only accounts, no public signup, small closed user base. Documented here as a considered trade-off, not an oversight. |

---

## 4. File Upload Security

CV_PIPELINE's quality gate (blur/brightness/contrast/resolution) and API_SPEC §3.3's declared-MIME-type / 15 MB checks exist to protect **data quality** for the calibration study — neither is a security control. Three gaps, all closed as part of `POST /submissions` (ARCHITECTURE §8, ahead of or alongside step 1/2):

1. **MIME-type spoofing.** API_SPEC checks the client-*declared* content type only. Fix: verify the actual file signature (magic bytes) server-side before the file reaches Pillow/OpenCV.
2. **Decompression-bomb risk.** A small file can decode into an enormous in-memory bitmap, exhausting container memory *before* the quality gate's resolution check runs (that check happens post-decode). Fix: cap decoded pixel dimensions at decode time (e.g. Pillow's `Image.MAX_IMAGE_PIXELS`, or an explicit width×height ceiling) before any further processing.
3. **EXIF metadata, specifically GPS.** A phone photo of a child's worksheet can carry embedded GPS coordinates of exactly where it was taken — a home or a school. This is the most important finding in this document: nothing in any other doc addresses it, and it's a direct RA 10173 issue involving real children. **Treated as must-fix, not optional.** All EXIF metadata (GPS, timestamps, device info) is stripped from the image server-side, unconditionally, before it's written to Storage.

---

## 5. Infrastructure & Data Protection

### 5.1 Supabase plan tier

**Current constraint: no Pro-tier subscription.** This changes the mitigation shape but not the requirement — the underlying risks (no backups, auto-pause) still need covering, just without a subscription to buy them away.

- **Auto-pause mitigation:** `writewise-prod` free-tier projects pause after 7 days of inactivity. A scheduled GitHub Actions workflow (free, cron-based) pings `GET /api/health` (already exists, API_SPEC §3.4) every few days to keep the project active — trivial to build, zero ongoing cost.
- **Backup mitigation:** free tier has no automatic backups or point-in-time recovery, and Supabase's native backup (where available) covers Postgres only, not Storage — meaning even a paid plan wouldn't have protected `submission-images`. Mitigation: a manual scripted backup — `pg_dump` against the prod connection string (works on any tier via the Supabase CLI) for the database, plus a small script to copy `submission-images`/`model-artifacts` bucket contents — run **weekly** during the live Phase 1 window by whichever of the two §2.1 key-holders is current. Output is stored somewhere private and **not** in git (real children's data doesn't belong in a repo, private or not) — a personal encrypted drive or private cloud folder is sufficient at this scale.

### 5.2 Inherited controls (no decision needed, documented for completeness)

- **Transport encryption:** Vercel, Railway, and Supabase all enforce TLS by default — no additional configuration required.
- **Encryption at rest:** Supabase's managed Postgres and Storage are encrypted at rest by the platform.

### 5.3 Third-party sub-processors

Vercel, Railway, and Supabase all process real student data as sub-processors under RA 10173's framework (the school/team remains the personal information controller). No additional vendor contracts are pursued for this pilot beyond each platform's standard terms — proportionate to pilot scale — but this is worth naming explicitly rather than leaving implicit, since "did you check your vendors" is a standard RA 10173 compliance question.

---

## 6. RA 10173 Compliance

### 6.1 NPC registration — analysis and conclusion

NPC Circular 2022-04 requires registering a Data Processing System with the NPC if the organization employs 250+ people, processes sensitive personal information of 1,000+ individuals, **or** the processing involves automated decision-making or profiling (this last clause applies regardless of the numeric thresholds).

WriteWise is nowhere near the numeric thresholds (30 students, 5 teachers). The automated-decision-making clause is the one worth addressing directly: Phase 2's CNN-generated diagnostic scores could arguably be read as "automated processing... profiling" of a child's academic performance.

**Conclusion: registration is not pursued for this pilot.** The teacher remains in the loop reviewing every result before it's acted on — this is decision *support*, not an unreviewed automated decision producing a legal or similarly significant effect on the child, which is the threshold the profiling concern is really aimed at. **This conclusion should be revisited if WriteWise ever expands beyond a single-school academic pilot** — the automated-decision-making clause doesn't have a size exemption, and a larger deployment would need this re-examined, not assumed to still hold.

### 6.2 Breach notification checklist

RA 10173's IRR requires notifying both the NPC and affected data subjects within 72 hours of *knowledge or reasonable belief* of a qualifying breach (sensitive personal info, unauthorized acquisition, real risk of serious harm) — not from when the investigation is complete. Written down here so it doesn't need to be improvised mid-incident:

1. **Notify internally, immediately on suspicion:** both §2.1 prod-key holders + the team's thesis adviser.
2. **Contain:** rotate the service-role key and any exposed credentials (§2.3); revoke affected sessions if it's an account-level compromise; pull the affected endpoint/feature offline if needed.
3. **Assess against the notification threshold:** sensitive personal info + unauthorized acquisition + real risk of serious harm. (A bug that only ever exposed data to the *correct* teacher/parent for that student is not a breach in the RA 10173 sense — worth distinguishing so the team doesn't over- or under-react.)
4. **Notify within 72 hours if it qualifies:** NPC + affected parents/teacher, with whatever is known so far. The law permits an initial, incomplete notification while investigation continues — it does not require a finished root-cause analysis within the window.
5. **Log every incident**, qualifying or not, in an internal breach/incident log — standing NPC expectation independent of whether any single incident crossed the notification threshold.

### 6.3 Data retention & deletion

No prior doc defines an endpoint for "the purpose has been served." Two data categories, two rules:

- **Identified prod data** (real names, images, tied to real children in `writewise-prod`): retained through the October defense **plus a 6-month buffer** (covers any panel follow-up or re-validation request), then deleted from prod — both DB rows and Storage images — via a documented deletion pass, not left indefinitely. **This commitment extends to backup copies** (DEPLOYMENT.md §11) — a weekly backup is still identified data, so it's deleted on the same 6-months-post-defense schedule as the live database and Storage bucket, not left sitting in the shared backup folder indefinitely.
- **Anonymized exported dataset** (`research/export_dataset.py`'s output, ARCHITECTURE §16): retained indefinitely / for potential future publication, since it no longer contains identifiers and RA 10173's disposal pressure is much lighter on data that's genuinely no longer personal.

### 6.4 Data subject withdrawal procedure

Consent is collected via paper forms outside the app (PRD/ARCHITECTURE, unchanged). What was missing is the technical procedure for acting on a withdrawal once one happens:

1. Parent notifies the teacher (same out-of-app channel as original consent) that they're withdrawing their child.
2. Teacher removes the `teacher_student`/`student_parent` links — `DELETE /students/{id}/teacher-link` (API_SPEC §3.1) — stopping all future data collection immediately.
3. **For data already collected:**
   - If withdrawal happens **before** the "Between Phases" calibration analysis (PRD §5): that student's existing submissions/measurements are manually excluded from the calibration dataset before `export_dataset.py` runs, and their identified records are deleted ahead of the standard §6.3 window.
   - If withdrawal happens **after** calibration has already run and their data is baked into the derived thresholds: full retroactive removal from the aggregate statistics isn't practically possible — the derived thresholds can't "un-learn" from one student's contribution. Their data stops being used going forward and their identified records are deleted early, but the already-computed calibration isn't recomputed. **Stated honestly here rather than promised as something the statistics can actually deliver.**

---

## 7. Logging & PII Hygiene

ARCHITECTURE §15's structured JSON logging (quality-gate results, per-stage timing, errors, via Railway's stdout viewer) is a sound decision as-is — this section only adds the rule ARCHITECTURE §15 didn't state: **what's allowed to appear in a log line.**

Log lines may include `student_id` / `submission_id` (opaque UUIDs — already the existing pattern) and pipeline-stage metadata (timing, error codes, pass/fail reason). Log lines **must never** include `full_name`, raw image bytes, or measurement values presented alongside anything that ties them back to an identifiable child. Railway's log viewer, while not public, is readable by all four team members regardless of §2.1's prod-access restriction — so this rule closes off "a convenient debug log with a kid's name in it gets added six weeks from now under deadline pressure" as a live possibility, at zero present cost.

---

## 8. Dependency Vulnerability Management

TECH_STACK.md already locked "no Dependabot/Renovate — manual updates only" to avoid unattended version bumps close to the October defense. That decision was about avoiding *automatic changes*, not about *never checking* — nothing currently surfaces whether an already-in-use dependency has a known CVE.

**Decision:** run `pip-audit` (backend) and `npm audit` (frontend) manually, at two fixed points — once when Phase 1 goes live, once before the October defense — not wired into CI as a blocking gate (that would reintroduce the unattended-change risk TECH_STACK deliberately avoided). Anything serious that turns up becomes a deliberate, reviewed update, consistent with TECH_STACK's existing "manual, deliberate" philosophy — this just extends it to include vulnerability awareness, which TECH_STACK didn't cover.

---

## 9. Rate Limiting

API_SPEC §8 already flagged the absence of rate limiting as "reasonable at pilot scale... worth a deliberate note that it's an absence, not an oversight." This section formalizes that call rather than changing it:

- **Login/auth attempts:** covered for free by Supabase Auth's built-in rate limiting on sign-in endpoints — no additional work needed.
- **FastAPI routes** (`/submissions`, `/activities`, `/students`): no rate limiting. At 5 teachers / 30 students this isn't a realistic abuse target — the actual worst case is a teacher's flaky mobile connection retrying `POST /submissions` rapidly, a scenario API_SPEC §5 already accepts as a UX trade-off (frontend disables the Submit button on tap). Building real rate-limiting infrastructure (e.g. Redis-backed counters) for this threat level would be effort spent defending against something that doesn't exist at this scale. **Explicitly accepted as a deliberate, documented risk**, not revisited unless the pilot scope grows materially.

---

## 10. Pre-Defense Security Testing

See **TESTING.md §6** — the single source of truth for the automated negative-auth test suite (run on every PR, not just pre-defense) and the manual RLS checklist (pre-defense), each test case cited back to the specific threat in §1 above that it closes. (Superseded here; this section previously held that content directly.)

---

## 11. Known Risks & Open Items

Matching the pattern every other doc in this set closes with — things this document deliberately left as accepted trade-offs or unresolved dependencies, worth tracking as the build progresses:

- **Second prod-key holder not yet named** (§2.1) — needs a name filled in before Phase 1 launch; the *policy* (two named holders, not all four) is locked, the specific second person isn't yet recorded here.
- **Free-tier backup/keep-alive mitigations (§5.1) are unvalidated in practice** — the weekly manual backup script and the health-ping GitHub Action need to actually exist and be exercised once (a real restore test, not just "the script ran without erroring") before Phase 1 goes live with real student data behind it.
- **NPC registration conclusion (§6.1) is scoped to this pilot specifically** — explicitly not a standing exemption; must be re-examined if WriteWise is ever deployed beyond the single Matina Aplaya Elementary pilot.
- ~~EXIF-stripping and decompression-bomb guards (§4) are new scope beyond anything CV_PIPELINE.md currently documents~~ — **Resolved:** ARCHITECTURE.md §8 step 1 and CV_PIPELINE.md §1's diagram (step 0) now both document these running before the CV pipeline starts, and TESTING.md §6.1 has explicit test rows for both.
- **Automated negative-auth tests (TESTING.md §6.1) don't exist yet** — TESTING.md specifies what they should cover, not that they've been written. Needs to land before the "we tested this" claim is actually true.
- **No formal Data Protection Officer designated** — RA 10173 compliance in spirit doesn't require a DPO at this pilot's scale/registration status (§6.1), but if the project's compliance posture is ever questioned by the school or a panel, "who is accountable for this" should have a named answer, not just "the team."
