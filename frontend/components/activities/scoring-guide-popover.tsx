"use client";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { HelpCircle, BookOpen } from "lucide-react";

/**
 * Diagnostic Rubric Guide Popover
 * Scaffolding for teachers to understand WriteWise composite cursive scoring
 */
export function ScoringGuidePopover() {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-11 sm:min-h-9 shrink-0 text-xs font-medium text-muted-foreground hover:text-foreground"
          />
        }
      >
        <BookOpen data-icon="inline-start" className="text-primary" aria-hidden="true" />
        <span>Rubric Guide</span>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 sm:w-96 gap-3 p-4">
        <PopoverHeader>
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
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

        <Separator />

        <div className="flex flex-col gap-3 text-xs">
          <div className="flex items-start gap-2.5">
            <div className="mt-1 size-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />
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
            <div className="mt-1 size-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />
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
            <div className="mt-1 size-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />
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
            <div className="mt-1 size-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />
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
            <div className="mt-1 size-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />
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

        <Separator />

        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Non-punitive 4-band scoring</span>
          <span className="font-medium text-foreground">Needs Improvement → Excellent</span>
        </div>
      </PopoverContent>
    </Popover>
  );
}
