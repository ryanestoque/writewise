"use client";

import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { HelpCircle } from "lucide-react";

/**
 * Diagnostic Rubric Guide Popover
 * Scaffolding for teachers to understand WriteWise composite scoring
 */
export function ScoringGuidePopover() {
  return (
    <Popover>
      <PopoverTrigger className="inline-flex items-center gap-1.5 px-3 py-2 sm:py-1.5 min-h-[40px] sm:min-h-[36px] text-xs font-medium rounded-lg border border-border bg-background text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-all cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring shrink-0">
        <HelpCircle className="size-3.5 text-brand-600 dark:text-brand-400 shrink-0" />
        <span className="inline">Rubric Guide</span>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 sm:w-96 p-4 z-50">
        <PopoverHeader>
          <div className="flex items-center gap-2">
            <div className="size-7 rounded-lg bg-brand-50 dark:bg-brand-950 flex items-center justify-center text-brand-600 dark:text-brand-400">
              <HelpCircle className="size-4" />
            </div>
            <div>
              <PopoverTitle className="text-sm font-semibold text-foreground">
                Cursive Diagnostic Criteria
              </PopoverTitle>
              <PopoverDescription className="text-[11px]">
                Composite score (0–100%) weighted across 5 penmanship markers:
              </PopoverDescription>
            </div>
          </div>
        </PopoverHeader>

        <div className="space-y-2.5 text-xs pt-2 border-t border-border/60">
          <div className="flex items-start gap-2">
            <div className="size-1.5 rounded-full bg-brand-500 mt-1.5 shrink-0" />
            <div>
              <strong className="font-semibold text-foreground">
                1. Letter Formation:
              </strong>{" "}
              <span className="text-muted-foreground">
                Stroke & loop curvature fidelity evaluated by CNN.
              </span>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <div className="size-1.5 rounded-full bg-brand-500 mt-1.5 shrink-0" />
            <div>
              <strong className="font-semibold text-foreground">
                2. Size Consistency:
              </strong>{" "}
              <span className="text-muted-foreground">
                Ascenders, descenders, and x-height proportion uniformity.
              </span>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <div className="size-1.5 rounded-full bg-brand-500 mt-1.5 shrink-0" />
            <div>
              <strong className="font-semibold text-foreground">
                3. Spacing:
              </strong>{" "}
              <span className="text-muted-foreground">
                Rhythmic distance between letters and word boundaries.
              </span>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <div className="size-1.5 rounded-full bg-brand-500 mt-1.5 shrink-0" />
            <div>
              <strong className="font-semibold text-foreground">
                4. Slant Angle:
              </strong>{" "}
              <span className="text-muted-foreground">
                Parallel letter stroke tilt relative to penmanship standard.
              </span>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <div className="size-1.5 rounded-full bg-brand-500 mt-1.5 shrink-0" />
            <div>
              <strong className="font-semibold text-foreground">
                5. Baseline Alignment:
              </strong>{" "}
              <span className="text-muted-foreground">
                Deviation of word baseline from bottom ruling line.
              </span>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
