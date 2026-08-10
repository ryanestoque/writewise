# WriteWise — DEPLOYMENT.md

**A Computer Vision and CNN-Based Diagnostic Cursive Handwriting Assessment and Progress Monitoring System**

- **Document type:** Internal engineering operational runbook (companion to PRD.md, ARCHITECTURE.md, DESIGN.md, CV_PIPELINE.md, ML_PIPELINE.md, DATABASE.md, API_SPEC.md, TECH_STACK.md, SECURITY.md, TESTING.md)
- **Team:** Ryan Christopher B. Estoque, John Lawrence V. Monleon, James David B. Asoy, Saara Eliana G. Ibag
- **Status:** Draft v1
- **Scope:** the concrete, actionable half of "how does this actually get deployed and operated" — one-time platform setup, ordered provisioning, config specifics, model deploy/rollback, backups, go-live sequencing, and decommission. This document answers **"what do I actually click/run, in what order."** For **"why is it structured this way,"** see ARCHITECTURE.md (system design), TECH_STACK.md (local dev, versions), TESTING.md (CI mechanics), and SECURITY.md (access-control rationale) — none of that is repeated here.

---

## 1. Platform Accounts & Ownership

All platform accounts (Vercel, Railway, Supabase, the GitHub repo) live under **Ryan's personal accounts**, with the other three team members added as collaborators where each platform supports it. This mirrors SECURITY.md §2.1's two-named-key-holder pattern rather than introducing a separate shared-org concept — one fewer thing to set up on a 4-person, 9-10-week runway.

| Platform | Account holder | Collaborator access |
|---|---|---|
| GitHub (repo) | Ryan | All 4 team members, standard write access |
| Vercel | Ryan | All 4 team members |
| Railway | Ryan | **Restricted — see §7** |
| Supabase (`writewise-dev`) | Ryan | All 4 team members |
| Supabase (`writewise-prod`) | Ryan | **Restricted — see §7** |

---

## 2. Environments & URLs

Per ARCHITECTURE.md §3, there are exactly two environments (`dev`, `prod`) and no third staging environment. This document adds the concrete URL/hosting decisions ARCHITECTURE.md left unspecified:

- **No custom domain.** The pilot runs on free platform subdomains — a Vercel `*.vercel.app` URL for the frontend and a Railway `*.up.railway.app` URL for the backend. This is a closed, invite-only pilot (5 teachers, one school); a custom domain would add real cost and DNS/renewal overhead for zero functional benefit.
- **Region:** Railway service deployed to the nearest available region to the Philippines at signup time (verify actual regional availability when provisioning — it varies by plan).

---

## 3. Branching & Deploy Flow

**Trunk-based, short-lived feature branches.** Branch off `main` per task (`feat/roster-crud`, `fix/blur-check`), open a PR, get the Vercel preview deployment + CI green (ARCHITECTURE.md §14/§3), merge straight to `main`. No long-lived `develop`/staging branch — that would quietly reintroduce a staging-like environment ARCHITECTURE.md §3 deliberately decided against.

```
feature branch → PR → Vercel preview (dev Supabase) + CI → merge to main → auto-deploy to prod (Vercel + Railway)
```

Deployment itself is **not** owned by GitHub Actions — Vercel's and Railway's native GitHub integrations auto-deploy on push, per ARCHITECTURE.md §14. Actions only gates the merge (tests/lint).

---

## 4. Railway Configuration (Backend)

| Setting | Value |
|---|---|
| Build method | **Nixpacks** (auto-detects from `pyproject.toml`/`uv.lock` — no Dockerfile needed) |
| Plan | **Hobby ($5/mo)** |
| Root directory | `backend` |
| Start command | `uvicorn app.main:app --host 0.0.0.0 --port $PORT` (TECH_STACK.md §3.5) |
| Region | Nearest available to Philippines |

**Why a paid tier, given the team's preference to avoid subscriptions:** Railway removed its genuine free tier in 2023. What remains post-trial is a $1/mo "Free" plan capped at 0.5GB RAM / 0.5GB storage — not enough headroom for TensorFlow + OpenCV + a resident CNN model. The only real free-tier alternative (Render) trades that for a 512MB-RAM instance that spins down after 15 minutes of inactivity, adding a 30-60s cold start on top of the PRD's synchronous "wait in the same session" upload flow — a real risk during a live pilot, and untested against the actual model's memory footprint. Given that, the team elected to treat Railway's ~$5/mo as **one deliberate, team-split, one-time pilot expense** rather than reopen ARCHITECTURE.md's hosting choice — not an ongoing subscription commitment beyond the pilot's life (see §12 for what happens to this cost post-defense).

---

## 5. Vercel Configuration (Frontend)

| Setting | Value |
|---|---|
| Plan | **Hobby (free)** |
| Root directory | `frontend` |
| Preview env vars | Point at `writewise-dev` Supabase values |
| Production env vars | Point at `writewise-prod` Supabase values + the Railway prod URL |

Standard Vercel monorepo setup — no trade-offs to weigh here, Vercel's free tier is generous enough for this pilot's scale outright.

---

## 6. Environment Variables

TECH_STACK.md §8 is the source of truth for the **full list** of required variables per app (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `MODEL_ARTIFACT_PATH`, `SCORING_ENGINE`, etc. — not repeated here). This document adds the **provisioning order**, since several variables have hard dependencies on earlier setup steps:

1. Supabase project URLs/keys exist as soon as the `dev`/`prod` Supabase projects are created (§8, steps 1-2)
2. Railway's own service URL (`NEXT_PUBLIC_API_BASE_URL`'s prod value) only exists **after** the Railway service is created and gets its first deploy — so Railway env vars get filled before Vercel's Production env vars
3. `CORS_ALLOWED_ORIGINS` (Railway) needs the Vercel URL — so it's filled *after* Vercel's project exists, meaning it's the one Railway var that gets revisited/added slightly out of the initial batch
4. `MODEL_ARTIFACT_PATH` doesn't need a real value until a trained model actually exists (§10) — this can lag behind every other variable without blocking anything else

---

## 7. Access Control

SECURITY.md §2.1 already restricts the Supabase `writewise-prod` service-role key to two named key-holders (Ryan + one teammate, TBD), since it bypasses RLS entirely and is described there as "the single highest-impact secret in the system."

**That same `SUPABASE_SERVICE_ROLE_KEY` is also readable in plaintext from Railway's dashboard** (Settings → Variables), since it's a required backend env var (TECH_STACK.md §8.3). If all 4 team members had normal Railway collaborator access, SECURITY.md's two-key-holder policy would be silently bypassed via Railway — a gap that wasn't visible until laying out the deployment mechanics.

**Decision:** Railway dashboard access is restricted to the **same two named key-holders** as Supabase prod. The other two team members work against `writewise-dev` locally and via Vercel/GitHub collaborator access, same as everyone else — they just don't get a Railway login.

> ⚠️ **Follow-up needed:** SECURITY.md §2.1 currently only names the Supabase dashboard explicitly. It should be updated with a one-line cross-reference so the "two key-holders" policy is stated as covering Railway too, not just Supabase — otherwise the written policy and the actual practice quietly diverge. See §15.

---

## 8. Initial Provisioning Runbook (One-Time Setup)

Dependency-ordered — each step assumes the ones before it are done:

1. **Create the GitHub repo** (monorepo, per ARCHITECTURE.md §2)
2. **Create `writewise-dev` and `writewise-prod` Supabase projects.** Run initial migrations (`supabase/migrations/*.sql`) against both.
3. **Create the Railway project** from the GitHub repo — root directory `backend`, Nixpacks build, Hobby tier (§4). Don't fill Supabase-dependent env vars yet.
4. **Fill Railway's env vars**, pointed at **prod** Supabase (Railway only ever serves prod — dev work runs FastAPI locally, TECH_STACK.md §9). Deploy once, note the resulting Railway URL.
5. **Create the Vercel project** from the same repo — root directory `frontend`. Fill **Production** env vars using the Railway URL (step 4) + prod Supabase values. Fill **Preview** env vars using dev Supabase values.
6. **Go back to Railway** and add `CORS_ALLOWED_ORIGINS` now that the Vercel URL exists.
7. **Restrict access** (§7): Railway + Supabase-prod dashboards to the two named key-holders. Add the other two team members as Vercel + GitHub collaborators.
8. **Set up the health-ping GitHub Action** (§9) — needs the Railway URL from step 4.
9. **Upload the first CNN model artifact** to Supabase Storage once a trained model exists (§10) — this step can lag well behind everything else without blocking any other setup.

---

## 9. Health-Ping Keep-Alive Workflow

`writewise-prod`'s Supabase free-tier project auto-pauses after 7 days of inactivity (SECURITY.md §5.1). A scheduled GitHub Action pings the backend's health endpoint to prevent this.

```yaml
# .github/workflows/health-ping.yml
name: Health Ping
on:
  schedule:
    - cron: "0 0 * * *"   # daily, UTC
  workflow_dispatch: {}     # allow manual trigger for testing

jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - name: Ping prod health endpoint
        run: curl -f https://<railway-prod-url>/api/health
```

- **Daily cron**, well inside the 7-day auto-pause window, with margin for a missed run.
- **`writewise-dev` is deliberately not pinged** — it's touched constantly during active development (every local `npm run dev` / `uv run uvicorn` session hits it), so it's very unlikely to sit idle for 7 days *during the build phase*. This becomes a real risk again once active development stops — see §12.
- **Failure handling:** relies on GitHub's default behavior of emailing the repo owner when a scheduled workflow fails — no custom alerting built, consistent with the project's broader "no third-party observability service" stance (ARCHITECTURE.md §15).

---

## 10. CNN Model Artifact Deployment & Versioning

ARCHITECTURE.md §9 already establishes *where* the model lives (Supabase Storage, downloaded once at container startup) and *why* (updates shouldn't require a code redeploy). This section adds the concrete mechanics.

**Versioned filenames, never overwritten:**

```
models/writewise-cnn-v1.keras
models/writewise-cnn-v2.keras
models/writewise-cnn-v3.keras
...
```

`MODEL_ARTIFACT_PATH` (Railway env var, TECH_STACK.md §8.3) points at whichever version is currently active.

**Deploying a new model version:**
1. Upload the new `.keras` file to Supabase Storage under a new version filename (never overwrite an existing one)
2. Update `MODEL_ARTIFACT_PATH` in Railway's dashboard to the new filename
3. Railway auto-redeploys on any env var change — the new model loads at the next container startup (lifespan event, ARCHITECTURE.md §9)

**Rolling back a bad model:**
1. Update `MODEL_ARTIFACT_PATH` back to the previous version's filename
2. Redeploy (same env-var-change trigger)

Old model versions are never deleted from Storage during the pilot — they're the safety net that makes rollback a one-line env var change instead of a scramble to reconstruct a prior training run.

---

## 11. Backup & Restore

SECURITY.md §5.1 already decided the mechanism: a weekly manual `pg_dump` (via Supabase CLI) plus a copy of the `submission-images` and `model-artifacts` Storage buckets, run by whichever of the two key-holders is current, stored somewhere private and never in git.

**This document pins down the specifics that were left open:**

- **Location:** one **shared** private cloud folder (e.g. a Google Drive folder shared only between the two named key-holders), access-restricted the same way as Railway/Supabase-prod (§7) — not two disconnected personal locations. If the person who ran last week's backup is unreachable, the other key-holder still needs to find it.
- **Naming:** timestamped per run — `writewise-prod-backup-YYYY-MM-DD/` containing the `.sql` dump and the Storage bucket copy.
- **Cadence:** weekly during the live Phase 1 window (SECURITY.md §5.1), by whichever key-holder is current.
- **Retention:** backups are deleted on the **same 6-months-post-defense schedule as prod itself** (§12).

> ⚠️ **Follow-up needed:** SECURITY.md §6.3 currently only commits to deleting identified data from the *live* database and Storage 6 months post-defense. A backup is a copy of that same identified data — if backups aren't deleted on the same schedule, the retention policy is incomplete in practice, even though it reads as complete on paper. §6.3 should get a one-line addition extending the deletion commitment to backup copies. See §15.

**Restore testing:** per TESTING.md §8's pre-launch checklist, the backup script needs to actually be exercised with a real restore — not just confirmed to run without erroring — before Phase 1 goes live with real student data behind it.

---

## 12. Rollback Procedure (Bad Deploys)

Both platforms retain deployment history, so the fastest response to a broken deploy is a dashboard rollback, not a fresh fix-and-redeploy cycle:

1. **Vercel:** dashboard → Deployments → select the last known-good deployment → "Promote to Production." Instant, no git action required in the moment.
2. **Railway:** dashboard → Deployments → redeploy a previous build from the deployment history list.
3. **Afterward:** follow up with a proper `git revert` on `main` so the repository state matches what's actually deployed — the dashboard rollback is the emergency stopgap, not the final fix.

**Roll back first, diagnose after** — don't wait to understand root cause before reverting.

**Detection is manual/human-reported** at this pilot's scale — a teacher reports an issue, or someone notices during manual QA (TESTING.md §7). There's no automated app-level error alerting beyond the health-ping's failure notification (§9), which only watches Supabase reachability, not application correctness. This is a deliberate, already-accepted trade-off (ARCHITECTURE.md §15's "no Sentry" decision), not a new gap.

---

## 13. Phase 1 Go-Live Runbook

TESTING.md §8 defines the **conditions** that must be true before Phase 1 launches (tests green, manual QA complete, backup/health-ping exercised, dependency audit done, second key-holder named). This section is the **ordered sequence of actions** for launch day itself, targeted for early September per PRD.md §5.

1. Confirm every item on TESTING.md §8's checklist is checked off
2. Final `main` merge containing everything Phase 1 needs (teacher portal, upload, raw CV display, manual rubric entry) — auto-deploys to prod via Vercel/Railway
3. **Manually smoke-test the actual prod URLs end-to-end** — create a real test activity, upload a real photo, confirm it processes correctly — before any real teacher touches the system. **Non-negotiable**: this is the last checkpoint before real children's data starts flowing, and the easiest step to skip under September time pressure.
4. Create the 5 real teacher accounts against `writewise-prod` (resolves ARCHITECTURE.md §5's "provisioning TBD" note)
5. Hand off prod URLs + credentials to the 5 teachers, with a short orientation given they're non-technical users on a live system for the first time
6. Monitor Railway's structured logs closely for the first several real submissions (ARCHITECTURE.md §15 — this is where that logging investment starts paying off)

---

## 14. Post-Defense Decommission Plan

At the **6-month-post-defense mark** (the same milestone SECURITY.md §6.3 already ties identified-data deletion to):

1. **Cancel the Railway subscription.** Once prod data is deleted, there's nothing left running that's worth the ongoing ~$5/mo.
2. **Delete the `writewise-prod` Supabase project entirely** — not just emptied. This matches SECURITY.md §6.3's language of "a documented deletion pass, not left indefinitely" and avoids a project sitting around that would later need explaining.
3. **Delete `writewise-dev`** as well — no more active development means no more reason to keep it running (and it becomes a fresh auto-pause risk with no health-ping covering it, per §9's noted revisit item).
4. **Let the Vercel deployment go stale, rather than actively tearing it down.** It costs nothing on the free tier, and once Railway is cancelled it'll just show a non-functional login screen — harmless, and not worth a dedicated teardown step.
5. **The GitHub repo stays up indefinitely** as the thesis artifact — this was never in question.

This is a clean, deliberate decommission rather than an indefinite live deployment: the identified-data legal commitment (SECURITY.md §6.3, RA 10173) drives the infrastructure teardown timeline too, rather than the two being handled separately.

---

## 15. Open Items / Cross-Doc Follow-Ups

Things this document surfaced that need a small edit elsewhere, not resolved here:

- **SECURITY.md §2.1** needs a one-line addition making explicit that the two-named-key-holder restriction covers **Railway dashboard access**, not just the Supabase dashboard — the underlying secret (`SUPABASE_SERVICE_ROLE_KEY`) is equally exposed in both places (§7).
- **SECURITY.md §6.3** needs a one-line addition extending the 6-months-post-defense deletion commitment to **backup copies** of identified data, not just the live database and Storage bucket (§11).
- **Second Railway/Supabase-prod key-holder** is still unnamed (mirrors SECURITY.md §11's existing open item) — needs a name before Phase 1 launch, since §7's access restriction depends on knowing who the second person is.
- **Region availability at Railway signup** should be verified at actual provisioning time (§4) rather than assumed — regional options can vary by plan and change over time.
- **`writewise-dev`'s auto-pause exposure post-defense** (§9, §14): once active development stops but before the 6-month decommission point, `writewise-dev` has no health-ping covering it and could auto-pause. Low-stakes since it only holds seeded fake data, but worth a conscious decision rather than an accidental pause if `dev` is still wanted for any reason during that window.
