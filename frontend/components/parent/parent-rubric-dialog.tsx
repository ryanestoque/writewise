"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BookOpen, PenTool, Scaling, MoveHorizontal, Compass, AlignHorizontalJustifyStart, CheckCircle2 } from "lucide-react";
import { BandBadge } from "@/components/shared/band-badge";
import { cn } from "@/lib/utils";

interface ParentRubricDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialCriterion?: string | null;
}

const CRITERIA_GUIDE = [
  {
    key: "letter_formation",
    title: "Letter Shapes & Formation",
    icon: PenTool,
    summary: "How accurately cursive letters are formed with proper loops, entry strokes, and connections.",
    whatToLookFor: "Smooth loops on letters like 'e', 'l', and 'f', without accidental printed letter shapes or sharp corners.",
  },
  {
    key: "size_consistency",
    title: "Size & Proportions",
    icon: Scaling,
    summary: "Consistent height ratios across tall letters, middle letters, and letters with descenders.",
    whatToLookFor: "Middle letters (like a, c, m) stay below the midline, while tall letters (l, t, b) reach the headline evenly.",
  },
  {
    key: "spacing",
    title: "Letter & Word Spacing",
    icon: MoveHorizontal,
    summary: "Rhythmic spacing between connected letters and clear separation between separate words.",
    whatToLookFor: "Words do not bunch together, and letters within a word flow smoothly without awkward gaps or squished joins.",
  },
  {
    key: "slant",
    title: "Slant & Tilt",
    icon: Compass,
    summary: "A consistent forward angle across all letters on the page.",
    whatToLookFor: "Letters tilt uniformly to the right (about 60°–75°), avoiding mixed vertical and backslanted letters in the same line.",
  },
  {
    key: "baseline_alignment",
    title: "Line & Baseline Alignment",
    icon: AlignHorizontalJustifyStart,
    summary: "Keeping the bottoms of letters anchored along the writing guideline.",
    whatToLookFor: "Words sit squarely on the baseline rather than floating above the line or sinking beneath it.",
  },
];

const BANDS_GUIDE = [
  { band: "excellent" as const, score: 90, label: "Excellent (75–100%)", desc: "Fluent, highly consistent handwriting meeting grade-level goals." },
  { band: "satisfactory" as const, score: 65, label: "Satisfactory (50–74%)", desc: "Solid cursive foundation with minor areas to refine." },
  { band: "developing" as const, score: 38, label: "Developing (25–49%)", desc: "Actively learning and building muscle memory — a normal, key stage in cursive development." },
  { band: "needs_improvement" as const, score: 15, label: "Needs Improvement (0–24%)", desc: "Working on basic letter strokes, posture, or pencil grip with guided practice." },
];

function CursiveCriterionIllustration({ criterionKey }: { criterionKey: string }) {
  switch (criterionKey) {
    case "letter_formation":
      return (
        <svg
          viewBox="0 0 168 52"
          className="w-full max-w-[178px] h-13 select-none"
          aria-hidden="true"
        >
          {/* 3-line penmanship rule */}
          <line x1="8" y1="10" x2="160" y2="10" stroke="currentColor" className="text-border/60" strokeWidth="1" />
          <line x1="8" y1="26" x2="160" y2="26" stroke="currentColor" className="text-brand-300/60 dark:text-brand-700/60" strokeWidth="1" strokeDasharray="3 3" />
          <line x1="8" y1="42" x2="160" y2="42" stroke="currentColor" className="text-brand-600/70 dark:text-brand-400/70" strokeWidth="1.5" />

          {/* Cursive 'l' and 'e' strokes with rounded loop */}
          <path
            d="M 18 42 C 24 38, 30 18, 38 10 C 42 6, 46 12, 42 26 C 40 34, 42 42, 50 42 C 54 42, 58 36, 62 26 C 66 18, 70 24, 66 34 C 64 39, 68 42, 76 42"
            fill="none"
            stroke="currentColor"
            className="text-brand-700 dark:text-brand-300"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Loop highlight callout */}
          <circle cx="40" cy="10" r="5" fill="none" stroke="currentColor" className="text-brand-500 animate-pulse motion-reduce:animate-none" strokeWidth="1.2" strokeDasharray="2 2" />
          <text x="86" y="23" className="text-[11px] font-sans font-semibold fill-brand-700 dark:fill-brand-300">
            Smooth loops
          </text>
          <text x="86" y="37" className="text-[11px] font-sans fill-muted-foreground">
            no sharp corners
          </text>
        </svg>
      );

    case "size_consistency":
      return (
        <svg
          viewBox="0 0 168 52"
          className="w-full max-w-[178px] h-13 select-none"
          aria-hidden="true"
        >
          {/* 3-line penmanship rule */}
          <line x1="8" y1="10" x2="160" y2="10" stroke="currentColor" className="text-brand-600/40" strokeWidth="1" />
          <line x1="8" y1="26" x2="160" y2="26" stroke="currentColor" className="text-brand-300/60 dark:text-brand-700/60" strokeWidth="1" strokeDasharray="3 3" />
          <line x1="8" y1="42" x2="160" y2="42" stroke="currentColor" className="text-brand-600/70 dark:text-brand-400/70" strokeWidth="1.5" />

          {/* Tall letter 't' touching headline */}
          <path
            d="M 22 42 C 26 38, 28 20, 28 10 C 28 25, 28 42, 34 42"
            fill="none"
            stroke="currentColor"
            className="text-brand-700 dark:text-brand-300"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <line x1="22" y1="22" x2="34" y2="22" stroke="currentColor" className="text-brand-700 dark:text-brand-300" strokeWidth="2" strokeLinecap="round" />

          {/* Middle letter 'a' capped at midline */}
          <path
            d="M 44 34 C 44 28, 50 26, 56 26 C 62 26, 64 32, 64 42 M 64 26 C 64 35, 64 42, 68 42 M 44 34 C 44 40, 52 42, 64 42"
            fill="none"
            stroke="currentColor"
            className="text-brand-700 dark:text-brand-300"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Height indicators */}
          <line x1="74" y1="10" x2="74" y2="42" stroke="currentColor" className="text-brand-400/80" strokeWidth="1" strokeDasharray="2 2" />
          <text x="82" y="21" className="text-[11px] font-sans font-semibold fill-brand-700 dark:fill-brand-300">
            Tall: Headline
          </text>
          <text x="82" y="35" className="text-[11px] font-sans font-medium fill-muted-foreground">
            Middle: Midline
          </text>
        </svg>
      );

    case "spacing":
      return (
        <svg
          viewBox="0 0 168 52"
          className="w-full max-w-[178px] h-13 select-none"
          aria-hidden="true"
        >
          {/* 3-line penmanship rule */}
          <line x1="8" y1="10" x2="160" y2="10" stroke="currentColor" className="text-border/60" strokeWidth="1" />
          <line x1="8" y1="26" x2="160" y2="26" stroke="currentColor" className="text-brand-300/60 dark:text-brand-700/60" strokeWidth="1" strokeDasharray="3 3" />
          <line x1="8" y1="42" x2="160" y2="42" stroke="currentColor" className="text-brand-600/70 dark:text-brand-400/70" strokeWidth="1.5" />

          {/* Cursive join with even gap */}
          <path
            d="M 18 42 C 22 36, 26 26, 30 26 C 34 26, 36 34, 38 42 M 48 42 C 52 36, 56 26, 60 26 C 64 26, 66 34, 68 42"
            fill="none"
            stroke="currentColor"
            className="text-brand-700 dark:text-brand-300"
            strokeWidth="2"
            strokeLinecap="round"
          />
          {/* Spacing dimension bracket */}
          <line x1="38" y1="36" x2="48" y2="36" stroke="currentColor" className="text-brand-600 dark:text-brand-400" strokeWidth="1.5" />
          <circle cx="38" cy="36" r="1.5" className="fill-brand-600 dark:fill-brand-400" />
          <circle cx="48" cy="36" r="1.5" className="fill-brand-600 dark:fill-brand-400" />

          <text x="76" y="23" className="text-[11px] font-sans font-semibold fill-brand-700 dark:fill-brand-300">
            Rhythmic gap
          </text>
          <text x="76" y="37" className="text-[11px] font-sans fill-muted-foreground">
            consistent space
          </text>
        </svg>
      );

    case "slant":
      return (
        <svg
          viewBox="0 0 168 52"
          className="w-full max-w-[178px] h-13 select-none"
          aria-hidden="true"
        >
          {/* 3-line penmanship rule */}
          <line x1="8" y1="10" x2="160" y2="10" stroke="currentColor" className="text-border/60" strokeWidth="1" />
          <line x1="8" y1="26" x2="160" y2="26" stroke="currentColor" className="text-brand-300/60 dark:text-brand-700/60" strokeWidth="1" strokeDasharray="3 3" />
          <line x1="8" y1="42" x2="160" y2="42" stroke="currentColor" className="text-brand-600/70 dark:text-brand-400/70" strokeWidth="1.5" />

          {/* 68° Slanted guideline rays */}
          <line x1="32" y1="8" x2="18" y2="44" stroke="currentColor" className="text-brand-400/50 dark:text-brand-600/50" strokeWidth="1.2" strokeDasharray="2 2" />
          <line x1="52" y1="8" x2="38" y2="44" stroke="currentColor" className="text-brand-400/50 dark:text-brand-600/50" strokeWidth="1.2" strokeDasharray="2 2" />

          {/* Slanted cursive letter strokes */}
          <path
            d="M 22 42 C 26 34, 30 14, 32 10 C 30 25, 26 38, 28 42 M 42 42 C 46 34, 50 14, 52 10"
            fill="none"
            stroke="currentColor"
            className="text-brand-700 dark:text-brand-300"
            strokeWidth="2"
            strokeLinecap="round"
          />

          {/* Slant angle degree indicator */}
          <path d="M 22 42 A 10 10 0 0 1 24 34" fill="none" stroke="currentColor" className="text-brand-600 dark:text-brand-400" strokeWidth="1.2" />
          <text x="68" y="23" className="text-[11px] font-sans font-semibold fill-brand-700 dark:fill-brand-300">
            60°–75° Slant
          </text>
          <text x="68" y="37" className="text-[11px] font-sans fill-muted-foreground">
            forward lean
          </text>
        </svg>
      );

    case "baseline_alignment":
    default:
      return (
        <svg
          viewBox="0 0 168 52"
          className="w-full max-w-[178px] h-13 select-none"
          aria-hidden="true"
        >
          {/* 3-line penmanship rule with highlighted baseline */}
          <line x1="8" y1="10" x2="160" y2="10" stroke="currentColor" className="text-border/60" strokeWidth="1" />
          <line x1="8" y1="26" x2="160" y2="26" stroke="currentColor" className="text-brand-300/60 dark:text-brand-700/60" strokeWidth="1" strokeDasharray="3 3" />
          <line x1="8" y1="42" x2="160" y2="42" stroke="currentColor" className="text-brand-600 dark:text-brand-400" strokeWidth="2.5" />

          {/* Cursive word resting squarely on baseline */}
          <path
            d="M 16 42 C 20 34, 24 26, 28 26 C 30 26, 32 38, 34 42 C 38 42, 42 26, 46 26 C 48 26, 50 38, 52 42 M 34 42 L 36 42 M 52 42 L 56 42"
            fill="none"
            stroke="currentColor"
            className="text-brand-700 dark:text-brand-300"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Anchored checkmarks on baseline */}
          <circle cx="34" cy="42" r="2" className="fill-brand-600 dark:fill-brand-400" />
          <circle cx="52" cy="42" r="2" className="fill-brand-600 dark:fill-brand-400" />

          <text x="72" y="23" className="text-[11px] font-sans font-semibold fill-brand-700 dark:fill-brand-300">
            Solid baseline
          </text>
          <text x="72" y="37" className="text-[11px] font-sans fill-muted-foreground">
            no floating/sinking
          </text>
        </svg>
      );
  }
}

export function ParentRubricDialog({
  open,
  onOpenChange,
  initialCriterion,
}: ParentRubricDialogProps) {
  const [selectedCriterionOverride, setSelectedCriterionOverride] = useState<
    string | null | undefined
  >(undefined);

  const activeCriterion =
    selectedCriterionOverride !== undefined
      ? selectedCriterionOverride
      : (initialCriterion ?? null);

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setSelectedCriterionOverride(undefined);
    }
    onOpenChange(newOpen);
  };

  useEffect(() => {
    if (open && initialCriterion) {
      const timer = setTimeout(() => {
        const el = document.getElementById(`rubric-criterion-${initialCriterion}`);
        el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, 120);
      return () => clearTimeout(timer);
    }
  }, [open, initialCriterion]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[calc(100%-1.5rem)] max-w-2xl max-h-[min(90dvh,calc(100vh-2rem))] p-0 gap-0 overflow-hidden flex flex-col shadow-warm">
        {/* Header */}
        <DialogHeader className="p-5 sm:p-6 pb-4 border-b border-border bg-card/60">
          <div className="flex items-start gap-3 mb-1 pr-6">
            <div className="flex size-9 items-center justify-center rounded-lg bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300 shrink-0 mt-0.5">
              <BookOpen className="size-4.5" aria-hidden="true" />
            </div>
            <div className="space-y-0.5 min-w-0">
              <DialogTitle className="font-heading text-lg sm:text-xl font-semibold text-foreground">
                Parent Guide to Handwriting Rubrics
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                How WriteWise measures your child&apos;s cursive handwriting development across five essential skills.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* Five Criteria Section */}
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                The 5 Cursive Skills
              </h3>
              {activeCriterion && (
                <button
                  type="button"
                  onClick={() => setSelectedCriterionOverride(null)}
                  className="text-xs text-brand-600 dark:text-brand-400 hover:underline cursor-pointer min-h-[44px] sm:min-h-[36px] px-2.5 sm:px-1.5 -my-1 inline-flex items-center rounded-md focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
                >
                  Show all skills
                </button>
              )}
            </div>
            <div className="grid gap-3">
              {CRITERIA_GUIDE.map((criterion) => {
                const Icon = criterion.icon;
                const isHighlighted = activeCriterion === criterion.key;
                return (
                  <div
                    key={criterion.key}
                    id={`rubric-criterion-${criterion.key}`}
                    className={cn(
                      "p-3.5 sm:p-4 rounded-xl border transition-all space-y-2",
                      isHighlighted
                        ? "border-brand-500 ring-2 ring-brand-500/25 bg-brand-50/40 dark:bg-brand-950/30"
                        : "border-border/80 bg-card/50"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div
                          className={cn(
                            "flex size-7 items-center justify-center rounded-md shrink-0",
                            isHighlighted
                              ? "bg-brand-200 dark:bg-brand-900 text-brand-800 dark:text-brand-200"
                              : "bg-muted text-foreground"
                          )}
                        >
                          <Icon className="size-3.5 text-brand-600 dark:text-brand-400" aria-hidden="true" />
                        </div>
                        <h4 className="text-sm font-semibold text-foreground">
                          {criterion.title}
                        </h4>
                      </div>
                      {isHighlighted && (
                        <span className="text-xs font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-brand-100 dark:bg-brand-900 text-brand-700 dark:text-brand-300">
                          Selected Skill
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-0.5">
                      <p className="text-xs sm:text-sm text-foreground/90 leading-relaxed flex-1">
                        {criterion.summary}
                      </p>
                      <div className="shrink-0 self-center sm:self-auto bg-brand-50/50 dark:bg-brand-950/40 border border-brand-200/50 dark:border-brand-800/50 rounded-lg p-1.5 flex items-center justify-center shadow-2xs">
                        <CursiveCriterionIllustration criterionKey={criterion.key} />
                      </div>
                    </div>
                    <div className="flex items-start gap-1.5 pt-1 text-xs text-muted-foreground bg-muted/30 p-2.5 rounded-lg border border-border/40">
                      <CheckCircle2 className="size-3.5 text-brand-600 dark:text-brand-400 shrink-0 mt-0.5" aria-hidden="true" />
                      <span>
                        <strong className="text-foreground font-medium">Home tip:</strong>{" "}
                        {criterion.whatToLookFor}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Developmental Bands Section */}
          <div className="space-y-3.5 border-t border-border/60 pt-5">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Developmental Bands
            </h3>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {BANDS_GUIDE.map((b) => (
                <div
                  key={b.band}
                  className="p-3 rounded-xl border border-border/70 bg-card/40 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <BandBadge band={b.band} score={b.score} size="sm" />
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {b.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-border bg-card/60 flex justify-end">
          <Button
            variant="default"
            size="sm"
            className="h-10 sm:h-9 px-4 font-medium cursor-pointer"
            onClick={() => onOpenChange(false)}
          >
            Got it
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
