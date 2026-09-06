"use client";

import { useMemo } from "react";
import type { Submission } from "@/lib/hooks/use-submissions";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  RotateCcw,
  Camera,
  Info,
  SunMedium,
  ScanLine,
} from "lucide-react";

export interface RejectionDetail {
  title: string;
  description: string;
  advice: string;
}

export const DEFAULT_REJECTION_INFO: RejectionDetail = {
  title: "Worksheet Photo Needs Re-capture",
  description:
    "The quality verification check could not extract clear cursive strokes from this image.",
  advice:
    "Retake the worksheet photo flat from directly above under even, bright lighting.",
};

export const REJECTION_GUIDE: Record<string, RejectionDetail> = {
  QUALITY_GATE_BLUR: {
    title: "Blurry or Out-of-Focus Photo",
    description:
      "The photo is too blurry to extract cursive letter strokes and baseline coordinates accurately.",
    advice:
      "Hold the camera steady, tap the screen to focus on the handwriting, and retake in clear light.",
  },
  QUALITY_GATE_BRIGHTNESS: {
    title: "Lighting Too Dark or Overexposed",
    description:
      "Heavy shadows or strong glare obscured the 3-line penmanship ruling and handwriting strokes.",
    advice:
      "Position the worksheet in bright, indirect natural or classroom light without overhead flash glare.",
  },
  QUALITY_GATE_CONTRAST: {
    title: "Low Contrast or Faint Pencil Strokes",
    description:
      "The handwriting strokes were too faint against the paper background for reliable contour analysis.",
    advice:
      "Ensure the student writes with a dark #2 pencil or pen, and adjust lighting to eliminate washed-out areas.",
  },
  QUALITY_GATE_RESOLUTION: {
    title: "Image Resolution Too Low",
    description:
      "The captured photo does not meet the minimum 1500px resolution needed for detailed stroke evaluation.",
    advice:
      "Move the camera closer to fill the frame with the worksheet page before taking the photo.",
  },
  SEGMENTATION_COUNT_MISMATCH: {
    title: "Word Count Mismatch",
    description:
      "The number of cursive words detected on the paper does not match the assigned prompt text.",
    advice:
      "Check that the student wrote the complete sentence without skipping words or adding extra lines.",
  },
  PIPELINE_ERROR: {
    title: "Diagnostic Processing Issue",
    description:
      "An unexpected processing issue occurred while segmenting cursive strokes.",
    advice:
      "Please retake the photo with the worksheet flat and all four corners clearly visible.",
  },
  QUALITY_GATE_LIGHTING: {
    title: "Lighting Too Dark or Glare Present",
    description:
      "Heavy shadows or strong glare obscured the 3-line penmanship guidelines.",
    advice:
      "Position the worksheet in bright, indirect light without direct flash glare.",
  },
  QUALITY_GATE_SKEW: {
    title: "Worksheet Captured at an Angle",
    description:
      "The page was tilted too steeply for automated perspective correction.",
    advice:
      "Hold the camera parallel and directly above the paper for a flat, top-down view.",
  },
  QUALITY_GATE_OCCLUDED: {
    title: "Worksheet Lines or Text Covered",
    description:
      "Fingers, shadows, or folded edges covered the penmanship ruling lines.",
    advice:
      "Ensure all four corners and all written text remain completely unobstructed.",
  },
  QUALITY_GATE_NO_TEXT: {
    title: "No Handwriting Strokes Detected",
    description:
      "The system could not detect student handwriting marks on the ruling lines.",
    advice:
      "Verify the student used a dark pencil or pen and that the writing area is in frame.",
  },
};

export const REJECTION_BADGE_LABELS: Record<string, string> = {
  QUALITY_GATE_BLUR: "Blur Detected",
  QUALITY_GATE_BRIGHTNESS: "Lighting / Glare",
  QUALITY_GATE_CONTRAST: "Low Contrast",
  QUALITY_GATE_RESOLUTION: "Low Resolution",
  SEGMENTATION_COUNT_MISMATCH: "Word Count Mismatch",
  PIPELINE_ERROR: "Processing Issue",
  QUALITY_GATE_LIGHTING: "Lighting / Glare",
  QUALITY_GATE_SKEW: "Tilted Angle",
  QUALITY_GATE_OCCLUDED: "Guidelines Covered",
  QUALITY_GATE_NO_TEXT: "No Handwriting Found",
};

export interface SubmissionRejectionCardProps {
  submission: Submission;
  onReupload: () => void;
}

export function SubmissionRejectionCard({
  submission,
  onReupload,
}: SubmissionRejectionCardProps) {
  const rejectionInfo = useMemo(() => {
    const baseInfo = submission.rejection_code
      ? REJECTION_GUIDE[submission.rejection_code] ?? {
          title: "Worksheet Photo Needs Re-capture",
          description: `The quality verification check encountered an issue (${submission.rejection_code.replace(/_/g, " ").toLowerCase()}).`,
          advice:
            "Please verify that the worksheet is flat, well-lit, in focus, and written with a clear pen or pencil.",
        }
      : DEFAULT_REJECTION_INFO;

    const isParentUpload = submission.uploader_role === "parent";
    const actionLabel = isParentUpload
      ? "Parent Upload Follow-up"
      : "Teacher Action";
    const actionAdvice = isParentUpload
      ? `This worksheet was uploaded by the student's parent. ${baseInfo.advice} You can take a new photo in class now or advise the parent to re-scan.`
      : baseInfo.advice;

    const badgeLabel = submission.rejection_code
      ? REJECTION_BADGE_LABELS[submission.rejection_code] ?? "Needs Re-scan"
      : "Needs Re-scan";

    return {
      ...baseInfo,
      actionLabel,
      actionAdvice,
      badgeLabel,
    };
  }, [submission.rejection_code, submission.uploader_role]);

  return (
    <div className="space-y-3.5">
      <Alert
        variant="destructive"
        role="region"
        aria-labelledby="rejection-heading"
        className="rounded-xl sm:rounded-2xl border-destructive/25 bg-destructive/10 p-4 sm:p-5 shadow-xs space-y-3 block [&_svg]:translate-y-0"
      >
        <div className="flex items-start gap-2.5 min-w-0">
          <AlertCircle
            className="size-4.5 text-destructive shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <AlertTitle className="font-heading text-sm sm:text-base font-semibold text-destructive tracking-tight leading-snug">
              <h3
                id="rejection-heading"
                className="text-balance break-words font-inherit"
              >
                {rejectionInfo.title}
              </h3>
            </AlertTitle>
          </div>
        </div>

        <AlertDescription className="!text-foreground/90 text-xs sm:text-sm leading-relaxed font-sans">
          {rejectionInfo.description}
        </AlertDescription>

        <div className="rounded-lg sm:rounded-xl bg-background/95 dark:bg-card/90 border border-destructive/20 p-3 space-y-1.5 shadow-2xs">
          <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <RotateCcw
              className="size-3.5 !text-brand-600 dark:!text-brand-400 shrink-0"
              aria-hidden="true"
            />
            {rejectionInfo.actionLabel}
          </span>
          <p
            id="rejection-advice"
            className="text-xs text-foreground/80 leading-relaxed"
          >
            {rejectionInfo.actionAdvice}
          </p>
        </div>

        <Button
          type="button"
          onClick={onReupload}
          aria-describedby="rejection-advice"
          aria-label={`Take and re-upload new worksheet photo for ${submission.student?.full_name ?? "student"}`}
          className="w-full min-h-11 bg-primary hover:bg-brand-700 text-primary-foreground dark:hover:bg-brand-200 dark:hover:text-brand-950 text-xs sm:text-sm font-semibold rounded-xl gap-2 shadow-xs cursor-pointer touch-manipulation transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Camera className="size-4" aria-hidden="true" />
          Take & Re-upload New Photo
        </Button>
      </Alert>

      {/* Photo Quality Guidelines for Reliable Scoring */}
      <div className="p-3.5 sm:p-4 rounded-xl border border-border/80 bg-muted/30 dark:bg-muted/15 space-y-3">
        <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <Info
            className="size-3.5 text-brand-600 dark:text-brand-400 shrink-0"
            aria-hidden="true"
          />
          Photo Quality Guidelines for Reliable Scoring
        </h4>
        <ul className="space-y-2.5 text-xs text-muted-foreground">
          <li className="flex items-start gap-2.5">
            <div className="size-6 rounded-md bg-brand-100 dark:bg-brand-950/80 text-brand-700 dark:text-brand-300 flex items-center justify-center shrink-0 mt-0.5 border border-brand-200/50 dark:border-brand-900/50">
              <SunMedium className="size-3.5" aria-hidden="true" />
            </div>
            <span className="leading-relaxed">
              <strong className="text-foreground font-medium">
                Bright, Indirect Lighting:
              </strong>{" "}
              Avoid heavy phone shadows and direct overhead fluorescent glare on
              the paper.
            </span>
          </li>
          <li className="flex items-start gap-2.5">
            <div className="size-6 rounded-md bg-brand-100 dark:bg-brand-950/80 text-brand-700 dark:text-brand-300 flex items-center justify-center shrink-0 mt-0.5 border border-brand-200/50 dark:border-brand-900/50">
              <ScanLine className="size-3.5" aria-hidden="true" />
            </div>
            <span className="leading-relaxed">
              <strong className="text-foreground font-medium">
                Flat Top-Down Framing:
              </strong>{" "}
              Hold the camera parallel directly above the page so 3-line
              penmanship ruling remains straight.
            </span>
          </li>
          <li className="flex items-start gap-2.5">
            <div className="size-6 rounded-md bg-brand-100 dark:bg-brand-950/80 text-brand-700 dark:text-brand-300 flex items-center justify-center shrink-0 mt-0.5 border border-brand-200/50 dark:border-brand-900/50">
              <Camera className="size-3.5" aria-hidden="true" />
            </div>
            <span className="leading-relaxed">
              <strong className="text-foreground font-medium">
                Tap to Focus:
              </strong>{" "}
              Ensure pencil strokes and midlines are crisp and sharp before
              pressing capture.
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}
