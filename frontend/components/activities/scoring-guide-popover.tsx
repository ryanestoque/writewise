"use client";

import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { HelpCircle, BookOpen } from "lucide-react";

/**
 * Diagnostic Rubric Guide Popover
 * Scaffolding for teachers to understand WriteWise composite cursive scoring
 */
export function ScoringGuidePopover() {
  return (
    <Popover>
      <PopoverTrigger className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] text-xs font-medium rounded-lg border border-border bg-background text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-all cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring shrink-0">
        <BookOpen className="size-3.5 text-brand-600 dark:text-brand-400 shrink-0" aria-hidden="true" />
        <span>Rubric Guide</span>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 sm:w-96 p-4 z-50">
        <PopoverHeader className="pb-2">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-lg bg-brand-50 dark:bg-brand-950 flex items-center justify-center text-brand-600 dark:text-brand-400 shrink-0 border border-brand-200/50 dark:border-brand-900/50">
              <HelpCircle className="size-4" aria-hidden="true" />
            </div>
            <div>
              <PopoverTitle className="text-sm font-semibold text-foreground">
                Cursive Diagnostic Criteria
              </PopoverTitle>
              <PopoverDescription className="text-xs text-muted-foreground">
                Composite evaluation across 5 foundational penmanship markers:
              </PopoverDescription>
            </div>
          </div>
        </PopoverHeader>

        <div className="space-y-3 text-xs pt-2.5 border-t border-border/60">
          <div className="flex items-start gap-2.5">
            <div className="size-2 rounded-full bg-brand-500 mt-1 shrink-0" aria-hidden="true" />
            <div>
              <strong className="font-semibold text-foreground">
                1. Letter Formation:
              </strong>{" "}
              <span className="text-muted-foreground">
                Proper cursive letter shapes, smooth continuous strokes, and well-rounded connector loops.
              </span>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <div className="size-2 rounded-full bg-brand-500 mt-1 shrink-0" aria-hidden="true" />
            <div>
              <strong className="font-semibold text-foreground">
                2. Size Consistency:
              </strong>{" "}
              <span className="text-muted-foreground">
                Uniform proportions between tall ascender letters, lowercase middle letters, and descending tail strokes.
              </span>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <div className="size-2 rounded-full bg-brand-500 mt-1 shrink-0" aria-hidden="true" />
            <div>
              <strong className="font-semibold text-foreground">
                3. Spacing:
              </strong>{" "}
              <span className="text-muted-foreground">
                Even spacing between joined letters and clear, comfortable separation between words.
              </span>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <div className="size-2 rounded-full bg-brand-500 mt-1 shrink-0" aria-hidden="true" />
            <div>
              <strong className="font-semibold text-foreground">
                4. Slant Angle:
              </strong>{" "}
              <span className="text-muted-foreground">
                Natural, consistent forward letter tilt across each word line.
              </span>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <div className="size-2 rounded-full bg-brand-500 mt-1 shrink-0" aria-hidden="true" />
            <div>
              <strong className="font-semibold text-foreground">
                5. Baseline Alignment:
              </strong>{" "}
              <span className="text-muted-foreground">
                How smoothly words rest along the bottom ruling guide without sagging or floating.
              </span>
            </div>
          </div>
        </div>

        <div className="mt-3 pt-2.5 border-t border-border/60 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Non-punitive 4-band scoring</span>
          <span className="font-medium text-foreground">Needs Improvement → Excellent</span>
        </div>
      </PopoverContent>
    </Popover>
  );
}
