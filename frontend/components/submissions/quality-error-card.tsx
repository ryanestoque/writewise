"use client";

import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  Camera,
  RotateCcw,
  SunMedium,
  Focus,
  Maximize2,
  FileQuestion,
  Eye,
  Lightbulb,
  ChevronDown,
  ChevronUp,
  ImageOff,
  Contrast,
  ZoomIn,
  ZoomOut,
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
  onRetake: (tipInfo?: { tip: string; badgeLabel?: string }) => void;
  onReview?: () => void;
  reviewLabel?: string;
  onRetry?: () => void;
  retryLabel?: string;
}

interface ErrorPresentation {
  isQualityCheck: boolean;
  badgeLabel?: string;
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
    "QUALITY_GATE_LIGHTING",
    "QUALITY_GATE_SKEW",
    "QUALITY_GATE_OCCLUDED",
    "QUALITY_GATE_NO_TEXT",
    "SEGMENTATION_COUNT_MISMATCH",
  ].includes(code);
}

function resolveErrorPresentation(error: QualityError): ErrorPresentation {
  const { code, details } = error;
  const isQuality = isQualityGateErrorCode(code);

  switch (code) {
    case "QUALITY_GATE_LIGHTING":
    case "QUALITY_GATE_BRIGHTNESS": {
      const threshold = typeof details?.threshold === "number" ? details.threshold : null;
      const measured = typeof details?.measured_value === "number" ? details.measured_value : null;

      if ((threshold !== null && threshold <= 50) || (measured !== null && measured < 50)) {
        return {
          isQualityCheck: true,
          badgeLabel: "Lighting",
          title: "Lighting Is Too Dim",
          description:
            "The photo doesn't have enough light to clearly distinguish cursive pencil strokes from the page ruling.",
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
          badgeLabel: "Glare",
          title: "Worksheet Washed Out by Glare",
          description:
            "Direct overhead lighting or flash glare washed out the page, obscuring the pencil marks and guidelines.",
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
        badgeLabel: "Lighting",
        title: "Lighting Needs a Quick Adjustment",
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
        badgeLabel: "Contrast",
        title: "Pencil Strokes Too Faint",
        description:
          "The pencil marks blend into the paper background, making it hard to trace continuous cursive strokes.",
        tips: [
          "Angle the light source across the paper to cast subtle shadows in the pencil grooves.",
          "Check if table or window glare is reflecting off the shiny graphite.",
          "If the writing is very light, have the student trace firmly with a #2 or 2B pencil.",
        ],
        icon: Contrast,
      };
    }

    case "QUALITY_GATE_BLUR": {
      return {
        isQualityCheck: true,
        badgeLabel: "Sharpness",
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
        badgeLabel: "Framing",
        title: "Move Closer for More Detail",
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
        badgeLabel: "Word Count",
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
        badgeLabel: "Angle",
        title: "Worksheet Captured at an Angle",
        description: "The page was tilted too steeply for automated line deskewing.",
        tips: [
          "Place the paper flat on a table.",
          "Hold the phone directly above the paper, parallel to the surface.",
        ],
        icon: Maximize2,
      };
    }

    case "QUALITY_GATE_OCCLUDED": {
      return {
        isQualityCheck: true,
        badgeLabel: "Coverage",
        title: "Worksheet Partially Covered",
        description: "Part of the writing area or page margin appears obscured or cut off.",
        tips: [
          "Keep hands, fingers, and pencils outside the written sentence area.",
          "Make sure no stray papers or books are covering the worksheet edges.",
        ],
        icon: Maximize2,
      };
    }

    case "QUALITY_GATE_NO_TEXT": {
      return {
        isQualityCheck: true,
        badgeLabel: "Handwriting",
        title: "No Handwriting Detected",
        description: "The page was clear, but no handwritten cursive strokes were found in the guideline zone.",
        tips: [
          "Make sure the student has written on the worksheet before scanning.",
          "Frame the camera directly on the completed guideline rows.",
        ],
        icon: FileQuestion,
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
        badgeLabel: isQuality ? "Quality Check" : "Upload Failed",
        title: isQuality ? "Photo Check Needed" : "Submission Failed",
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
  reviewLabel,
  onRetry,
  retryLabel,
}: QualityErrorCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isInspecting, setIsInspecting] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [showAllTips, setShowAllTips] = useState(false);
  const [showTechDetails, setShowTechDetails] = useState(false);

  // Inspection modal magnification & pan states
  const [zoomScale, setZoomScale] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const panStartRef = useRef({ x: 0, y: 0 });
  const pinchStartDistRef = useRef<number | null>(null);
  const pinchStartScaleRef = useRef(1);

  const resetZoomAndPan = useCallback(() => {
    setZoomScale(1);
    setPanOffset({ x: 0, y: 0 });
    setIsDragging(false);
  }, []);

  const openInspectionModal = useCallback(() => {
    resetZoomAndPan();
    setIsInspecting(true);
  }, [resetZoomAndPan]);

  const closeInspectionModal = useCallback(() => {
    resetZoomAndPan();
    setIsInspecting(false);
  }, [resetZoomAndPan]);

  const handleZoomIn = useCallback(() => {
    setZoomScale((prev) => Math.min(3, +(prev + 0.5).toFixed(1)));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoomScale((prev) => {
      const next = Math.max(1, +(prev - 0.5).toFixed(1));
      if (next === 1) setPanOffset({ x: 0, y: 0 });
      return next;
    });
  }, []);

  const handleResetZoom = useCallback(() => {
    setZoomScale(1);
    setPanOffset({ x: 0, y: 0 });
  }, []);

  const handleToggleZoom = useCallback(() => {
    setZoomScale((prev) => {
      if (prev > 1) {
        setPanOffset({ x: 0, y: 0 });
        return 1;
      }
      return 2;
    });
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoomScale <= 1) return;
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    panStartRef.current = { ...panOffset };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || zoomScale <= 1) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    const maxPan = 180 * (zoomScale - 1);
    setPanOffset({
      x: Math.max(-maxPan, Math.min(maxPan, panStartRef.current.x + dx)),
      y: Math.max(-maxPan, Math.min(maxPan, panStartRef.current.y + dy)),
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      pinchStartDistRef.current = dist;
      pinchStartScaleRef.current = zoomScale;
    } else if (e.touches.length === 1 && zoomScale > 1) {
      setIsDragging(true);
      dragStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      panStartRef.current = { ...panOffset };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchStartDistRef.current !== null) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const ratio = dist / pinchStartDistRef.current;
      const nextScale = Math.min(3, Math.max(1, +(pinchStartScaleRef.current * ratio).toFixed(2)));
      setZoomScale(nextScale);
      if (nextScale === 1) setPanOffset({ x: 0, y: 0 });
    } else if (e.touches.length === 1 && isDragging && zoomScale > 1) {
      const dx = e.touches[0].clientX - dragStartRef.current.x;
      const dy = e.touches[0].clientY - dragStartRef.current.y;
      const maxPan = 180 * (zoomScale - 1);
      setPanOffset({
        x: Math.max(-maxPan, Math.min(maxPan, panStartRef.current.x + dx)),
        y: Math.max(-maxPan, Math.min(maxPan, panStartRef.current.y + dy)),
      });
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    pinchStartDistRef.current = null;
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.deltaY < 0) {
      setZoomScale((prev) => Math.min(3, +(prev + 0.25).toFixed(2)));
    } else if (e.deltaY > 0) {
      setZoomScale((prev) => {
        const next = Math.max(1, +(prev - 0.25).toFixed(2));
        if (next === 1) setPanOffset({ x: 0, y: 0 });
        return next;
      });
    }
  };

  const presentation = useMemo(() => resolveErrorPresentation(error), [error]);
  const IconComponent = presentation.icon;

  const hasTechnicalDetails =
    typeof error.details?.measured_value === "number" ||
    typeof error.details?.threshold === "number" ||
    typeof error.details?.detected_words === "number" ||
    typeof error.details?.expected_words === "number" ||
    Boolean(error.details?.submission_id);

  const visibleTips =
    showAllTips || presentation.tips.length <= 1
      ? presentation.tips
      : presentation.tips.slice(0, 1);

  const handleRetakeClick = useCallback(() => {
    const topTip = presentation.tips[0];
    onRetake(topTip ? { tip: topTip, badgeLabel: presentation.badgeLabel } : undefined);
  }, [onRetake, presentation.tips, presentation.badgeLabel]);

  // Keyboard shortcut: Press R to retake photo; [+] / [-] / [0] to zoom when inspecting.
  // Complies with WCAG 2.1 SC 2.1.4: ignores modifier keys (prevents hijacking Ctrl+R/Cmd+R)
  // and only triggers when not editing text.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Never intercept browser commands or shortcuts with modifiers (e.g. Ctrl+R reload, Cmd+R, Alt+R)
      if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing) {
        return;
      }

      const target = e.target as HTMLElement | null;
      if (
        target &&
        (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) ||
          target.isContentEditable)
      ) {
        return;
      }

      // Inside inspection modal: allow R to retake, and +/-/0 for zoom controls
      if (isInspecting) {
        if (e.key === "r" || e.key === "R") {
          e.preventDefault();
          closeInspectionModal();
          handleRetakeClick();
          return;
        }
        if (e.key === "+" || e.key === "=") {
          e.preventDefault();
          handleZoomIn();
          return;
        }
        if (e.key === "-" || e.key === "_") {
          e.preventDefault();
          handleZoomOut();
          return;
        }
        if (e.key === "0") {
          e.preventDefault();
          handleResetZoom();
          return;
        }
      } else {
        // Scoped execution for card: only fire if focus is within card, or active element is body
        if (e.key === "r" || e.key === "R") {
          if (
            cardRef.current &&
            (cardRef.current.contains(target) || document.activeElement === document.body)
          ) {
            e.preventDefault();
            handleRetakeClick();
          }
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleRetakeClick, isInspecting, handleZoomIn, handleZoomOut, handleResetZoom, closeInspectionModal]);

  return (
    <div
      ref={cardRef}
      role="region"
      aria-labelledby="quality-error-card-title"
      className={cn(
        "flex flex-col gap-3.5 p-4 rounded-xl border text-foreground animate-in fade-in-50 duration-200 motion-reduce:animate-none shadow-warm-sm",
        presentation.isQualityCheck
          ? "border-warning/35 bg-warning/8 dark:bg-warning/10"
          : "border-destructive/30 bg-destructive/5 dark:bg-destructive/10"
      )}
    >
      {/* Screen-reader polite announcement on error render */}
      <div role="status" aria-live="polite" className="sr-only">
        {presentation.isQualityCheck ? "Quality check warning: " : "Submission error: "}
        {presentation.title}. {presentation.description}
      </div>
      {/* Header section with badge & thumbnail */}
      <div className="flex items-start gap-3">
        {/* Compact captured thumbnail if available */}
        {previewUrl ? (
          <div className="relative shrink-0 flex flex-col items-center">
            <button
              type="button"
              onClick={openInspectionModal}
              aria-label="Enlarge captured worksheet photo to inspect quality"
              className={cn(
                "relative w-20 h-24 sm:w-20 sm:h-26 rounded-lg overflow-hidden bg-muted shadow-2xs group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 text-left border transition-all",
                presentation.isQualityCheck
                  ? "border-warning/40 hover:border-warning/60 focus-visible:ring-warning"
                  : "border-destructive/30 hover:border-destructive/50 focus-visible:ring-destructive"
              )}
            >
              {imageError ? (
                <div className="w-full h-full flex flex-col items-center justify-center bg-muted text-muted-foreground p-1 text-center">
                  <ImageOff className="size-4 mb-0.5" aria-hidden="true" />
                  <span className="text-[10px] leading-tight font-medium">No preview</span>
                </div>
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={previewUrl}
                  alt="Captured worksheet preview thumbnail"
                  onError={() => setImageError(true)}
                  className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                />
              )}
              {/* Floating zoom indicator - non-obstructive corner pill */}
              <div className="absolute bottom-1 right-1 bg-black/70 backdrop-blur-xs text-white text-[10px] font-medium py-0.5 px-1.5 rounded flex items-center gap-1 transition-all group-hover:bg-black/85 group-hover:scale-105 shadow-2xs">
                <Eye className="size-3 shrink-0" aria-hidden="true" />
                <span>Zoom</span>
              </div>
            </button>
            <span className="block text-xs text-center text-muted-foreground mt-1 font-medium">
              Your photo
            </span>
          </div>
        ) : (
          <div
            className={cn(
              "size-10 rounded-lg flex items-center justify-center shrink-0 mt-0.5 border",
              presentation.isQualityCheck
                ? "bg-warning/15 text-warning-foreground border-warning/30"
                : "bg-destructive/15 text-destructive border-destructive/25"
            )}
          >
            <IconComponent className="size-5" aria-hidden="true" />
          </div>
        )}

        {/* Text information */}
        <div className="space-y-1.5 min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h4
              id="quality-error-card-title"
              className="text-sm sm:text-base font-semibold text-foreground tracking-tight leading-snug"
            >
              {presentation.title}
            </h4>
            {presentation.badgeLabel && (
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium border",
                  presentation.isQualityCheck
                    ? "bg-warning/15 text-warning-foreground border-warning/30"
                    : "bg-destructive/15 text-destructive border-destructive/25"
                )}
              >
                <span
                  className={cn(
                    "size-1.5 rounded-full shrink-0",
                    presentation.isQualityCheck ? "bg-warning" : "bg-destructive"
                  )}
                  aria-hidden="true"
                />
                {presentation.badgeLabel}
              </span>
            )}
          </div>

          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            {presentation.description}
          </p>

          {/* Technical diagnostic disclosure (for teachers & calibration) */}
          {hasTechnicalDetails && (
            <div className="pt-0.5">
              <button
                type="button"
                onClick={() => setShowTechDetails((prev) => !prev)}
                className="inline-flex items-center gap-1.5 py-1.5 px-2 -ml-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-md min-h-[38px] sm:min-h-0"
                aria-expanded={showTechDetails}
                aria-controls="technical-diagnostic-details"
              >
                <span>{showTechDetails ? "Hide advanced details" : "Show advanced details"}</span>
                {showTechDetails ? (
                  <ChevronUp className="size-3.5" aria-hidden="true" />
                ) : (
                  <ChevronDown className="size-3.5" aria-hidden="true" />
                )}
              </button>
              {showTechDetails && (
                <div
                  id="technical-diagnostic-details"
                  className="mt-1.5 p-2.5 rounded-lg bg-muted/60 text-[11px] font-mono text-muted-foreground space-y-1"
                >
                  {typeof error.details?.measured_value === "number" && (
                    <div className="flex justify-between items-center gap-2">
                      <span className="font-sans">Measured:</span>
                      <span className="font-semibold text-foreground tabular-nums">
                        {Number(error.details.measured_value).toFixed(1)}
                      </span>
                    </div>
                  )}
                  {typeof error.details?.threshold === "number" && (
                    <div className="flex justify-between items-center gap-2">
                      <span className="font-sans">Threshold:</span>
                      <span className="font-semibold text-foreground tabular-nums">
                        {Number(error.details.threshold).toFixed(1)}
                      </span>
                    </div>
                  )}
                  {typeof error.details?.detected_words === "number" && (
                    <div className="flex justify-between items-center gap-2">
                      <span className="font-sans">Detected Words:</span>
                      <span className="font-semibold text-foreground tabular-nums">
                        {error.details.detected_words}
                      </span>
                    </div>
                  )}
                  {typeof error.details?.expected_words === "number" && (
                    <div className="flex justify-between items-center gap-2">
                      <span className="font-sans">Expected Words:</span>
                      <span className="font-semibold text-foreground tabular-nums">
                        {error.details.expected_words}
                      </span>
                    </div>
                  )}
                  {typeof error.details?.submission_id === "string" && (
                    <div className="flex justify-between items-center gap-2">
                      <span className="font-sans">Submission:</span>
                      <span className="truncate max-w-[160px] select-all">
                        {error.details.submission_id}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Actionable Tips box - flattened integrated callout without nested card border */}
      {presentation.tips.length > 0 && (
        <div
          className={cn(
            "rounded-lg p-3 sm:p-3.5 space-y-2 border-0",
            presentation.isQualityCheck
              ? "bg-warning/10 dark:bg-warning/15"
              : "bg-destructive/10 dark:bg-destructive/15"
          )}
        >
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Lightbulb
              className={cn(
                "size-4 shrink-0",
                presentation.isQualityCheck
                  ? "text-warning-foreground dark:text-warning"
                  : "text-destructive"
              )}
              aria-hidden="true"
            />
            <span>
              {presentation.isQualityCheck ? "Tips for a clear scan:" : "Suggested steps:"}
            </span>
          </div>
          <ul
            id="remediation-tips-list"
            role="list"
            className="space-y-1.5 text-xs text-muted-foreground pl-0.5"
          >
            {visibleTips.map((tip, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span
                  className={cn(
                    "font-bold select-none text-xs leading-relaxed",
                    presentation.isQualityCheck
                      ? "text-warning-foreground dark:text-warning"
                      : "text-destructive"
                  )}
                  aria-hidden="true"
                >
                  •
                </span>
                <span className="leading-relaxed">{tip}</span>
              </li>
            ))}
          </ul>
          {presentation.tips.length > 1 && (
            <div className="pt-0.5 flex justify-center">
              <button
                type="button"
                onClick={() => setShowAllTips((prev) => !prev)}
                className="inline-flex items-center justify-center gap-1.5 py-1.5 px-3 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-md min-h-[38px] sm:min-h-0"
                aria-expanded={showAllTips}
                aria-controls="remediation-tips-list"
              >
                <span>
                  {showAllTips
                    ? "Show fewer tips"
                    : `+${presentation.tips.length - 1} more tips`}
                </span>
                {showAllTips ? (
                  <ChevronUp className="size-3.5" aria-hidden="true" />
                ) : (
                  <ChevronDown className="size-3.5" aria-hidden="true" />
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Action buttons - natural DOM and visual hierarchy across viewports */}
      <div
        className={cn(
          "flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-3 border-t sm:justify-end",
          presentation.isQualityCheck ? "border-warning/20" : "border-destructive/20"
        )}
      >
        {presentation.isQualityCheck ? (
          <>
            {onReview && (
              <Button
                type="button"
                variant="outline"
                onClick={onReview}
                className="w-full sm:w-auto h-10 sm:h-9 px-3.5 text-xs sm:text-sm font-medium border-border hover:bg-accent cursor-pointer"
              >
                {reviewLabel ?? "Back to Review"}
              </Button>
            )}
            <Button
              ref={retryRef}
              type="button"
              onClick={handleRetakeClick}
              title="Retake photo (or press R)"
              className="w-full sm:w-auto h-10 sm:h-9 px-4 text-xs sm:text-sm font-medium gap-2 cursor-pointer shadow-warm-sm"
            >
              <Camera className="size-4" aria-hidden="true" />
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
                className="w-full sm:w-auto h-10 sm:h-9 px-3.5 text-xs sm:text-sm font-medium border-border hover:bg-accent cursor-pointer"
              >
                {reviewLabel ?? "Back to Review"}
              </Button>
            )}
            {onRetry ? (
              <Button
                ref={retryRef}
                type="button"
                onClick={onRetry}
                className="w-full sm:w-auto h-10 sm:h-9 px-4 text-xs sm:text-sm font-medium gap-2 cursor-pointer shadow-warm-sm"
              >
                <RotateCcw className="size-4" aria-hidden="true" />
                {retryLabel ?? "Retry Upload"}
              </Button>
            ) : (
              <Button
                ref={retryRef}
                type="button"
                onClick={handleRetakeClick}
                title="Retake photo (or press R)"
                className="w-full sm:w-auto h-10 sm:h-9 px-4 text-xs sm:text-sm font-medium gap-2 cursor-pointer shadow-warm-sm"
              >
                <Camera className="size-4" aria-hidden="true" />
                Retake Photo
              </Button>
            )}
          </>
        )}
      </div>

      {/* Inspect photo modal with interactive zoom, pan, and direct remediation */}
      {previewUrl && (
        <Dialog
          open={isInspecting}
          onOpenChange={(open) => {
            if (!open) resetZoomAndPan();
            setIsInspecting(open);
          }}
        >
          <DialogContent
            showCloseButton
            className="w-[calc(100%-1.5rem)] max-w-3xl sm:max-w-3xl p-0 gap-0 overflow-hidden border border-border shadow-warm-lg"
          >
            {/* Modal Header: Title and Zoom Toolbar */}
            <DialogHeader className="p-3 sm:p-3.5 border-b border-border bg-muted/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <DialogTitle className="text-sm sm:text-base font-semibold text-foreground">
                  Captured Worksheet Photo
                </DialogTitle>
              </div>
              <DialogDescription className="sr-only">
                Inspect captured cursive worksheet photo for quality verification, stroke clarity, and paper alignment
              </DialogDescription>

              {/* Zoom & Inspection Controls */}
              {!imageError && (
                <div className="flex items-center gap-1 sm:self-center pr-6 sm:pr-8">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleZoomOut}
                    disabled={zoomScale <= 1}
                    aria-label="Zoom out photo"
                    className="h-7 w-7 p-0 cursor-pointer text-muted-foreground hover:text-foreground"
                  >
                    <ZoomOut className="size-3.5" aria-hidden="true" />
                  </Button>

                  <span
                    aria-live="polite"
                    className="text-xs font-mono font-medium text-muted-foreground w-12 text-center select-none"
                  >
                    {Math.round(zoomScale * 100)}%
                  </span>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleZoomIn}
                    disabled={zoomScale >= 3}
                    aria-label="Zoom in photo"
                    className="h-7 w-7 p-0 cursor-pointer text-muted-foreground hover:text-foreground"
                  >
                    <ZoomIn className="size-3.5" aria-hidden="true" />
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleResetZoom}
                    disabled={zoomScale === 1 && panOffset.x === 0 && panOffset.y === 0}
                    aria-label="Reset zoom to fit"
                    className="h-7 px-2 text-[11px] font-medium cursor-pointer text-muted-foreground hover:text-foreground"
                  >
                    <RotateCcw className="size-3 mr-1" aria-hidden="true" />
                    Fit
                  </Button>
                </div>
              )}
            </DialogHeader>

            {/* Interactive Image Canvas */}
            <div
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onWheel={handleWheel}
              className={cn(
                "relative h-[52vh] sm:h-[60vh] max-h-[600px] w-full flex items-center justify-center overflow-hidden bg-neutral-900/5 dark:bg-black/40 select-none",
                zoomScale > 1 ? (isDragging ? "cursor-grabbing" : "cursor-grab") : "cursor-zoom-in"
              )}
            >
              {imageError ? (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center text-muted-foreground gap-3">
                  <ImageOff className="size-8 text-muted-foreground/60" aria-hidden="true" />
                  <p className="text-xs">Image preview could not be loaded.</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setImageError(false)}
                    className="h-8 px-3 text-xs gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="size-3.5" aria-hidden="true" />
                    Retry Loading
                  </Button>
                </div>
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={previewUrl}
                  alt="Captured cursive worksheet photo under quality review"
                  draggable={false}
                  onDoubleClick={handleToggleZoom}
                  onError={() => setImageError(true)}
                  style={{
                    transform: `translate3d(${panOffset.x}px, ${panOffset.y}px, 0px) scale(${zoomScale})`,
                    transition: isDragging ? "none" : "transform 150ms ease-out",
                  }}
                  className="max-h-[50vh] sm:max-h-[58vh] w-auto max-w-full object-contain rounded-md shadow-xs select-none touch-none"
                />
              )}

              {/* Floating hint pill when zoomed */}
              {!imageError && (
                <div className="absolute bottom-2 left-2 pointer-events-none bg-black/60 backdrop-blur-xs text-white text-[11px] px-2 py-0.5 rounded-full flex items-center gap-1.5 shadow-2xs">
                  {zoomScale > 1 ? (
                    <span>Drag or swipe to pan details</span>
                  ) : (
                    <span>Double-click or pinch to zoom (max 300%)</span>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer: Targeted Diagnostic Advice & Direct Remediation Action */}
            <DialogFooter className="p-3 sm:p-3.5 border-t border-border bg-background flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2.5">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Lightbulb className="size-3.5 shrink-0 text-amber-500" aria-hidden="true" />
                <span className="line-clamp-1 sm:line-clamp-none">
                  {presentation.tips[0] || "Check lighting, focus, and line clarity"}
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 w-full sm:w-auto">
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeInspectionModal}
                  className="flex-1 sm:flex-initial h-9 px-3.5 text-xs font-medium cursor-pointer"
                >
                  Done
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    closeInspectionModal();
                    handleRetakeClick();
                  }}
                  className="flex-1 sm:flex-initial h-9 px-4 text-xs sm:text-sm font-medium gap-1.5 bg-[#1b6b63] hover:bg-[#145049] text-white shadow-warm-sm cursor-pointer"
                >
                  <Camera className="size-3.5" aria-hidden="true" />
                  Retake Photo
                  <kbd className="hidden sm:inline-block ml-1 px-1.5 py-0.2 rounded bg-white/20 text-[10px] font-sans">
                    R
                  </kbd>
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
