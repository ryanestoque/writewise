"use client";

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

interface ParentRubricDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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
  { band: "excellent" as const, score: 90, label: "Excellent (75–100%)", desc: "Fluent, highly consistent penmanship meeting grade-level mastery." },
  { band: "satisfactory" as const, score: 65, label: "Satisfactory (50–74%)", desc: "Solid cursive foundation with minor areas for refinement." },
  { band: "developing" as const, score: 38, label: "Developing (25–49%)", desc: "Actively building muscle memory and learning stroke shapes." },
  { band: "needs_improvement" as const, score: 15, label: "Needs Improvement (0–24%)", desc: "Needs guided practice with basic strokes, posture, or pencil grip." },
];

export function ParentRubricDialog({
  open,
  onOpenChange,
}: ParentRubricDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-1.5rem)] max-w-2xl max-h-[min(90dvh,calc(100vh-2rem))] p-0 gap-0 overflow-hidden flex flex-col shadow-warm">
        {/* Header */}
        <DialogHeader className="p-5 sm:p-6 pb-4 border-b border-border bg-card/60">
          <div className="flex items-center gap-2.5 mb-1">
            <div className="flex size-9 items-center justify-center rounded-lg bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300">
              <BookOpen className="size-4.5" />
            </div>
            <div>
              <DialogTitle className="font-heading text-lg sm:text-xl font-semibold text-foreground">
                Parent Guide to Cursive Rubrics
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                How WriteWise measures your child&apos;s penmanship development across five key criteria.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* Five Criteria Section */}
          <div className="space-y-3.5">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              The 5 Cursive Criteria
            </h3>
            <div className="grid gap-3">
              {CRITERIA_GUIDE.map((criterion) => {
                const Icon = criterion.icon;
                return (
                  <div
                    key={criterion.key}
                    className="p-3.5 sm:p-4 rounded-xl border border-border/80 bg-card/50 space-y-2"
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex size-7 items-center justify-center rounded-md bg-muted text-foreground shrink-0">
                        <Icon className="size-3.5 text-brand-600 dark:text-brand-400" />
                      </div>
                      <h4 className="text-sm font-semibold text-foreground">
                        {criterion.title}
                      </h4>
                    </div>
                    <p className="text-xs sm:text-sm text-foreground/90 leading-relaxed">
                      {criterion.summary}
                    </p>
                    <div className="flex items-start gap-1.5 pt-1 text-xs text-muted-foreground bg-muted/30 p-2.5 rounded-lg border border-border/40">
                      <CheckCircle2 className="size-3.5 text-brand-600 dark:text-brand-400 shrink-0 mt-0.5" />
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
            className="h-9 px-4 font-medium"
            onClick={() => onOpenChange(false)}
          >
            Got it
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
