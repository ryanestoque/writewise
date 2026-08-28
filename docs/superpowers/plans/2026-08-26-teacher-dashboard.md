# Teacher Class-Wide Dashboard & Student Drill-Down Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the teacher class-wide analytics dashboard (`/dashboard`) with class-average summary cards, sortable student criterion table, and a per-student drill-down drawer with trend charts and diagnostic notes, working against Phase 1 manual scores with a seamless switch to Phase 2 calibrated scores.

**Architecture:** Frontend direct-read architecture using `supabase-js` and TanStack Query. Shared score utilities and band presentation components are extracted into `lib/utils/scoring.ts` and `components/shared/` to power both the dashboard and future Parent Portal. The dashboard page composes responsive summary cards, a sortable data table, and a sliding `Sheet` drill-down drawer rendering Recharts trend charts with band-zone background shading.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, shadcn/ui (Sheet, Table, Badge, Card, Popover, Tooltip), Recharts 3.8, TanStack Query, Supabase Client (`supabase-js`), Lucide React icons.

**Spec:** `docs/superpowers/specs/2026-08-26-teacher-dashboard-design.md`

## Global Constraints

- Design tokens: Follow `docs/DESIGN.md` §2.1 for band colors (`band-1` #b6754a, `band-2` #c9a227, `band-3` #7c9b6e, `band-4` #4a8b5c) and `--chart-1` through `--chart-5`.
- Typography: Display/headings use `font-heading` (Poppins); data cells and body text use `font-sans` (Inter) with tabular figures for numbers (`docs/DESIGN.md` §2.2).
- Shape & Elevation: Data-dense tables use `rounded-sm border border-border` without shadow; cards use `rounded-xl shadow-warm border border-border bg-card` (`docs/DESIGN.md` §2.4).
- Accessibility: Color is never the sole signal — every band indicator pairs color with its text label (`docs/DESIGN.md` §9). Interactive elements meet min 40px touch targets on mobile (`docs/DESIGN.md` §4).
- Data Access: Pure direct reads via `supabase-js` RLS-gated queries (`docs/API_SPEC.md` §1). No new backend endpoints or schema migrations.
- TypeScript & Linting: Zero `any` types; all code must pass `npx eslint .` and `npx tsc --noEmit` cleanly.

---

### Task 1: Shared Scoring Utilities & Diagnostic Constants (`lib/utils/scoring.ts`)

**Files:**
- Create: `frontend/lib/utils/scoring.ts`
- Modify: `frontend/components/submissions/submission-detail-dialog.tsx`

**Interfaces:**
- Produces in `lib/utils/scoring.ts`:
  - `export type ScoreBand = 'needs_improvement' | 'developing' | 'satisfactory' | 'excellent';`
  - `export interface RubricBandMeta { band: ScoreBand; label: string; shortLabel: string; score: string; activeClass: string; badgeClass: string; dotColor: string; }`
  - `export const RUBRIC_BANDS: RubricBandMeta[];`
  - `export const RUBRIC_CRITERIA: Array<{ key: string; name: string; shortName: string; hint: string }>;`
  - `export const DIAGNOSTIC_NOTES: Record<string, Record<ScoreBand, string>>;`
  - `export function getBandMeta(band?: ScoreBand | string | null): RubricBandMeta;`
  - `export function getScoreBand(score: number | null | undefined): { label: string; className: string; dotColor: string; band: ScoreBand | null };`
  - `export function getBandFromScore(score: number | null | undefined): ScoreBand | null;`

- [ ] **Step 1: Create `frontend/lib/utils/scoring.ts`**

Write `frontend/lib/utils/scoring.ts` containing the shared band definitions, diagnostic notes lookup table from `DESIGN.md` §8.2, and conversion helpers:

```typescript
import type { ScoreBand } from "@/lib/hooks/use-submissions";

export type { ScoreBand };

export interface RubricBandMeta {
  band: ScoreBand;
  label: string;
  shortLabel: string;
  score: string;
  activeClass: string;
  badgeClass: string;
  dotColor: string;
}

export const RUBRIC_BANDS: RubricBandMeta[] = [
  {
    band: "needs_improvement",
    label: "Needs Improvement",
    shortLabel: "Needs Imp.",
    score: "12.5%",
    activeClass:
      "bg-orange-100 dark:bg-orange-950/80 text-orange-950 dark:text-orange-200 border-orange-400 dark:border-orange-600 ring-2 ring-orange-500/40 shadow-xs font-semibold",
    badgeClass:
      "bg-orange-50 text-orange-800 dark:bg-orange-950 dark:text-orange-300 border-orange-200/80 dark:border-orange-900",
    dotColor: "bg-band-1",
  },
  {
    band: "developing",
    label: "Developing",
    shortLabel: "Developing",
    score: "37.5%",
    activeClass:
      "bg-amber-100 dark:bg-amber-950/80 text-amber-950 dark:text-amber-200 border-amber-400 dark:border-amber-600 ring-2 ring-amber-500/40 shadow-xs font-semibold",
    badgeClass:
      "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-200/80 dark:border-amber-900",
    dotColor: "bg-band-2",
  },
  {
    band: "satisfactory",
    label: "Satisfactory",
    shortLabel: "Satisfactory",
    score: "62.5%",
    activeClass:
      "bg-brand-100 dark:bg-brand-950/80 text-brand-950 dark:text-brand-200 border-brand-400 dark:border-brand-600 ring-2 ring-brand-500/40 shadow-xs font-semibold",
    badgeClass:
      "bg-brand-50 text-brand-800 dark:bg-brand-950/80 dark:text-brand-300 border-brand-300/50 dark:border-brand-900",
    dotColor: "bg-band-3",
  },
  {
    band: "excellent",
    label: "Excellent",
    shortLabel: "Excellent",
    score: "87.5%",
    activeClass:
      "bg-emerald-100 dark:bg-emerald-950/80 text-emerald-950 dark:text-emerald-200 border-emerald-400 dark:border-emerald-600 ring-2 ring-emerald-500/40 shadow-xs font-semibold",
    badgeClass:
      "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-900",
    dotColor: "bg-band-4",
  },
];

export const RUBRIC_CRITERIA = [
  {
    key: "letter_formation",
    bandKey: "letter_formation_band" as const,
    scoreKey: "letter_formation_score" as const,
    name: "1. Letter Formation",
    shortName: "Letter Formation",
    hint: "Proper cursive loops and complete stroke closures",
  },
  {
    key: "size_consistency",
    bandKey: "size_consistency_band" as const,
    scoreKey: "size_consistency_score" as const,
    name: "2. Size Consistency",
    shortName: "Size Consistency",
    hint: "Proportion and height across 3-line penmanship ruling",
  },
  {
    key: "spacing",
    bandKey: "spacing_band" as const,
    scoreKey: "spacing_score" as const,
    name: "3. Spacing",
    shortName: "Spacing",
    hint: "Inter-word rhythm and character separation spacing",
  },
  {
    key: "slant",
    bandKey: "slant_band" as const,
    scoreKey: "slant_score" as const,
    name: "4. Slant Angle",
    shortName: "Slant Angle",
    hint: "Uniform forward slant tilt (target 60°–68° angle)",
  },
  {
    key: "baseline_alignment",
    bandKey: "baseline_alignment_band" as const,
    scoreKey: "baseline_alignment_score" as const,
    name: "5. Baseline Alignment",
    shortName: "Baseline Alignment",
    hint: "Letters resting stably along bottom ruling baseline",
  },
];

export const DIAGNOSTIC_NOTES: Record<string, Record<ScoreBand, string>> = {
  letter_formation: {
    needs_improvement:
      "Several letters aren't fully formed yet — tracing practice on individual letters usually helps build this up.",
    developing:
      "Letter shapes are taking form but still inconsistent — regular practice should smooth this out over the next few activities.",
    satisfactory:
      "Most letters are well-formed with only minor inconsistencies — steady practice will sharpen the remaining details.",
    excellent:
      "Letters are consistently well-formed across the page — a strong, reliable foundation.",
  },
  spacing: {
    needs_improvement:
      "Spacing between letters and words varies a lot — practicing with spacing guides can help build a steadier rhythm.",
    developing:
      "Spacing is becoming more even but still uneven in places — continued practice should even this out.",
    satisfactory:
      "Spacing is mostly even and easy to read — small refinements will make it even more consistent.",
    excellent:
      "Spacing is even and consistent throughout — this makes the writing easy to read at a glance.",
  },
  slant: {
    needs_improvement:
      "Letter slant varies noticeably across the page — slower, more deliberate strokes often help even this out.",
    developing:
      "Slant is becoming more consistent but still shifts in places — this typically steadies with more practice.",
    satisfactory:
      "Slant is mostly consistent with only slight variation — a good sign of developing pen control.",
    excellent:
      "Slant is consistent throughout the page — a clear sign of strong pen control.",
  },
  baseline_alignment: {
    needs_improvement:
      "Letters drift above or below the line often — practicing on lined paper with a visible baseline can help.",
    developing:
      "Letters are staying closer to the baseline but still drift in places — this usually improves with continued practice.",
    satisfactory:
      "Letters mostly sit on the baseline with only occasional drift — a solid sign of control.",
    excellent:
      "Letters consistently sit on the baseline throughout — strong control of line placement.",
  },
  size_consistency: {
    needs_improvement:
      "Letter sizes vary a lot across the page — practicing within guided size boxes can help even this out.",
    developing:
      "Letter sizes are becoming more even but still vary in places — this typically steadies with more practice.",
    satisfactory:
      "Letter sizes are mostly consistent with minor variation — small refinements will make this even steadier.",
    excellent:
      "Letter sizes are consistent throughout the page — a strong, steady hand.",
  },
};

export function getBandMeta(band?: ScoreBand | string | null): RubricBandMeta {
  return (
    RUBRIC_BANDS.find((b) => b.band === band) ?? {
      band: "satisfactory",
      label: band || "Unrated",
      shortLabel: band || "Unrated",
      score: "—",
      activeClass: "",
      badgeClass: "bg-muted/60 text-muted-foreground border-border",
      dotColor: "bg-muted-foreground",
    }
  );
}

export function getBandFromScore(score: number | null | undefined): ScoreBand | null {
  if (score === null || score === undefined) return null;
  if (score >= 75) return "excellent";
  if (score >= 50) return "satisfactory";
  if (score >= 25) return "developing";
  return "needs_improvement";
}

export function getScoreBand(score: number | null | undefined): {
  label: string;
  className: string;
  dotColor: string;
  band: ScoreBand | null;
} {
  const band = getBandFromScore(score);
  if (!band) {
    return {
      label: "Pending",
      className: "bg-muted/60 text-muted-foreground border-border",
      dotColor: "bg-muted-foreground",
      band: null,
    };
  }

  const meta = getBandMeta(band);
  return {
    label: meta.label,
    className: meta.badgeClass,
    dotColor: meta.dotColor,
    band,
  };
}
```

- [ ] **Step 2: Refactor `submission-detail-dialog.tsx` to import shared scoring utilities**

Update `frontend/components/submissions/submission-detail-dialog.tsx` to import `RUBRIC_BANDS`, `RUBRIC_CRITERIA`, `getBandMeta`, `getScoreBand` from `@/lib/utils/scoring` instead of local declarations.

- [ ] **Step 3: Verify TypeScript and Lint**

Run: `npx tsc --noEmit` and `npx eslint frontend/components/submissions/submission-detail-dialog.tsx`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/lib/utils/scoring.ts frontend/components/submissions/submission-detail-dialog.tsx
git commit -m "refactor(scoring): extract shared rubric bands and diagnostic utilities"
```

---

### Task 2: Shared Visual Components (`components/shared/`)

**Files:**
- Create: `frontend/components/shared/band-badge.tsx`
- Create: `frontend/components/shared/band-position-bar.tsx`
- Create: `frontend/components/shared/score-source-indicator.tsx`

**Interfaces:**
- `BandBadge`: `({ band, score, size, showDot, className }: { band?: ScoreBand | null; score?: number | null; size?: "sm" | "default"; showDot?: boolean; className?: string }) => JSX.Element`
- `BandPositionBar`: `({ score, band, showLabel, height, className }: { score?: number | null; band?: ScoreBand | null; showLabel?: boolean; height?: "sm" | "default"; className?: string }) => JSX.Element`
- `ScoreSourceIndicator`: `({ source, className }: { source: "manual" | "calibrated"; className?: string }) => JSX.Element`

- [ ] **Step 1: Create `BandBadge` component**

Create `frontend/components/shared/band-badge.tsx`:
```tsx
import { cn } from "@/lib/utils";
import { getBandMeta, getBandFromScore, type ScoreBand } from "@/lib/utils/scoring";

interface BandBadgeProps {
  band?: ScoreBand | null;
  score?: number | null;
  size?: "sm" | "default";
  showDot?: boolean;
  className?: string;
}

export function BandBadge({
  band,
  score,
  size = "default",
  showDot = true,
  className,
}: BandBadgeProps) {
  const resolvedBand = band ?? (score !== undefined && score !== null ? getBandFromScore(score) : null);
  const meta = getBandMeta(resolvedBand);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-medium border rounded-full transition-colors",
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs",
        meta.badgeClass,
        className
      )}
    >
      {showDot && (
        <span
          className={cn(
            "rounded-full shrink-0",
            size === "sm" ? "w-1.5 h-1.5" : "w-2 h-2",
            meta.dotColor
          )}
          aria-hidden="true"
        />
      )}
      <span>{meta.label}</span>
    </span>
  );
}
```

- [ ] **Step 2: Create `BandPositionBar` component**

Create `frontend/components/shared/band-position-bar.tsx`:
```tsx
import { cn } from "@/lib/utils";
import type { ScoreBand } from "@/lib/utils/scoring";

interface BandPositionBarProps {
  score?: number | null;
  band?: ScoreBand | null;
  showLabel?: boolean;
  height?: "sm" | "default";
  className?: string;
}

export function BandPositionBar({
  score,
  showLabel = false,
  height = "default",
  className,
}: BandPositionBarProps) {
  const numericScore = typeof score === "number" ? Math.max(0, Math.min(100, score)) : null;

  return (
    <div className={cn("w-full flex items-center gap-2", className)}>
      <div
        className={cn(
          "relative flex-1 rounded-full overflow-hidden bg-muted/50 border border-border/50 grid grid-cols-4 p-0.5",
          height === "sm" ? "h-2" : "h-3"
        )}
      >
        {/* 4 Colored Band Zones */}
        <div className="bg-band-1/25 dark:bg-band-1/30 rounded-l-full border-r border-background/60" />
        <div className="bg-band-2/25 dark:bg-band-2/30 border-r border-background/60" />
        <div className="bg-band-3/25 dark:bg-band-3/30 border-r border-background/60" />
        <div className="bg-band-4/25 dark:bg-band-4/30 rounded-r-full" />

        {/* Marker indicator for current score */}
        {numericScore !== null && (
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 transition-all duration-300 ease-out"
            style={{ left: `${numericScore}%` }}
          >
            <div
              className={cn(
                "rounded-full bg-foreground shadow-xs border-2 border-background ring-1 ring-border",
                height === "sm" ? "w-2.5 h-2.5" : "w-3.5 h-3.5"
              )}
            />
          </div>
        )}
      </div>

      {showLabel && (
        <span className="font-sans text-xs font-semibold tabular-nums text-foreground min-w-[2.5rem] text-right">
          {numericScore !== null ? `${numericScore.toFixed(1)}%` : "—"}
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create `ScoreSourceIndicator` component**

Create `frontend/components/shared/score-source-indicator.tsx`:
```tsx
import { cn } from "@/lib/utils";
import { UserCheck, Sparkles } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ScoreSourceIndicatorProps {
  source: "manual" | "calibrated";
  compact?: boolean;
  className?: string;
}

export function ScoreSourceIndicator({
  source,
  compact = false,
  className,
}: ScoreSourceIndicatorProps) {
  const isManual = source === "manual";

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-flex items-center gap-1 text-xs font-medium text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-md border border-border/60 transition-colors",
              className
            )}
          >
            {isManual ? (
              <UserCheck className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            )}
            {!compact && <span>{isManual ? "Teacher-assessed" : "Auto-calibrated"}</span>}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs max-w-xs">
          {isManual
            ? "Scores currently derived from teacher's rubric assessment (Phase 1 calibration mode)."
            : "Scores generated automatically by calibrated CV and CNN diagnostic pipeline."}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
```

- [ ] **Step 4: Verify TypeScript and Lint**

Run: `npx tsc --noEmit` and `npx eslint frontend/components/shared/`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/components/shared/
git commit -m "feat(ui): add BandBadge, BandPositionBar, and ScoreSourceIndicator shared components"
```

---

### Task 3: Dashboard Data Hooks (`lib/hooks/use-dashboard.ts`)

**Files:**
- Create: `frontend/lib/hooks/use-dashboard.ts`

**Interfaces:**
- Produces:
  - `export interface StudentScoreSummary { studentId: string; fullName: string; section: string; latestSubmissionId: string | null; latestSubmissionDate: string | null; scoreSource: 'manual' | 'calibrated' | 'none'; scores: { letter_formation: number | null; size_consistency: number | null; spacing: number | null; slant: number | null; baseline_alignment: number | null; composite: number | null; }; bands: { letter_formation: ScoreBand | null; size_consistency: ScoreBand | null; spacing: ScoreBand | null; slant: ScoreBand | null; baseline_alignment: ScoreBand | null; composite: ScoreBand | null; }; }`
  - `export interface ClassAverages { letter_formation: number | null; size_consistency: number | null; spacing: number | null; slant: number | null; baseline_alignment: number | null; composite: number | null; scoredStudentsCount: number; totalStudentsCount: number; scoreSource: 'manual' | 'calibrated'; }`
  - `export function useDashboardScores(): { data: { students: StudentScoreSummary[]; classAverages: ClassAverages; } | undefined; isLoading: boolean; error: Error | null; refetch: () => void; }`
  - `export interface StudentScoreHistoryItem { submissionId: string; submissionDate: string; activityId: string; targetText: string; isTakeHome: boolean; scoreSource: 'manual' | 'calibrated'; compositeScore: number | null; compositeBand: ScoreBand | null; scores: { letter_formation: number | null; size_consistency: number | null; spacing: number | null; slant: number | null; baseline_alignment: number | null; }; bands: { letter_formation: ScoreBand | null; size_consistency: ScoreBand | null; spacing: ScoreBand | null; slant: ScoreBand | null; baseline_alignment: ScoreBand | null; }; }`
  - `export function useStudentScoreHistory(studentId: string | null): { data: StudentScoreHistoryItem[] | undefined; isLoading: boolean; error: Error | null; }`

- [ ] **Step 1: Create `frontend/lib/hooks/use-dashboard.ts`**

Write `frontend/lib/hooks/use-dashboard.ts`:
```typescript
import { useQuery } from "@tanstack/react-query";
import { createClient } from "../supabase/client";
import { getBandFromScore, type ScoreBand } from "../utils/scoring";

export interface StudentScoreSummary {
  studentId: string;
  fullName: string;
  section: string;
  latestSubmissionId: string | null;
  latestSubmissionDate: string | null;
  scoreSource: "manual" | "calibrated" | "none";
  scores: {
    letter_formation: number | null;
    size_consistency: number | null;
    spacing: number | null;
    slant: number | null;
    baseline_alignment: number | null;
    composite: number | null;
  };
  bands: {
    letter_formation: ScoreBand | null;
    size_consistency: ScoreBand | null;
    spacing: ScoreBand | null;
    slant: ScoreBand | null;
    baseline_alignment: ScoreBand | null;
    composite: ScoreBand | null;
  };
}

export interface ClassAverages {
  letter_formation: number | null;
  size_consistency: number | null;
  spacing: number | null;
  slant: number | null;
  baseline_alignment: number | null;
  composite: number | null;
  scoredStudentsCount: number;
  totalStudentsCount: number;
  scoreSource: "manual" | "calibrated";
}

export function useDashboardScores() {
  const supabase = createClient();

  return useQuery({
    queryKey: ["dashboard-scores"],
    queryFn: async () => {
      // Query students linked to teacher with their submissions, manual scores, and measurement scores
      const { data, error } = await supabase
        .from("student")
        .select(`
          id,
          full_name,
          section,
          submissions:submission(
            id,
            created_at,
            status,
            manual_score(
              letter_formation_band,
              letter_formation_score,
              size_consistency_band,
              size_consistency_score,
              spacing_band,
              spacing_score,
              slant_band,
              slant_score,
              baseline_alignment_band,
              baseline_alignment_score
            ),
            measurement(
              letter_formation_score,
              size_consistency_score,
              spacing_score,
              slant_score,
              baseline_alignment_score,
              composite_score
            )
          )
        `)
        .order("full_name");

      if (error) {
        throw new Error(error.message);
      }

      const students: StudentScoreSummary[] = [];
      let totalScored = 0;
      let hasCalibrated = false;

      const sumTotals = {
        letter_formation: 0,
        size_consistency: 0,
        spacing: 0,
        slant: 0,
        baseline_alignment: 0,
        composite: 0,
        count: 0,
      };

      for (const row of (data || [])) {
        const studentSubmissions = Array.isArray(row.submissions) ? row.submissions : [];
        // Filter only completed submissions that have either manual_score or measurement
        const scoredSubmissions = studentSubmissions
          .filter((s) => s.status === "completed")
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        const latest = scoredSubmissions[0];

        if (!latest) {
          students.push({
            studentId: row.id,
            fullName: row.full_name,
            section: row.section,
            latestSubmissionId: null,
            latestSubmissionDate: null,
            scoreSource: "none",
            scores: {
              letter_formation: null,
              size_consistency: null,
              spacing: null,
              slant: null,
              baseline_alignment: null,
              composite: null,
            },
            bands: {
              letter_formation: null,
              size_consistency: null,
              spacing: null,
              slant: null,
              baseline_alignment: null,
              composite: null,
            },
          });
          continue;
        }

        const rawMeasurement = Array.isArray(latest.measurement) ? latest.measurement[0] : latest.measurement;
        const rawManual = Array.isArray(latest.manual_score) ? latest.manual_score[0] : latest.manual_score;

        // Phase 2 check: if measurement has calibrated scores
        const isCalibrated = rawMeasurement?.composite_score != null;
        if (isCalibrated) hasCalibrated = true;

        let lfScore: number | null = null;
        let scScore: number | null = null;
        let spScore: number | null = null;
        let slScore: number | null = null;
        let baScore: number | null = null;
        let compScore: number | null = null;

        let lfBand: ScoreBand | null = null;
        let scBand: ScoreBand | null = null;
        let spBand: ScoreBand | null = null;
        let slBand: ScoreBand | null = null;
        let baBand: ScoreBand | null = null;

        if (isCalibrated) {
          lfScore = rawMeasurement.letter_formation_score;
          scScore = rawMeasurement.size_consistency_score;
          spScore = rawMeasurement.spacing_score;
          slScore = rawMeasurement.slant_score;
          baScore = rawMeasurement.baseline_alignment_score;
          compScore = rawMeasurement.composite_score;

          lfBand = getBandFromScore(lfScore);
          scBand = getBandFromScore(scScore);
          spBand = getBandFromScore(spScore);
          slBand = getBandFromScore(slScore);
          baBand = getBandFromScore(baScore);
        } else if (rawManual) {
          lfScore = rawManual.letter_formation_score ?? null;
          scScore = rawManual.size_consistency_score ?? null;
          spScore = rawManual.spacing_score ?? null;
          slScore = rawManual.slant_score ?? null;
          baScore = rawManual.baseline_alignment_score ?? null;

          lfBand = rawManual.letter_formation_band ?? null;
          scBand = rawManual.size_consistency_band ?? null;
          spBand = rawManual.spacing_band ?? null;
          slBand = rawManual.slant_band ?? null;
          baBand = rawManual.baseline_alignment_band ?? null;

          if (lfScore !== null && scScore !== null && spScore !== null && slScore !== null && baScore !== null) {
            compScore = (lfScore + scScore + spScore + slScore + baScore) / 5;
          }
        }

        const compBand = compScore !== null ? getBandFromScore(compScore) : null;

        if (compScore !== null) {
          totalScored++;
          sumTotals.letter_formation += lfScore ?? 0;
          sumTotals.size_consistency += scScore ?? 0;
          sumTotals.spacing += spScore ?? 0;
          sumTotals.slant += slScore ?? 0;
          sumTotals.baseline_alignment += baScore ?? 0;
          sumTotals.composite += compScore;
          sumTotals.count++;
        }

        students.push({
          studentId: row.id,
          fullName: row.full_name,
          section: row.section,
          latestSubmissionId: latest.id,
          latestSubmissionDate: latest.created_at,
          scoreSource: isCalibrated ? "calibrated" : rawManual ? "manual" : "none",
          scores: {
            letter_formation: lfScore,
            size_consistency: scScore,
            spacing: spScore,
            slant: slScore,
            baseline_alignment: baScore,
            composite: compScore,
          },
          bands: {
            letter_formation: lfBand,
            size_consistency: scBand,
            spacing: spBand,
            slant: slBand,
            baseline_alignment: baBand,
            composite: compBand,
          },
        });
      }

      const count = sumTotals.count || 1;
      const classAverages: ClassAverages = {
        letter_formation: sumTotals.count > 0 ? sumTotals.letter_formation / count : null,
        size_consistency: sumTotals.count > 0 ? sumTotals.size_consistency / count : null,
        spacing: sumTotals.count > 0 ? sumTotals.spacing / count : null,
        slant: sumTotals.count > 0 ? sumTotals.slant / count : null,
        baseline_alignment: sumTotals.count > 0 ? sumTotals.baseline_alignment / count : null,
        composite: sumTotals.count > 0 ? sumTotals.composite / count : null,
        scoredStudentsCount: totalScored,
        totalStudentsCount: students.length,
        scoreSource: hasCalibrated ? "calibrated" : "manual",
      };

      return { students, classAverages };
    },
  });
}

export interface StudentScoreHistoryItem {
  submissionId: string;
  submissionDate: string;
  activityId: string;
  targetText: string;
  isTakeHome: boolean;
  scoreSource: "manual" | "calibrated";
  compositeScore: number | null;
  compositeBand: ScoreBand | null;
  scores: {
    letter_formation: number | null;
    size_consistency: number | null;
    spacing: number | null;
    slant: number | null;
    baseline_alignment: number | null;
  };
  bands: {
    letter_formation: ScoreBand | null;
    size_consistency: ScoreBand | null;
    spacing: ScoreBand | null;
    slant: ScoreBand | null;
    baseline_alignment: ScoreBand | null;
  };
}

export function useStudentScoreHistory(studentId: string | null) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["student-score-history", studentId],
    queryFn: async () => {
      if (!studentId) return [];

      const { data, error } = await supabase
        .from("submission")
        .select(`
          id,
          created_at,
          status,
          activity:activity_id(
            id,
            target_text,
            is_take_home
          ),
          manual_score(
            letter_formation_band,
            letter_formation_score,
            size_consistency_band,
            size_consistency_score,
            spacing_band,
            spacing_score,
            slant_band,
            slant_score,
            baseline_alignment_band,
            baseline_alignment_score
          ),
          measurement(
            letter_formation_score,
            size_consistency_score,
            spacing_score,
            slant_score,
            baseline_alignment_score,
            composite_score
          )
        `)
        .eq("student_id", studentId)
        .eq("status", "completed")
        .order("created_at", { ascending: true });

      if (error) {
        throw new Error(error.message);
      }

      const history: StudentScoreHistoryItem[] = [];

      for (const row of (data || [])) {
        const rawMeasurement = Array.isArray(row.measurement) ? row.measurement[0] : row.measurement;
        const rawManual = Array.isArray(row.manual_score) ? row.manual_score[0] : row.manual_score;
        const rawActivity = Array.isArray(row.activity) ? row.activity[0] : row.activity;

        const isCalibrated = rawMeasurement?.composite_score != null;
        if (!isCalibrated && !rawManual) continue;

        let lfScore: number | null = null;
        let scScore: number | null = null;
        let spScore: number | null = null;
        let slScore: number | null = null;
        let baScore: number | null = null;
        let compScore: number | null = null;

        let lfBand: ScoreBand | null = null;
        let scBand: ScoreBand | null = null;
        let spBand: ScoreBand | null = null;
        let slBand: ScoreBand | null = null;
        let baBand: ScoreBand | null = null;

        if (isCalibrated) {
          lfScore = rawMeasurement.letter_formation_score;
          scScore = rawMeasurement.size_consistency_score;
          spScore = rawMeasurement.spacing_score;
          slScore = rawMeasurement.slant_score;
          baScore = rawMeasurement.baseline_alignment_score;
          compScore = rawMeasurement.composite_score;

          lfBand = getBandFromScore(lfScore);
          scBand = getBandFromScore(scScore);
          spBand = getBandFromScore(spScore);
          slBand = getBandFromScore(slScore);
          baBand = getBandFromScore(baScore);
        } else if (rawManual) {
          lfScore = rawManual.letter_formation_score ?? null;
          scScore = rawManual.size_consistency_score ?? null;
          spScore = rawManual.spacing_score ?? null;
          slScore = rawManual.slant_score ?? null;
          baScore = rawManual.baseline_alignment_score ?? null;

          lfBand = rawManual.letter_formation_band ?? null;
          scBand = rawManual.size_consistency_band ?? null;
          spBand = rawManual.spacing_band ?? null;
          slBand = rawManual.slant_band ?? null;
          baBand = rawManual.baseline_alignment_band ?? null;

          if (lfScore !== null && scScore !== null && spScore !== null && slScore !== null && baScore !== null) {
            compScore = (lfScore + scScore + spScore + slScore + baScore) / 5;
          }
        }

        const compBand = compScore !== null ? getBandFromScore(compScore) : null;

        history.push({
          submissionId: row.id,
          submissionDate: row.created_at,
          activityId: rawActivity?.id || "",
          targetText: rawActivity?.target_text || "Handwriting Activity",
          isTakeHome: Boolean(rawActivity?.is_take_home),
          scoreSource: isCalibrated ? "calibrated" : "manual",
          compositeScore: compScore,
          compositeBand: compBand,
          scores: {
            letter_formation: lfScore,
            size_consistency: scScore,
            spacing: spScore,
            slant: slScore,
            baseline_alignment: baScore,
          },
          bands: {
            letter_formation: lfBand,
            size_consistency: scBand,
            spacing: spBand,
            slant: slBand,
            baseline_alignment: baBand,
          },
        });
      }

      return history;
    },
    enabled: !!studentId,
  });
}
```

- [ ] **Step 2: Verify TypeScript and Lint**

Run: `npx tsc --noEmit` and `npx eslint frontend/lib/hooks/use-dashboard.ts`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/lib/hooks/use-dashboard.ts
git commit -m "feat(hooks): implement useDashboardScores and useStudentScoreHistory hooks"
```

---

### Task 4: Recharts Criterion Trend Chart (`components/dashboard/criterion-trend-chart.tsx`)

**Files:**
- Create: `frontend/components/dashboard/criterion-trend-chart.tsx`

**Interfaces:**
- Produces:
  - `export function CriterionTrendChart({ history }: { history: StudentScoreHistoryItem[] }): JSX.Element`

- [ ] **Step 1: Create `CriterionTrendChart`**

Create `frontend/components/dashboard/criterion-trend-chart.tsx`:
- Render Recharts `ResponsiveContainer`, `LineChart`, `XAxis`, `YAxis`, `CartesianGrid`, `Tooltip`, `ReferenceArea`, and `Line` components.
- Include background shaded `ReferenceArea` zones for the 4 bands (0–25 Needs Improvement, 25–50 Developing, 50–75 Satisfactory, 75–100 Excellent).
- 5 distinct colored lines for the criteria + toggleable visibility/legend.
- Handle empty state (<2 submissions) gracefully.

- [ ] **Step 2: Verify TypeScript and Lint**

Run: `npx tsc --noEmit` and `npx eslint frontend/components/dashboard/criterion-trend-chart.tsx`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/dashboard/criterion-trend-chart.tsx
git commit -m "feat(dashboard): create CriterionTrendChart with shaded band zones"
```

---

### Task 5: Summary Cards & Class-Wide Student Table (`components/dashboard/`)

**Files:**
- Create: `frontend/components/dashboard/summary-cards.tsx`
- Create: `frontend/components/dashboard/class-table.tsx`

**Interfaces:**
- Produces:
  - `SummaryCards`: `({ averages, isLoading }: { averages?: ClassAverages; isLoading?: boolean }) => JSX.Element`
  - `ClassTable`: `({ students, isLoading, onSelectStudent }: { students?: StudentScoreSummary[]; isLoading?: boolean; onSelectStudent: (student: StudentScoreSummary) => void }) => JSX.Element`

- [ ] **Step 1: Create `SummaryCards` component**

Create `frontend/components/dashboard/summary-cards.tsx`:
- 6 responsive cards (Letter Formation, Size Consistency, Spacing, Slant, Baseline Alignment, Composite Overall).
- Lucide icons (`PenTool`, `Ruler`, `Space`, `Italic`, `AlignLeft`, `BarChart3`).
- Numeric score (`87.5%` or `—`), `BandBadge`, `ScoreSourceIndicator`.
- Skeletons when loading.

- [ ] **Step 2: Create `ClassTable` component**

Create `frontend/components/dashboard/class-table.tsx`:
- Search input (`SearchInput`) + Section filter pills (`FilterPills`).
- Sortable table headers (Student name, Section, each of the 5 criteria, and Composite).
- Clicking any criterion header sorts ascending/descending — default ascending highlights the weakest criterion.
- Row click triggers `onSelectStudent`.
- Mobile responsive fallback cards list (<640px) to prevent awkward horizontal scrolling.
- Empty states for zero students or zero graded submissions.

- [ ] **Step 3: Verify TypeScript and Lint**

Run: `npx tsc --noEmit` and `npx eslint frontend/components/dashboard/`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/components/dashboard/summary-cards.tsx frontend/components/dashboard/class-table.tsx
git commit -m "feat(dashboard): create SummaryCards and sortable ClassTable components"
```

---

### Task 6: Student Drill-Down Drawer (`components/dashboard/student-drill-down.tsx`)

**Files:**
- Create: `frontend/components/dashboard/student-drill-down.tsx`

**Interfaces:**
- Produces:
  - `export function StudentDrillDownDrawer({ student, open, onOpenChange, onOpenSubmission }: { student: StudentScoreSummary | null; open: boolean; onOpenChange: (open: boolean) => void; onOpenSubmission: (submissionId: string, activityId: string) => void }): JSX.Element`

- [ ] **Step 1: Create `StudentDrillDownDrawer` component**

Create `frontend/components/dashboard/student-drill-down.tsx`:
- Uses shadcn `Sheet`, `SheetContent`, `SheetHeader`, `SheetTitle`, `SheetDescription`.
- Header: Avatar + Student Name + Section + `ScoreSourceIndicator`.
- Section 1: Latest Criterion Breakdown Panel (5 rows + composite, `BandPositionBar`, `BandBadge`, and one-line `DIAGNOSTIC_NOTES` explanation from `DESIGN.md` §8.2).
- Section 2: `CriterionTrendChart` displaying historical trajectory over time.
- Section 3: Submission History list, each showing date, target text, composite score, and clicking opens `SubmissionDetailDialog`.

- [ ] **Step 2: Verify TypeScript and Lint**

Run: `npx tsc --noEmit` and `npx eslint frontend/components/dashboard/student-drill-down.tsx`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/dashboard/student-drill-down.tsx
git commit -m "feat(dashboard): implement StudentDrillDownDrawer with scores panel and history"
```

---

### Task 7: Dashboard Page Assembly (`app/(teacher)/dashboard/page.tsx`) & E2E Verification

**Files:**
- Modify: `frontend/app/(teacher)/dashboard/page.tsx`

**Interfaces:**
- Replaces placeholder with the complete, functional dashboard page.

- [ ] **Step 1: Replace placeholder on `frontend/app/(teacher)/dashboard/page.tsx`**

Write `frontend/app/(teacher)/dashboard/page.tsx`:
- Integrates `useDashboardScores()`.
- State for `selectedStudent` (to open `StudentDrillDownDrawer`).
- State for `activeSubmissionId` & `activeActivityId` (to open `SubmissionDetailDialog`).
- Renders page header, `SummaryCards`, `ClassTable`, `StudentDrillDownDrawer`, and `SubmissionDetailDialog`.

- [ ] **Step 2: Run Full Automated Verification Suite**

Run:
1. `npx tsc --noEmit` (frontend TypeScript check)
2. `npx eslint .` (frontend ESLint)
3. `uv run ruff check .` (backend ruff lint)
4. `uv run pytest` (backend test suite)
Expected: All checks pass cleanly with 0 errors.

- [ ] **Step 3: Update `IMPLEMENTATION_STATUS.md`**

Update `IMPLEMENTATION_STATUS.md` to reflect the completion of:
- "Class-wide dashboard (sortable by weakest criterion, class-average trend)"
- "Per-student drill-down trend"

- [ ] **Step 4: Commit**

```bash
git add frontend/app/\(teacher\)/dashboard/page.tsx IMPLEMENTATION_STATUS.md
git commit -m "feat(dashboard): complete teacher class-wide dashboard and student drill-down"
```
