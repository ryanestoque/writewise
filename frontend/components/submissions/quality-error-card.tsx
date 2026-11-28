"use client";

import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ButtonGroup, ButtonGroupText } from "@/components/ui/button-group";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ResponsiveRichOverlay,
  ResponsiveRichOverlayContent,
  ResponsiveRichOverlayDescription,
  ResponsiveRichOverlayFooter,
  ResponsiveRichOverlayHeader,
  ResponsiveRichOverlayTitle,
} from "@/components/shared/responsive-rich-overlay";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
} from "@/components/ui/empty";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Kbd } from "@/components/ui/kbd";
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
  ScanText,
  WifiOff,
  CheckCircle,
} from "lucide-react";

export interface QualityErrorDetails {
  measured_value?: number;
  threshold?: number;
  detected_words?: number;
  expected_words?: number;
  detected_text?: string;
  expected_text?: string;
  similarity?: number;
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
  onRetry?: () => void;
  retryLabel?: string;
  onProceedAnyway?: () => void;
  variant?: "teacher" | "parent";
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
    "QUALITY_GATE_NO_GUIDELINES",
    "QUALITY_GATE_OFF_GUIDELINES",
    "QUALITY_GATE_SCRIPT_NOT_CURSIVE",
    "SEGMENTATION_COUNT_MISMATCH",
    "TARGET_TEXT_MISMATCH",
  ].includes(code);
}

function resolveErrorPresentation(
  error: QualityError,
  variant: "teacher" | "parent" = "teacher"
): ErrorPresentation {
  const { code, details } = error;
  const isQuality = isQualityGateErrorCode(code);
  const isParent = variant === "parent";

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
          description: isParent
            ? "The photo is a bit too dark to see your child's pencil lines clearly on the page."
            : "The photo doesn't have enough light to clearly distinguish cursive pencil strokes from the page ruling.",
          tips: [
            "Turn on room lighting or move closer to an open window.",
            "Hold your phone steady so the camera can take in more light.",
            "Avoid shadows cast by your body or hands over the writing lines.",
          ],
          icon: SunMedium,
        };
      }

      if ((threshold !== null && threshold >= 200) || (measured !== null && measured > 200)) {
        return {
          isQualityCheck: true,
          badgeLabel: "Glare",
          title: isParent ? "Too Much Glare on the Paper" : "Writing Details Are Washed Out",
          description: isParent
            ? "Bright light or flash is washing out the writing on the page, making the letters hard to see."
            : "The bright photo does not show enough writing detail against the paper. Glare or exposure may be reducing visibility.",
          tips: [
            "Turn off the camera flash to avoid bright white glare.",
            "Shift the paper or step slightly aside from direct lights while holding your phone flat above the page.",
            "Move away from harsh direct desk lamps.",
          ],
          icon: SunMedium,
        };
      }

      return {
        isQualityCheck: true,
        badgeLabel: "Lighting",
        title: "Lighting Needs a Quick Adjustment",
        description: isParent
          ? "Strong shadows or glare covered parts of the writing on the page."
          : "Heavy shadows or strong glare obscured the cursive strokes and penmanship ruling.",
        tips: [
          "Retake in bright, even light without shadows or glare.",
          "Hold your phone flat and steady directly above the worksheet.",
        ],
        icon: SunMedium,
      };
    }

    case "QUALITY_GATE_CONTRAST": {
      return {
        isQualityCheck: true,
        badgeLabel: "Contrast",
        title: "Writing Looks Too Faint in This Photo",
        description: isParent
          ? "The pencil or ink looks too light against the paper in this photo."
          : "The photo does not separate the writing clearly enough from the nearby paper background.",
        tips: [
          "Retake in bright, even light with your phone flat above the page.",
          "Check for lamp or window glare reflecting off shiny pencil marks.",
          "Tap the handwriting on your screen to focus and use your normal camera without filters.",
        ],
        icon: Contrast,
      };
    }

    case "QUALITY_GATE_BLUR": {
      return {
        isQualityCheck: true,
        badgeLabel: "Sharpness",
        title: "Photo Is Blurry or Unfocused",
        description: isParent
          ? "The photo came out a bit blurry, so the handwriting lines are hard to read clearly."
          : "Camera movement or slight defocus softened the stroke edges needed for geometric evaluation.",
        tips: [
          "Rest your elbows or arms on the table to keep the phone steady.",
          "Tap the handwriting on your screen to focus before snapping.",
          "Use bright room light so the camera takes a sharper photo.",
        ],
        icon: Focus,
      };
    }

    case "QUALITY_GATE_RESOLUTION": {
      return {
        isQualityCheck: true,
        badgeLabel: "Framing",
        title: "Move Closer for More Detail",
        description: isParent
          ? "The worksheet looks too small or far away in this photo to read each letter clearly."
          : "The captured image does not meet the minimum resolution needed to measure letter formations accurately.",
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
          ? `Found ${detected} of ${expected} Words`
          : "Some Words May Be Missing",
        description: hasCounts
          ? `We spotted ${detected} words, but this practice sentence has ${expected} words.`
          : "The handwritten words on the page couldn't be matched to the assigned practice sentence.",
        tips: [
          "Make sure the full written sentence is inside the photo and nothing is cut off at the edges.",
          "Check that your child wrote the full sentence without skipping any words.",
          "Keep the page clear of stray doodles, heavy erasures, or extra notes.",
        ],
        icon: FileQuestion,
      };
    }

    case "QUALITY_GATE_SKEW": {
      return {
        isQualityCheck: true,
        badgeLabel: "Angle",
        title: "Worksheet Taken at an Angle",
        description: isParent
          ? "The page looks tilted in this photo. Holding your phone flat above the paper helps us read each line."
          : "The page was tilted too steeply for automated line deskewing.",
        tips: [
          "Place the paper flat on a table.",
          "Hold your phone straight above the paper, flat and level with the page.",
        ],
        icon: Maximize2,
      };
    }

    case "QUALITY_GATE_OCCLUDED": {
      return {
        isQualityCheck: true,
        badgeLabel: "Coverage",
        title: "Worksheet Partially Covered",
        description: "Part of the writing area or page edge looks covered or cut off.",
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
        title: "No Handwriting Found",
        description: isParent
          ? "The page looks clear, but we couldn't see handwriting inside the writing lines."
          : "The page was clear, but no handwritten cursive strokes were found in the guideline zone.",
        tips: [
          "Make sure your child has written the sentence on the worksheet before taking the photo.",
          "Point the camera directly at the completed writing lines.",
        ],
        icon: FileQuestion,
      };
    }

    case "QUALITY_GATE_NO_GUIDELINES": {
      return {
        isQualityCheck: true,
        badgeLabel: "Missing Lines",
        title: "No 3-Line Writing Paper Found",
        description: isParent
          ? "WriteWise needs 3-line writing paper (top, middle, and bottom lines) to check letter size and line placement."
          : "WriteWise requires standard 3-line penmanship paper (topline, midline, baseline) to measure letter size consistency and baseline alignment.",
        tips: [
          "Use standard 3-line writing paper with top, middle, and bottom lines.",
          "Avoid blank bond paper, unruled sketchpads, or single-line notebooks.",
          "Make sure the printed writing lines show up clearly in the photo.",
        ],
        icon: FileQuestion,
      };
    }

    case "QUALITY_GATE_OFF_GUIDELINES": {
      return {
        isQualityCheck: true,
        badgeLabel: "Line Placement",
        title: "Writing Outside the Lines",
        description: isParent
          ? "We found handwriting on the page, but it looks written in the margins or outside the 3-line writing space."
          : "Handwriting was detected on the sheet, but it was written in margins or outside the 3-line penmanship ruling.",
        tips: isParent
          ? [
              "Write inside the printed 3-line writing rows rather than in the margins or top space.",
              "Rest small letters on the solid bottom line, with tall letters reaching up to the top line.",
            ]
          : [
              "Write between the printed 3-line guidelines rather than in the margins or header.",
              "Rest lowercase letter bodies on the solid baseline.",
              "Align letters so ascenders touch the topline and descenders extend below the baseline.",
            ],
        icon: FileQuestion,
      };
    }

    case "QUALITY_GATE_SCRIPT_NOT_CURSIVE": {
      return {
        isQualityCheck: true,
        badgeLabel: "Cursive Style",
        title: "Printed Handwriting Detected",
        description: isParent
          ? "This page looks written in print instead of connected cursive. WriteWise checks connected cursive handwriting."
          : "The worksheet appears to be written in printed (manuscript) handwriting. WriteWise specifically evaluates continuous cursive penmanship.",
        tips: [
          "Have your child write the sentence using connected cursive letters.",
          "Check that letters join smoothly inside each word.",
          "Avoid uploading printed or block-letter handwriting.",
        ],
        icon: FileQuestion,
      };
    }

    case "TARGET_TEXT_MISMATCH": {
      const detected = typeof details?.detected_text === "string" ? details.detected_text : null;
      const expected = typeof details?.expected_text === "string" ? details.expected_text : null;

      return {
        isQualityCheck: true,
        badgeLabel: "Sentence Check",
        title: isParent
          ? "Handwriting Doesn't Match This Practice Sentence"
          : "Worksheet Text Doesn't Match Activity Prompt",
        description: isParent
          ? "The handwriting in this photo doesn't seem to match the practice sentence assigned for this worksheet."
          : detected && expected
            ? `The continuous cursive strokes were transcribed, but the content differs from the assigned prompt.`
            : "The transcribed handwriting on the page couldn't be matched to the assigned sentence prompt.",
        tips: [
          "Check that your child wrote the exact practice sentence shown below.",
          "Make sure the photo is sharp and bright so every word is easy to read.",
          "Double-check that you picked the right worksheet before sending.",
        ],
        icon: ScanText,
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
        description: "The selected photo file is too large to send.",
        tips: ["Please choose or take a photo smaller than 15 MB."],
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
        badgeLabel: isParent ? "Try Again" : "Assessment Service",
        title: isParent ? "Please Try Sending Again" : "Scoring Engine Busy",
        description: isParent
          ? "WriteWise is taking a moment to catch up. Please wait a few seconds and try sending your photo again."
          : "The cursive scoring engine encountered a temporary issue while evaluating letter formation.",
        tips: ["Please wait a moment and try submitting again."],
        icon: AlertCircle,
      };
    }

    case "NETWORK_ERROR": {
      return {
        isQualityCheck: false,
        badgeLabel: "Connection",
        title: "Couldn't Reach WriteWise",
        description:
          error.message ||
          "Unable to connect to WriteWise right now. Please check your internet connection and try again.",
        tips: [
          "Check your Wi-Fi or mobile data signal.",
          "Tap 'Retry Upload' below to re-send without losing your photo.",
          "If it still won't send, reload the page and try again.",
        ],
        icon: WifiOff,
      };
    }

    default: {
      return {
        isQualityCheck: isQuality,
        badgeLabel: isQuality ? "Quality Check" : "Upload Failed",
        title: isQuality ? "Photo Check Needed" : "Submission Failed",
        description:
          error.message ||
          (isQuality
            ? "We could not process this worksheet photo. Please retake the photo following the tips below."
            : "An unexpected error occurred during upload. Please check your connection and try again."),
        tips: isQuality
          ? [
              "Ensure the worksheet is flat, well-lit, and in focus.",
              "Hold camera flat directly above the paper.",
            ]
          : [
              "Check your network connection and click 'Retry Upload'.",
              "If the problem persists, try taking a new photo or refreshing.",
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
  onRetry,
  retryLabel,
  onProceedAnyway,
  variant = "teacher",
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
  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const rafIdRef = useRef<number | null>(null);

  const getMaxPan = useCallback((scale: number) => {
    if (scale <= 1) return { x: 0, y: 0 };
    if (imgRef.current && canvasRef.current) {
      const renderedWidth = imgRef.current.offsetWidth * scale;
      const renderedHeight = imgRef.current.offsetHeight * scale;
      const canvasWidth = canvasRef.current.clientWidth;
      const canvasHeight = canvasRef.current.clientHeight;
      const maxPanX = Math.max(60, (renderedWidth - canvasWidth) / 2 + 40);
      const maxPanY = Math.max(60, (renderedHeight - canvasHeight) / 2 + 40);
      return { x: maxPanX, y: maxPanY };
    }
    return { x: 200 * (scale - 1), y: 240 * (scale - 1) };
  }, []);

  const schedulePanUpdate = useCallback((newPan: { x: number; y: number }) => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
    }
    rafIdRef.current = requestAnimationFrame(() => {
      setPanOffset(newPan);
      rafIdRef.current = null;
    });
  }, []);

  const resetZoomAndPan = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
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
    const bounds = getMaxPan(zoomScale);
    schedulePanUpdate({
      x: Math.max(-bounds.x, Math.min(bounds.x, panStartRef.current.x + dx)),
      y: Math.max(-bounds.y, Math.min(bounds.y, panStartRef.current.y + dy)),
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
      const bounds = getMaxPan(zoomScale);
      schedulePanUpdate({
        x: Math.max(-bounds.x, Math.min(bounds.x, panStartRef.current.x + dx)),
        y: Math.max(-bounds.y, Math.min(bounds.y, panStartRef.current.y + dy)),
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

  const presentation = useMemo(() => resolveErrorPresentation(error, variant), [error, variant]);
  const IconComponent = presentation.icon;

  const hasTechnicalDetails =
    typeof error.details?.measured_value === "number" ||
    typeof error.details?.threshold === "number" ||
    typeof error.details?.detected_words === "number" ||
    typeof error.details?.expected_words === "number" ||
    Boolean(error.details?.submission_id);

  const handleRetakeClick = useCallback(() => {
    const topTip = presentation.tips[0];
    onRetake(topTip ? { tip: topTip, badgeLabel: presentation.badgeLabel } : undefined);
  }, [onRetake, presentation.tips, presentation.badgeLabel]);

  // Keyboard shortcut: Press R to retake photo; [+] / [-] / [0] to zoom; Arrow keys to pan when inspecting.
  // Complies with WCAG 2.1 SC 2.1.1 (Keyboard) and SC 2.1.4 (Character Key Shortcuts).
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

      // Inside inspection modal: allow R to retake, +/-/0 for zoom controls, and Arrow keys to pan
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
        if (
          ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key) &&
          zoomScale > 1
        ) {
          e.preventDefault();
          const step = 40;
          const bounds = getMaxPan(zoomScale);
          setPanOffset((prev) => {
            let nextX = prev.x;
            let nextY = prev.y;
            if (e.key === "ArrowUp") nextY = Math.min(bounds.y, prev.y + step);
            if (e.key === "ArrowDown") nextY = Math.max(-bounds.y, prev.y - step);
            if (e.key === "ArrowLeft") nextX = Math.min(bounds.x, prev.x + step);
            if (e.key === "ArrowRight") nextX = Math.max(-bounds.x, prev.x - step);
            return { x: nextX, y: nextY };
          });
          return;
        }
      } else {
        // Scoped execution for card: only fire if focus is within card (WCAG 2.1.4)
        if (e.key === "r" || e.key === "R") {
          if (
            cardRef.current &&
            cardRef.current.contains(target) &&
            document.activeElement !== document.body
          ) {
            e.preventDefault();
            handleRetakeClick();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [
    handleRetakeClick,
    isInspecting,
    zoomScale,
    handleZoomIn,
    handleZoomOut,
    handleResetZoom,
    closeInspectionModal,
    getMaxPan,
  ]);

  return (
    <Card
      ref={cardRef}
      role="region"
      aria-labelledby="quality-error-card-title"
      size="sm"
      className={cn(
        "py-4 text-foreground animate-in fade-in-50 duration-200 motion-reduce:animate-none shadow-warm-sm",
        presentation.isQualityCheck
          ? "border-warning/35 bg-warning/10"
          : "border-destructive/30 bg-destructive/10"
      )}
    >
      <CardContent className="flex flex-col gap-3.5 px-4">
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
              <Button
                type="button"
                variant="ghost"
                onClick={openInspectionModal}
                aria-haspopup="dialog"
                aria-label="Enlarge captured worksheet photo to inspect quality"
                className={cn(
                  "relative w-20 h-24 p-0 rounded-lg overflow-hidden bg-muted shadow-2xs group text-left border transition-all",
                  presentation.isQualityCheck
                    ? "border-warning/40 hover:border-warning/60 focus-visible:ring-warning"
                    : "border-destructive/30 hover:border-destructive/50 focus-visible:ring-destructive"
                )}
              >
                {imageError ? (
                  <div className="size-full flex flex-col items-center justify-center bg-muted text-muted-foreground p-1 text-center">
                    <ImageOff className="size-4 mb-0.5" aria-hidden="true" />
                    <span className="text-xs leading-tight font-medium">No preview</span>
                  </div>
                ) : (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={previewUrl}
                    alt="Captured worksheet preview thumbnail"
                    onError={() => setImageError(true)}
                    className="size-full object-cover transition-transform duration-200 group-hover:scale-105"
                  />
                )}
                {/* Floating zoom indicator - non-obstructive corner pill */}
                <Badge
                  variant="secondary"
                  className="absolute bottom-1 right-1 h-auto bg-foreground/85 backdrop-blur-xs text-background text-xs font-medium py-0.5 px-1.5 rounded shadow-2xs"
                >
                  <Eye data-icon="inline-start" aria-hidden="true" />
                  <span>Zoom</span>
                </Badge>
              </Button>
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
          <div className="flex flex-col gap-1.5 min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3
                id="quality-error-card-title"
                className="text-sm sm:text-base font-semibold text-foreground tracking-tight leading-snug"
              >
                {presentation.title}
              </h3>
              {presentation.badgeLabel && (
                <Badge
                  variant="outline"
                  className={cn(
                    "h-auto gap-1.5 px-2.5 py-0.5 text-xs font-medium",
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
                </Badge>
              )}
            </div>

            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              {presentation.description}
            </p>

            {/* Technical diagnostic disclosure (for teachers & calibration) */}
            {hasTechnicalDetails && variant !== "parent" && (
              <Collapsible
                open={showTechDetails}
                onOpenChange={setShowTechDetails}
                className="pt-0.5"
              >
                <CollapsibleTrigger
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      className="h-auto py-1.5 px-2 -ml-2 text-xs font-medium text-muted-foreground hover:text-foreground rounded-md min-h-[38px] sm:min-h-0"
                      aria-controls="technical-diagnostic-details"
                    />
                  }
                >
                  <span>{showTechDetails ? "Hide advanced details" : "Show advanced details"}</span>
                  {showTechDetails ? (
                    <ChevronUp data-icon="inline-end" aria-hidden="true" />
                  ) : (
                    <ChevronDown data-icon="inline-end" aria-hidden="true" />
                  )}
                </CollapsibleTrigger>
                <CollapsibleContent
                  id="technical-diagnostic-details"
                  className="mt-1.5 p-2.5 rounded-lg bg-muted/60 text-xs font-sans tabular-nums text-muted-foreground flex flex-col gap-1"
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
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
        </div>

        {/* Expected Practice Sentence Callout for Parents on TARGET_TEXT_MISMATCH */}
        {variant === "parent" &&
          error.code === "TARGET_TEXT_MISMATCH" &&
          typeof error.details?.expected_text === "string" &&
          error.details.expected_text.trim().length > 0 && (
            <Card size="sm" className="py-3 sm:py-3.5 border-border/80 shadow-2xs">
              <CardHeader className="px-3 sm:px-3.5">
                <CardTitle as="h4" className="text-xs font-semibold text-muted-foreground">
                  Practice sentence for this worksheet
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 sm:px-3.5">
                <p className="font-sans text-sm text-foreground font-medium italic break-words">
                  &ldquo;{error.details.expected_text}&rdquo;
                </p>
              </CardContent>
            </Card>
          )}

        {/* Recognized Text Comparison Callout (Teacher-only diagnostic comparison) */}
        {variant !== "parent" &&
          (typeof error.details?.detected_text === "string" ||
            typeof error.details?.expected_text === "string") && (
            <Card size="sm" className="gap-2.5 py-3 sm:py-3.5 border-border/80 shadow-2xs">
              <CardHeader className="items-center px-3 sm:px-3.5">
                <CardTitle as="h4" className="text-xs font-semibold text-foreground">
                  Handwriting Recognition Output
                </CardTitle>
                {typeof error.details?.similarity === "number" && (
                  <CardAction>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-xs px-2 py-0.5 font-semibold font-sans tabular-nums",
                        error.details.similarity >= 0.8
                          ? "bg-success/10 text-success border-success/30"
                          : error.details.similarity >= 0.4
                          ? "bg-warning/10 text-warning-foreground dark:text-warning border-warning/30"
                          : "bg-destructive/10 text-destructive border-destructive/30"
                      )}
                    >
                      {Math.round(error.details.similarity * 100)}% Prompt Match
                    </Badge>
                  </CardAction>
                )}
              </CardHeader>

              <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-2 px-3 sm:px-3.5 text-xs">
                {typeof error.details?.detected_text === "string" && (
                  <div className="p-2.5 rounded-lg bg-muted/40 border border-border/60 flex flex-col gap-1">
                    <span className="text-xs uppercase font-bold text-muted-foreground tracking-wider block">
                      Recognized Cursive Text
                    </span>
                    <p className="font-sans text-xs text-foreground font-medium italic break-words">
                      &quot;{error.details.detected_text || "<no text recognized>"}&quot;
                    </p>
                  </div>
                )}
                {typeof error.details?.expected_text === "string" && (
                  <div className="p-2.5 rounded-lg bg-muted/40 border border-border/60 flex flex-col gap-1">
                    <span className="text-xs uppercase font-bold text-muted-foreground tracking-wider block">
                      Assigned Activity Prompt
                    </span>
                    <p className="font-sans text-xs text-foreground font-medium italic break-words">
                      &quot;{error.details.expected_text}&quot;
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

        {/* Actionable Tips box */}
        {presentation.tips.length > 0 && (
          <Alert
            className={cn(
              "rounded-lg p-3 sm:p-3.5 border-0",
              presentation.isQualityCheck ? "bg-warning/10" : "bg-destructive/10"
            )}
          >
            <Lightbulb
              className={cn(
                presentation.isQualityCheck ? "text-warning-foreground" : "text-destructive"
              )}
              aria-hidden="true"
            />
            <AlertTitle className="text-xs font-semibold text-foreground">
              {presentation.isQualityCheck ? "Tips for a clear scan:" : "Suggested steps:"}
            </AlertTitle>
            <AlertDescription className="flex flex-col gap-2 text-xs text-muted-foreground">
              <Collapsible
                open={showAllTips}
                onOpenChange={setShowAllTips}
                className="flex flex-col gap-1.5"
              >
                <ul
                  id="remediation-tips-list"
                  role="list"
                  className="flex flex-col gap-1.5 text-xs text-muted-foreground pl-0.5"
                >
                  <li className="flex items-start gap-2">
                    <span
                      className={cn(
                        "font-bold select-none text-xs leading-relaxed",
                        presentation.isQualityCheck ? "text-warning-foreground" : "text-destructive"
                      )}
                      aria-hidden="true"
                    >
                      •
                    </span>
                    <span className="leading-relaxed">{presentation.tips[0]}</span>
                  </li>
                  {presentation.tips.length > 1 && (
                    <CollapsibleContent className="flex flex-col gap-1.5">
                      {presentation.tips.slice(1).map((tip, idx) => (
                        <li key={idx + 1} className="flex items-start gap-2">
                          <span
                            className={cn(
                              "font-bold select-none text-xs leading-relaxed",
                              presentation.isQualityCheck
                                ? "text-warning-foreground"
                                : "text-destructive"
                            )}
                            aria-hidden="true"
                          >
                            •
                          </span>
                          <span className="leading-relaxed">{tip}</span>
                        </li>
                      ))}
                    </CollapsibleContent>
                  )}
                </ul>
                {presentation.tips.length > 1 && (
                  <div className="pt-0.5 flex justify-center">
                    <CollapsibleTrigger
                      render={
                        <Button
                          type="button"
                          variant="ghost"
                          size="xs"
                          className="h-auto py-1.5 px-3 text-xs font-medium text-muted-foreground hover:text-foreground rounded-md min-h-11 sm:min-h-0"
                          aria-controls="remediation-tips-list"
                        />
                      }
                    >
                      <span>
                        {showAllTips
                          ? "Show fewer tips"
                          : `+${presentation.tips.length - 1} more tips`}
                      </span>
                      {showAllTips ? (
                        <ChevronUp data-icon="inline-end" aria-hidden="true" />
                      ) : (
                        <ChevronDown data-icon="inline-end" aria-hidden="true" />
                      )}
                    </CollapsibleTrigger>
                  </div>
                )}
              </Collapsible>
            </AlertDescription>
          </Alert>
        )}

        <Separator
          className={cn(
            presentation.isQualityCheck ? "bg-warning/20" : "bg-destructive/20"
          )}
        />

        {/* Action buttons - natural DOM and visual hierarchy across viewports */}
        <div className="flex flex-col sm:flex-row-reverse sm:items-center gap-2 sm:justify-start">
          <Button
            ref={retryRef}
            type="button"
            onClick={handleRetakeClick}
            title="Retake photo (or press R)"
            className="w-full sm:w-auto min-h-[44px] sm:min-h-9 h-10 sm:h-9 px-4 text-xs sm:text-sm font-semibold shadow-warm-sm"
          >
            <Camera data-icon="inline-start" aria-hidden="true" />
            Retake Photo
          </Button>

          {variant !== "parent" && error.code === "TARGET_TEXT_MISMATCH" && onProceedAnyway && (
            <Button
              type="button"
              variant="outline"
              onClick={onProceedAnyway}
              className="w-full sm:w-auto min-h-[44px] sm:min-h-9 h-10 sm:h-9 px-4 text-xs sm:text-sm font-medium shadow-warm-sm"
            >
              <CheckCircle data-icon="inline-start" className="text-primary" aria-hidden="true" />
              Proceed Anyway
            </Button>
          )}

          {!presentation.isQualityCheck && error.code !== "TARGET_TEXT_MISMATCH" && onRetry && (
            <Button
              type="button"
              variant="outline"
              onClick={onRetry}
              className="w-full sm:w-auto min-h-[44px] sm:min-h-9 h-10 sm:h-9 px-3.5 text-xs sm:text-sm font-medium shadow-warm-sm"
            >
              <RotateCcw data-icon="inline-start" aria-hidden="true" />
              {retryLabel ?? "Retry Upload"}
            </Button>
          )}
        </div>
      </CardContent>

      {/* Inspect photo modal with interactive zoom, pan, and direct remediation */}
      {previewUrl && (
        <ResponsiveRichOverlay
          open={isInspecting}
          onOpenChange={(open) => {
            if (!open) resetZoomAndPan();
            setIsInspecting(open);
          }}
        >
          <ResponsiveRichOverlayContent
            showCloseButton
            className="w-[calc(100%-1.5rem)] max-w-3xl sm:max-w-3xl p-0 gap-0 overflow-hidden flex flex-col max-h-[min(92dvh,calc(100dvh-2rem))] border border-border shadow-warm"
          >
            {/* Modal Header: Title and Zoom Toolbar */}
            <ResponsiveRichOverlayHeader className="p-3 sm:p-3.5 bg-muted/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 shrink-0">
              <div className="flex items-center gap-2 pr-10 sm:pr-0">
                <ResponsiveRichOverlayTitle className="text-sm sm:text-base font-semibold text-foreground">
                  Captured Worksheet Photo
                </ResponsiveRichOverlayTitle>
              </div>
              <ResponsiveRichOverlayDescription className="sr-only">
                Inspect captured cursive worksheet photo for quality verification, stroke clarity, and paper alignment
              </ResponsiveRichOverlayDescription>

              {/* Zoom & Inspection Controls */}
              {!imageError && (
                <div className="flex items-center gap-1.5 sm:self-center pr-6 sm:pr-8">
                  <ButtonGroup aria-label="Zoom controls">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      onClick={handleZoomOut}
                      disabled={zoomScale <= 1}
                      aria-label="Zoom out photo"
                      className="size-11 sm:size-7 text-muted-foreground hover:text-foreground"
                    >
                      <ZoomOut aria-hidden="true" />
                    </Button>

                    <ButtonGroupText
                      aria-label={`Current zoom level: ${Math.round(zoomScale * 100)} percent`}
                      className="text-xs font-sans tabular-nums font-medium text-muted-foreground w-12 justify-center bg-background select-none px-1"
                    >
                      {Math.round(zoomScale * 100)}%
                    </ButtonGroupText>

                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      onClick={handleZoomIn}
                      disabled={zoomScale >= 3}
                      aria-label="Zoom in photo"
                      className="size-11 sm:size-7 text-muted-foreground hover:text-foreground"
                    >
                      <ZoomIn aria-hidden="true" />
                    </Button>
                  </ButtonGroup>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleResetZoom}
                    disabled={zoomScale === 1 && panOffset.x === 0 && panOffset.y === 0}
                    aria-label="Reset zoom to fit"
                    className="h-11 sm:h-7 px-3 sm:px-2 text-xs font-medium text-muted-foreground hover:text-foreground"
                  >
                    <RotateCcw data-icon="inline-start" aria-hidden="true" />
                    Fit
                  </Button>
                </div>
              )}
            </ResponsiveRichOverlayHeader>
            <Separator />

            {/* Interactive Image Canvas */}
            <div
              ref={canvasRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onWheel={handleWheel}
              tabIndex={0}
              role="region"
              aria-label="Worksheet photo magnification viewport. Use plus or minus to zoom, arrow keys to pan"
              className={cn(
                "relative flex-1 min-h-[220px] max-h-[58dvh] sm:max-h-[60dvh] w-full flex items-center justify-center overflow-hidden bg-muted/30 select-none touch-none outline-none focus-visible:ring-1 focus-visible:ring-ring/30",
                zoomScale > 1 ? (isDragging ? "cursor-grabbing" : "cursor-grab") : "cursor-zoom-in"
              )}
            >
              {imageError ? (
                <Empty className="py-12 px-4 gap-3">
                  <EmptyMedia variant="icon">
                    <ImageOff aria-hidden="true" />
                  </EmptyMedia>
                  <EmptyHeader>
                    <EmptyDescription className="text-xs">
                      Image preview could not be loaded.
                    </EmptyDescription>
                  </EmptyHeader>
                  <EmptyContent>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setImageError(false)}
                      className="h-8 px-3 text-xs"
                    >
                      <RotateCcw data-icon="inline-start" aria-hidden="true" />
                      Retry Loading
                    </Button>
                  </EmptyContent>
                </Empty>
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  ref={imgRef}
                  src={previewUrl}
                  alt="Captured cursive worksheet photo under quality review"
                  draggable={false}
                  decoding="async"
                  onDoubleClick={handleToggleZoom}
                  onError={() => setImageError(true)}
                  style={{
                    transform: `translate3d(${panOffset.x}px, ${panOffset.y}px, 0px) scale(${zoomScale})`,
                    transition: isDragging ? "none" : "transform 150ms ease-out",
                  }}
                  className="max-h-full w-auto max-w-full object-contain rounded-md shadow-xs select-none touch-none motion-reduce:transition-none"
                />
              )}

              {/* Floating hint pill when zoomed */}
              {!imageError && (
                <Badge
                  variant="secondary"
                  className="absolute bottom-2 left-2 pointer-events-none h-auto bg-foreground/80 backdrop-blur-xs text-background text-xs px-2.5 py-1 rounded-full shadow-2xs"
                >
                  {zoomScale > 1 ? (
                    <span>Drag, swipe, or use Arrow keys to pan</span>
                  ) : (
                    <span>Double-click, pinch, or +/- to zoom (max 300%)</span>
                  )}
                </Badge>
              )}
            </div>

            <Separator />

            {/* Modal Footer: Targeted Diagnostic Advice & Direct Remediation Action */}
            <ResponsiveRichOverlayFooter className="p-3 sm:p-3.5 bg-background flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2.5 shrink-0">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Lightbulb className="size-3.5 shrink-0 text-warning" aria-hidden="true" />
                <span className="line-clamp-1 sm:line-clamp-none">
                  {presentation.tips[0] || "Check lighting, focus, and line clarity"}
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 w-full sm:w-auto">
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeInspectionModal}
                  className="flex-1 sm:flex-initial h-10 sm:h-9 px-4 text-xs sm:text-sm font-medium"
                >
                  Done
                </Button>
                <Button
                  type="button"
                  variant="default"
                  onClick={() => {
                    closeInspectionModal();
                    handleRetakeClick();
                  }}
                  className="flex-1 sm:flex-initial h-10 sm:h-9 px-4 text-xs sm:text-sm font-medium shadow-warm-sm"
                >
                  <Camera data-icon="inline-start" aria-hidden="true" />
                  <span>Retake Photo</span>
                  <Kbd
                    aria-hidden="true"
                    className="ml-1 hidden h-auto min-w-0 rounded border border-primary-foreground/30 bg-primary-foreground/10 px-1.5 py-0.5 text-xs font-sans text-primary-foreground sm:inline-flex"
                  >
                    R
                  </Kbd>
                  <span className="sr-only"> (press R)</span>
                </Button>
              </div>
            </ResponsiveRichOverlayFooter>
          </ResponsiveRichOverlayContent>
        </ResponsiveRichOverlay>
      )}
    </Card>
  );
}
