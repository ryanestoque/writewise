"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  Camera,
  RotateCcw,
  SunMedium,
  Focus,
  Maximize2,
  FileQuestion,
  Eye,
  X,
  Lightbulb,
} from "lucide-react";

export interface QualityErrorDetails {
  measured_value?: number;
  threshold?: number;
  detected_words?: number;
  expected_words?: number;
  submission_id?: string;
  [key: string]: unknown;
}

export interface QualityError {
  code: string;
  message?: string;
  details?: QualityErrorDetails;
}

export interface QualityErrorCardProps {
  error: QualityError;
  previewUrl?: string | null;
  retryRef?: React.Ref<HTMLButtonElement>;
  onRetake: () => void;
  onReview?: () => void;
  onRetry?: () => void;
}

interface ErrorPresentation {
  isQualityCheck: boolean;
  badgeLabel: string;
  title: string;
  description: string;
  tips: string[];
  icon: typeof AlertCircle;
}

export function isQualityGateErrorCode(code: string): boolean {
  return [
    "QUALITY_GATE_RESOLUTION",
    "QUALITY_GATE_BLUR",
    "QUALITY_GATE_BRIGHTNESS",
    "QUALITY_GATE_CONTRAST",
    "SEGMENTATION_COUNT_MISMATCH",
    "QUALITY_GATE_LIGHTING",
    "QUALITY_GATE_SKEW",
    "QUALITY_GATE_OCCLUDED",
    "QUALITY_GATE_NO_TEXT",
    "UNSUPPORTED_FILE_TYPE",
    "FILE_TOO_LARGE",
  ].includes(code);
}

function resolveErrorPresentation(error: QualityError): ErrorPresentation {
  const { code, details } = error;
  const isQuality = isQualityGateErrorCode(code);

  switch (code) {
    case "QUALITY_GATE_BRIGHTNESS": {
      const threshold = typeof details?.threshold === "number" ? details.threshold : null;
      const measured = typeof details?.measured_value === "number" ? details.measured_value : null;

      if ((threshold !== null && threshold <= 50) || (measured !== null && measured < 50)) {
        return {
          isQualityCheck: true,
          badgeLabel: "Lighting Too Dark",
          title: "Lighting Is Too Dim",
          description:
            "The photo doesn't have enough light to clearly distinguish handwriting strokes from the paper.",
          tips: [
            "Turn on room lighting or move closer to an open window.",
            "Hold your phone steady so the camera sensor can take in more light.",
            "Avoid shadows cast by your body or hands over the writing lines.",
          ],
          icon: SunMedium,
        };
      }

      if ((threshold !== null && threshold >= 200) || (measured !== null && measured > 200)) {
        return {
          isQualityCheck: true,
          badgeLabel: "Harsh Glare / Overexposed",
          title: "Washed Out by Glare",
          description:
            "Direct lighting or flash glare washed out the page, obscuring the pencil marks and guidelines.",
          tips: [
            "Turn off the camera flash to eliminate bright white reflections.",
            "Angle your phone slightly to avoid direct ceiling lights bouncing off the paper.",
            "Move away from harsh direct desk lamps.",
          ],
          icon: SunMedium,
        };
      }

      return {
        isQualityCheck: true,
        badgeLabel: "Lighting Issue",
        title: "Lighting Needs Adjustment",
        description:
          "Heavy shadows or strong glare obscured the cursive strokes and penmanship ruling.",
        tips: [
          "Retake in bright, diffused lighting without harsh direct reflections.",
          "Keep the camera steady and parallel to the worksheet.",
        ],
        icon: SunMedium,
      };
    }

    case "QUALITY_GATE_CONTRAST": {
      return {
        isQualityCheck: true,
        badgeLabel: "Faint Pencil Strokes",
        title: "Pencil Strokes Too Faint",
        description:
          "The pencil marks blend into the paper background, making it hard to trace continuous cursive strokes.",
        tips: [
          "Angle the light source across the paper to cast subtle shadows in the pencil grooves.",
          "Check if table or window glare is reflecting off the shiny graphite.",
          "If the writing is very light, have the student trace firmly with a #2 or 2B pencil.",
        ],
        icon: SunMedium,
      };
    }

    case "QUALITY_GATE_BLUR": {
      return {
        isQualityCheck: true,
        badgeLabel: "Motion Blur",
        title: "Photo Is Blurry or Unfocused",
        description:
          "Camera movement or slight defocus softened the stroke edges needed for geometric evaluation.",
        tips: [
          "Rest your elbows or arms on the table to keep the camera completely steady.",
          "Tap the handwriting on your screen to lock sharp focus before shooting.",
          "Ensure adequate room light so your camera uses a fast shutter speed.",
        ],
        icon: Focus,
      };
    }

    case "QUALITY_GATE_RESOLUTION": {
      return {
        isQualityCheck: true,
        badgeLabel: "Low Resolution",
        title: "Photo Needs More Detail",
        description:
          "The captured image does not meet the minimum resolution needed to measure letter formations accurately.",
        tips: [
          "Move closer so the handwriting worksheet fills most of your phone screen.",
          "Avoid cropping low-res screenshots or images compressed by chat apps.",
          "Use your default camera app in standard photo mode.",
        ],
        icon: Maximize2,
      };
    }

    case "SEGMENTATION_COUNT_MISMATCH": {
      const detected = details?.detected_words;
      const expected = details?.expected_words;
      const hasCounts = typeof detected === "number" && typeof expected === "number";

      return {
        isQualityCheck: true,
        badgeLabel: "Word Count Mismatch",
        title: hasCounts
          ? `Detected ${detected} of ${expected} Words`
          : "Word Count Mismatch",
        description: hasCounts
          ? `The system detected ${detected} words, but the assigned sentence requires ${expected} words.`
          : "The handwritten words on the page couldn't be matched to the assigned sentence prompt.",
        tips: [
          "Ensure the full written sentence is in frame and no words are cut off at the margins.",
          "Check that the student wrote the complete sentence without skipping words.",
          "Keep the page clean of stray doodles, erased marks, or extra notes.",
        ],
        icon: FileQuestion,
      };
    }

    case "QUALITY_GATE_SKEW": {
      return {
        isQualityCheck: true,
        badgeLabel: "Tilted Angle",
        title: "Worksheet Captured at an Angle",
        description: "The page was tilted too steeply for automated line deskewing.",
        tips: [
          "Place the paper flat on a table.",
          "Hold the phone directly above the paper, parallel to the surface.",
        ],
        icon: Maximize2,
      };
    }

    case "UNSUPPORTED_FILE_TYPE": {
      return {
        isQualityCheck: false,
        badgeLabel: "Invalid File",
        title: "Unsupported Image Format",
        description: "The selected file is not a supported image format. Please choose a JPEG or PNG photo.",
        tips: ["Only .jpg, .jpeg, and .png images are accepted."],
        icon: AlertCircle,
      };
    }

    case "FILE_TOO_LARGE": {
      return {
        isQualityCheck: false,
        badgeLabel: "File Too Large",
        title: "Photo Exceeds 15 MB",
        description: "The selected photo file is too large for upload processing.",
        tips: ["Please choose or capture a photo smaller than 15 MB."],
        icon: AlertCircle,
      };
    }

    case "UNAUTHORIZED": {
      return {
        isQualityCheck: false,
        badgeLabel: "Session Expired",
        title: "Session Expired",
        description: "Your session has expired. Please sign in again to continue.",
        tips: ["Refresh your browser or log back in."],
        icon: AlertCircle,
      };
    }

    case "FORBIDDEN": {
      return {
        isQualityCheck: false,
        badgeLabel: "Access Denied",
        title: "Permission Denied",
        description: "You do not have permission to submit worksheets for this class or activity.",
        tips: ["Ensure you are logged into the correct teacher or parent account."],
        icon: AlertCircle,
      };
    }

    case "MODEL_INFERENCE_ERROR": {
      return {
        isQualityCheck: false,
        badgeLabel: "Assessment Service",
        title: "Scoring Engine Busy",
        description:
          "The cursive scoring engine encountered a temporary issue while evaluating letter formation.",
        tips: ["Please wait a moment and try submitting again."],
        icon: AlertCircle,
      };
    }

    default: {
      return {
        isQualityCheck: isQuality,
        badgeLabel: isQuality ? "Photo Quality Check" : "Upload Failed",
        title: isQuality ? "Quality Check Required" : "Submission Failed",
        description:
          error.message ||
          "We could not process this worksheet photo. Please check your connection and try again.",
        tips: [
          "Ensure the worksheet is flat, well-lit, and in focus.",
          "Check your network connection and retry.",
        ],
        icon: AlertCircle,
      };
    }
  }
}

export function QualityErrorCard({
  error,
  previewUrl,
  retryRef,
  onRetake,
  onReview,
  onRetry,
}: QualityErrorCardProps) {
  const [isInspecting, setIsInspecting] = useState(false);
  const presentation = useMemo(() => resolveErrorPresentation(error), [error]);
  const IconComponent = presentation.icon;

  return (
    <div
      role="alert"
      className="flex flex-col gap-3.5 p-3.5 sm:p-4 rounded-xl border border-destructive/25 bg-destructive/5 text-foreground animate-in fade-in-50 duration-200"
    >
      {/* Header section with badge & thumbnail */}
      <div className="flex items-start gap-3">
        {/* Compact captured thumbnail if available */}
        {previewUrl ? (
          <div className="relative shrink-0 group">
            <div className="relative w-16 h-20 sm:w-20 sm:h-24 rounded-lg overflow-hidden border border-destructive/30 bg-muted shadow-2xs">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt="Captured worksheet preview"
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => setIsInspecting(true)}
                aria-label="Inspect captured photo"
                className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity cursor-pointer text-white"
              >
                <Eye className="size-4" />
              </button>
            </div>
            <span className="block text-[10px] text-center text-muted-foreground mt-1 font-medium">
              Your photo
            </span>
          </div>
        ) : (
          <div className="size-9 rounded-lg bg-destructive/15 text-destructive flex items-center justify-center shrink-0 mt-0.5 border border-destructive/25">
            <IconComponent className="size-5" aria-hidden="true" />
          </div>
        )}

        {/* Text information */}
        <div className="space-y-1.5 min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge
              variant="outline"
              className="text-[10px] sm:text-xs font-semibold px-2 py-0.5 border-destructive/30 text-destructive bg-destructive/10"
            >
              {presentation.badgeLabel}
            </Badge>
          </div>

          <h4 className="text-sm sm:text-base font-semibold text-foreground tracking-tight leading-snug">
            {presentation.title}
          </h4>

          <p className="text-xs text-muted-foreground leading-relaxed">
            {presentation.description}
          </p>
        </div>
      </div>

      {/* Actionable Tips box */}
      {presentation.tips.length > 0 && (
        <div className="rounded-lg bg-background/80 dark:bg-card/80 border border-destructive/15 p-3 space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Lightbulb className="size-3.5 text-amber-500 shrink-0" aria-hidden="true" />
            <span>How to pass this check:</span>
          </div>
          <ul className="space-y-1 text-xs text-muted-foreground pl-0.5">
            {presentation.tips.map((tip, idx) => (
              <li key={idx} className="flex items-start gap-1.5">
                <span className="text-destructive font-bold select-none">•</span>
                <span className="leading-relaxed">{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2 pt-1 border-t border-destructive/15 justify-end flex-wrap">
        {presentation.isQualityCheck ? (
          <>
            {onReview && (
              <Button
                type="button"
                variant="outline"
                onClick={onReview}
                className="h-9 px-3.5 text-xs sm:text-sm font-medium border-border/80 hover:bg-accent cursor-pointer"
              >
                Back to Review
              </Button>
            )}
            <Button
              ref={retryRef}
              type="button"
              variant="destructive"
              onClick={onRetake}
              className="h-9 px-4 text-xs sm:text-sm font-medium gap-1.5 cursor-pointer shadow-xs"
            >
              <Camera className="size-3.5" aria-hidden="true" />
              Retake Photo
            </Button>
          </>
        ) : (
          <>
            {onReview && (
              <Button
                type="button"
                variant="outline"
                onClick={onReview}
                className="h-9 px-3.5 text-xs sm:text-sm font-medium border-border/80 hover:bg-accent cursor-pointer"
              >
                Back to Review
              </Button>
            )}
            {onRetry ? (
              <Button
                ref={retryRef}
                type="button"
                variant="destructive"
                onClick={onRetry}
                className="h-9 px-3.5 text-xs sm:text-sm font-medium gap-1.5 cursor-pointer"
              >
                <RotateCcw className="size-3.5" aria-hidden="true" />
                Retry Upload
              </Button>
            ) : (
              <Button
                ref={retryRef}
                type="button"
                variant="destructive"
                onClick={onRetake}
                className="h-9 px-4 text-xs sm:text-sm font-medium gap-1.5 cursor-pointer shadow-xs"
              >
                <Camera className="size-3.5" aria-hidden="true" />
                Retake Photo
              </Button>
            )}
          </>
        )}
      </div>

      {/* Inspect photo modal overlay */}
      {isInspecting && previewUrl && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Enlarged captured photo"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex flex-col items-center justify-center p-4 animate-in fade-in-50 duration-150"
          onClick={() => setIsInspecting(false)}
        >
          <div
            className="relative max-w-lg w-full max-h-[85vh] bg-background rounded-xl overflow-hidden shadow-2xl flex flex-col border border-border"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-3 border-b border-border bg-muted/40">
              <span className="text-xs font-semibold text-foreground">
                Captured Worksheet Photo
              </span>
              <button
                type="button"
                onClick={() => setIsInspecting(false)}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
                aria-label="Close enlarged preview"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="p-2 flex items-center justify-center overflow-auto max-h-[70vh] bg-muted/20">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt="Enlarged captured worksheet"
                className="max-h-[65vh] w-auto object-contain rounded-md"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
