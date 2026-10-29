"use client";

import { memo, useEffect, useRef, useState, type RefObject } from "react";
import type { ActiveAnnotationHover } from "./types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { AlertCircle, CheckCircle2, X } from "lucide-react";

interface AnnotationTooltipProps {
  hover: ActiveAnnotationHover | null;
  isPinned?: boolean;
  imageWidth: number;
  imageHeight: number;
  containerWidth?: number;
  containerHeight?: number;
  viewportWidth?: number;
  viewportHeight?: number;
  zoomScale?: number;
  panOffset?: { x: number; y: number };
  /** Whether to show technical measurement footnotes in the card. Defaults to true. */
  showMeasurementDetails?: boolean;
  onDismiss?: () => void;
}

const CRITERION_LABELS: Record<string, string> = {
  baseline_alignment: "Baseline",
  spacing: "Spacing",
  size_consistency: "Size",
  slant: "Slant",
  letter_formation: "Formation",
};

const CRITERION_FULL_LABELS: Record<string, string> = {
  baseline_alignment: "Baseline Alignment",
  spacing: "Spacing",
  size_consistency: "Size Consistency",
  slant: "Slant Angle",
  letter_formation: "Letter Formation",
};

export const AnnotationTooltip = memo(function AnnotationTooltip({
  hover,
  isPinned = false,
  imageWidth,
  imageHeight,
  containerWidth,
  containerHeight,
  viewportWidth,
  viewportHeight,
  zoomScale = 1,
  panOffset = { x: 0, y: 0 },
  showMeasurementDetails = true,
  onDismiss,
}: AnnotationTooltipProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [measuredHeight, setMeasuredHeight] = useState<number>(0);

  useEffect(() => {
    const el = cardRef.current;
    if (!el || !hover) return;

    const updateHeight = () => {
      const h = Math.round(el.offsetHeight);
      if (h > 0) {
        setMeasuredHeight((prev) => (prev === h ? prev : h));
      }
    };

    updateHeight();

    const observer = new ResizeObserver(updateHeight);
    observer.observe(el);
    return () => observer.disconnect();
  }, [hover, isPinned, showMeasurementDetails, containerWidth, viewportWidth]);

  if (!hover || imageWidth <= 0 || imageHeight <= 0) {
    return null;
  }

  const { title, note, severity, criterion, x, y, anchorTopY, anchorBottomY } = hover;
  const isAttention = severity === "needs_attention";
  const effectiveZoom = zoomScale && zoomScale > 0 ? zoomScale : 1;
  const counterScale = 1 / effectiveZoom;

  const resolvedContainerW = containerWidth && containerWidth > 0 ? containerWidth : 0;
  const resolvedContainerH = containerHeight && containerHeight > 0 ? containerHeight : 0;
  const resolvedViewportW =
    (viewportWidth && viewportWidth > 0 ? viewportWidth : resolvedContainerW) || 320;
  const resolvedViewportH =
    (viewportHeight && viewportHeight > 0 ? viewportHeight : resolvedContainerH) || 400;

  let leftPos: string;
  let topPos: string;
  let isNearTop = false;
  let caretOffset = 0;
  let isOffscreen = false;
  let cardWidth = 236;

  if (resolvedContainerW > 0 && resolvedContainerH > 0) {
    const containerW = resolvedContainerW;
    const containerH = resolvedContainerH;
    const viewportW = resolvedViewportW;
    const viewportH = resolvedViewportH;

    // Calculate exact rendered image box inside object-contain
    const containerRatio = containerW / containerH;
    const imgRatio = imageWidth / imageHeight;

    let renderedW = containerW;
    let renderedH = containerH;
    let offsetX = 0;
    let offsetY = 0;

    if (containerRatio > imgRatio) {
      // Container is wider than image -> pillarbox (left/right margins)
      renderedW = containerH * imgRatio;
      offsetX = (containerW - renderedW) / 2;
    } else {
      // Container is taller than image -> letterbox (top/bottom margins)
      renderedH = containerW / imgRatio;
      offsetY = (containerH - renderedH) / 2;
    }

    const topAnchor = anchorTopY ?? y;
    const bottomAnchor = anchorBottomY ?? y;

    const pixelX = offsetX + (x / imageWidth) * renderedW;
    const pixelTopY = offsetY + (topAnchor / imageHeight) * renderedH;
    const pixelBottomY = offsetY + (bottomAnchor / imageHeight) * renderedH;
    const pixelCenterY = (pixelTopY + pixelBottomY) / 2;

    // Target annotation points in visible viewport coordinates
    // Account for zoom center-scaling and pan offset
    const targetViewportX =
      viewportW / 2 + panOffset.x + (pixelX - containerW / 2) * effectiveZoom;
    const targetTopViewportY =
      viewportH / 2 + panOffset.y + (pixelTopY - containerH / 2) * effectiveZoom;
    const targetBottomViewportY =
      viewportH / 2 + panOffset.y + (pixelBottomY - containerH / 2) * effectiveZoom;
    const targetCenterViewportY =
      viewportH / 2 + panOffset.y + (pixelCenterY - containerH / 2) * effectiveZoom;

    // Fade out cleanly if target stroke has panned outside visible viewport bounds
    isOffscreen =
      targetViewportX < -30 ||
      targetViewportX > viewportW + 30 ||
      targetCenterViewportY < -30 ||
      targetCenterViewportY > viewportH + 30;

    // Fluid card width: dynamically scale down for compact mobile containers so it never overflows
    const isCompactViewport = viewportW < 440 || viewportH < 300;
    const isNarrowOrShort = viewportW < 640 || viewportH < 340;
    const margin = isCompactViewport ? 6 : isNarrowOrShort ? 8 : 12;
    const maxAvailableWidth = Math.max(168, viewportW - margin * 2);

    cardWidth = isCompactViewport
      ? Math.min(232, maxAvailableWidth)
      : isNarrowOrShort
        ? Math.min(256, maxAvailableWidth)
        : Math.min(280, maxAvailableWidth);

    const cardHalfWidth = cardWidth / 2;

    // Clamp tooltip center horizontally within the visible viewport bounds
    const minCenterX = cardHalfWidth + margin;
    const maxCenterX = viewportW - cardHalfWidth - margin;

    let clampedViewportX: number;
    if (minCenterX <= maxCenterX) {
      clampedViewportX = Math.max(minCenterX, Math.min(maxCenterX, targetViewportX));
    } else {
      clampedViewportX = viewportW / 2;
    }

    // Invert the clamped viewport center back into local coordinates of the transformed container
    const clampedLocalX =
      containerW / 2 + (clampedViewportX - viewportW / 2 - panOffset.x) / effectiveZoom;

    // Caret offset: visual horizontal distance from card center to the pin
    // Because the card is counter-scaled by scale(1 / effectiveZoom), 1px inside the card
    // directly equals 1px on the screen.
    const deltaViewportX = targetViewportX - clampedViewportX;
    const maxCaretOffset = Math.max(0, cardHalfWidth - 16);
    caretOffset = Math.max(-maxCaretOffset, Math.min(maxCaretOffset, deltaViewportX));

    // Vertical placement: evaluate available clearance above top of word and below bottom of word
    const vGap = isCompactViewport ? 6 : isNarrowOrShort ? 8 : 10;
    const vMargin = isCompactViewport ? 6 : 8;
    const fallbackHeight = isCompactViewport ? 84 : isNarrowOrShort ? 96 : 114;
    const effectiveCardHeight =
      measuredHeight > 0 ? measuredHeight : fallbackHeight;

    const spaceAbove = targetTopViewportY - vMargin;
    const spaceBelow = viewportH - targetBottomViewportY - vMargin;

    if (spaceBelow >= effectiveCardHeight + vGap && spaceAbove < effectiveCardHeight + vGap) {
      isNearTop = true;
    } else if (spaceAbove >= effectiveCardHeight + vGap && spaceBelow < effectiveCardHeight + vGap) {
      isNearTop = false;
    } else {
      isNearTop = spaceBelow >= spaceAbove;
    }

    let clampedViewportY: number;
    if (isNearTop) {
      // Tooltip is placed below target word/mark (caret at top pointing up to targetBottomViewportY).
      const desiredTop = targetBottomViewportY + vGap;
      const maxTop = Math.max(vMargin, viewportH - effectiveCardHeight - vMargin);
      clampedViewportY = Math.max(vMargin, Math.min(desiredTop, maxTop));
    } else {
      // Tooltip is placed above target word/mark (caret at bottom pointing down to targetTopViewportY).
      const desiredBottom = targetTopViewportY - vGap;
      const minBottom = Math.min(viewportH - vMargin, effectiveCardHeight + vMargin);
      clampedViewportY = Math.min(viewportH - vMargin, Math.max(minBottom, desiredBottom));
    }

    const clampedLocalY =
      containerH / 2 + (clampedViewportY - viewportH / 2 - panOffset.y) / effectiveZoom;

    leftPos = `${clampedLocalX}px`;
    topPos = `${clampedLocalY}px`;
  } else {
    // Defensive fallback if measurements are somehow not yet settled
    const leftPct = Math.max(25, Math.min(75, (x / imageWidth) * 100));
    const topAnchor = anchorTopY ?? y;
    const bottomAnchor = anchorBottomY ?? y;
    const midPct = (((topAnchor + bottomAnchor) / 2) / imageHeight) * 100;
    isNearTop = midPct < 48;
    const targetYPct = isNearTop
      ? (bottomAnchor / imageHeight) * 100 + 2
      : (topAnchor / imageHeight) * 100 - 2;
    const topPct = Math.max(12, Math.min(88, targetYPct));
    cardWidth = 224;
    leftPos = `${leftPct}%`;
    topPos = `${topPct}%`;
    caretOffset = 0;
  }

  return (
    <div
      role="region"
      aria-label="Diagnostic annotation details"
      aria-live="polite"
      aria-atomic="true"
      id="diagnostic-annotation-tooltip"
      className={cn(
        "absolute pointer-events-none z-30 transition-opacity duration-150 motion-reduce:transition-none",
        isOffscreen && "opacity-0 invisible"
      )}
      style={{
        left: leftPos,
        top: topPos,
        transform: `translate3d(-50%, ${isNearTop ? "0" : "-100%"}, 0) scale(${counterScale})`,
        transformOrigin: isNearTop
          ? `calc(50% + ${caretOffset}px) top`
          : `calc(50% + ${caretOffset}px) bottom`,
      }}
    >
      <TooltipCard
        cardRef={cardRef}
        title={title}
        note={note}
        isAttention={isAttention}
        criterion={criterion}
        cardWidth={cardWidth}
        caretOffset={caretOffset}
        isNearTop={isNearTop}
        isPinned={isPinned}
        showMeasurementDetails={showMeasurementDetails}
        onDismiss={onDismiss}
      />
    </div>
  );
});

/* -------------------------------------------------------------------------- */
/*  Extracted card UI                                                         */
/* -------------------------------------------------------------------------- */

interface TooltipCardProps {
  cardRef?: RefObject<HTMLDivElement | null>;
  title: string;
  note: string;
  isAttention: boolean;
  criterion: string;
  cardWidth: number;
  caretOffset: number;
  isNearTop: boolean;
  isPinned: boolean;
  showMeasurementDetails?: boolean;
  onDismiss?: () => void;
}

function TooltipCard({
  cardRef,
  title,
  note,
  isAttention,
  criterion,
  cardWidth,
  caretOffset,
  isNearTop,
  isPinned,
  showMeasurementDetails = true,
  onDismiss,
}: TooltipCardProps) {
  return (
    <>
      {/* Directional Caret Stem pointing to the active stroke coordinate */}
      <div
        className="absolute pointer-events-none -translate-x-1/2 z-40"
        style={{
          left: `calc(50% + ${caretOffset}px)`,
          ...(isNearTop ? { top: "-6px" } : { bottom: "-6px" }),
        }}
      >
        <svg
          width="14"
          height="7"
          viewBox="0 0 14 7"
          className="block overflow-visible"
        >
          <path
            d={isNearTop ? "M0 7 L7 0 L14 7" : "M0 0 L7 7 L14 0"}
            fill="currentColor"
            className={cn(
              "text-popover/95",
              isAttention
                ? "stroke-destructive/40 dark:stroke-destructive/50"
                : "stroke-brand-600/40 dark:stroke-brand-500/50"
            )}
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      <div
        ref={cardRef}
        style={{ maxWidth: `${cardWidth}px`, width: `${cardWidth}px` }}
        className={cn(
          "p-2 sm:p-3 rounded-xl shadow-warm border backdrop-blur-md transition-colors relative",
          isPinned ? "pointer-events-auto select-text" : "pointer-events-none select-none",
          "bg-popover/95 text-popover-foreground",
          isAttention
            ? "border-destructive/40 dark:border-destructive/50 ring-2 ring-destructive/10"
            : "border-brand-600/40 dark:border-brand-500/50 ring-2 ring-brand-600/10"
        )}
      >
        <div className="flex items-center gap-1 sm:gap-2 mb-1 sm:mb-1.5 min-w-0">
          {isAttention ? (
            <AlertCircle
              className="size-3.5 sm:size-4 shrink-0 text-destructive dark:text-destructive"
              aria-hidden="true"
            />
          ) : (
            <CheckCircle2
              className="size-3.5 sm:size-4 shrink-0 text-brand-600 dark:text-brand-400"
              aria-hidden="true"
            />
          )}
          <span
            className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground min-w-0 truncate"
            title={CRITERION_FULL_LABELS[criterion] ?? criterion}
          >
            {CRITERION_LABELS[criterion] ?? criterion}
          </span>
          <Badge
            variant={isAttention ? "outline" : "secondary"}
            className={cn(
              "ml-auto text-[10px] sm:text-xs px-1.5 py-0 sm:py-0.5 h-auto font-medium border shrink-0 whitespace-nowrap",
              isAttention
                ? "border-destructive/30 text-destructive dark:text-destructive bg-destructive/10 dark:bg-destructive/20"
                : "border-brand-300 dark:border-brand-800 text-brand-800 dark:text-brand-300 bg-brand-50/90 dark:bg-brand-950/60"
            )}
          >
            {isAttention ? "Needs Attention" : "Consistent"}
          </Badge>
          {isPinned && onDismiss && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDismiss();
              }}
              className="relative !size-5 sm:!size-6 !min-h-0 !min-w-0 rounded-md p-0 flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer pointer-events-auto touch-manipulation shrink-0 ml-0.5 hover:bg-muted/80 transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 after:absolute after:-inset-2 after:content-['']"
              aria-label="Dismiss pinned annotation details"
              title="Close annotation details"
            >
              <X className="size-3 sm:size-3.5" aria-hidden="true" />
            </button>
          )}
        </div>

        <p className="text-[11.5px] sm:text-[13px] font-semibold leading-tight sm:leading-snug break-words line-clamp-1 sm:line-clamp-2">
          {title}
        </p>
        <p className="text-[11px] sm:text-xs text-muted-foreground leading-snug sm:leading-relaxed mt-0.5 sm:mt-1 break-words line-clamp-2 sm:line-clamp-none">
          {note}
        </p>

        {criterion === "letter_formation" && isAttention && showMeasurementDetails && (
          <p className="text-[10px] sm:text-[11px] font-medium text-destructive dark:text-rose-400 mt-1 sm:mt-1.5 hidden sm:flex items-center gap-1.5">
            <span className="inline-block size-1.5 rounded-full bg-destructive animate-pulse shrink-0" />
            <span>Highlighted zones show stroke irregularities flagged by the CNN.</span>
          </p>
        )}

        {criterion === "spacing" && showMeasurementDetails && (
          <p className="text-[10px] sm:text-[11px] font-medium text-muted-foreground mt-1 sm:mt-1.5 hidden sm:flex items-center gap-1.5">
            <span className="inline-block size-1.5 rounded-full bg-violet-500 shrink-0" />
            <span>Measured relative to midline ruling (x-height). Normal range: 1.2× – 3.0×.</span>
          </p>
        )}

        {!isPinned && (
          <div className="mt-1 pt-0.5 sm:mt-1.5 sm:pt-1 border-t border-border/40 text-[9px] sm:text-[10px] text-muted-foreground/75 hidden sm:flex items-center justify-between">
            <span>Click to pin details</span>
          </div>
        )}
      </div>
    </>
  );
}
