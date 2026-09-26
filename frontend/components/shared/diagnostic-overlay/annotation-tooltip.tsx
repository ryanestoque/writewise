"use client";

import { memo } from "react";
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
  onDismiss?: () => void;
}

const CRITERION_LABELS: Record<string, string> = {
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
  onDismiss,
}: AnnotationTooltipProps) {
  if (!hover || imageWidth <= 0 || imageHeight <= 0) {
    return null;
  }

  const { title, note, severity, criterion, x, y } = hover;
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
  let cardWidth = 256;

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

    const pixelX = offsetX + (x / imageWidth) * renderedW;
    const pixelY = offsetY + (y / imageHeight) * renderedH;

    // Target annotation point in visible viewport coordinates
    // Account for zoom center-scaling and pan offset
    const targetViewportX =
      viewportW / 2 + panOffset.x + (pixelX - containerW / 2) * effectiveZoom;
    const targetViewportY =
      viewportH / 2 + panOffset.y + (pixelY - containerH / 2) * effectiveZoom;

    // Fade out cleanly if target stroke has panned outside visible viewport bounds
    isOffscreen =
      targetViewportX < -30 ||
      targetViewportX > viewportW + 30 ||
      targetViewportY < -30 ||
      targetViewportY > viewportH + 30;

    // Fluid card width: dynamically scale down for narrow containers
    const baseCardWidth = viewportW < 640 ? 240 : 256;
    cardWidth = Math.min(baseCardWidth, Math.max(190, viewportW - 24));
    const cardHalfWidth = cardWidth / 2;
    const margin = 12;

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
    // Note: because the card is counter-scaled by scale(1 / effectiveZoom), 1px inside the card
    // directly equals 1px on the screen.
    const deltaViewportX = targetViewportX - clampedViewportX;
    const maxCaretOffset = Math.max(0, cardHalfWidth - 22);
    caretOffset = Math.max(-maxCaretOffset, Math.min(maxCaretOffset, deltaViewportX));

    // Vertical placement: place below if pin is near top or space above is constrained
    const spaceAbove = targetViewportY;
    const spaceBelow = viewportH - targetViewportY;
    if (spaceAbove >= 135) {
      isNearTop = false;
    } else if (spaceBelow >= 135) {
      isNearTop = true;
    } else {
      isNearTop = spaceBelow > spaceAbove;
    }

    leftPos = `${clampedLocalX}px`;
    topPos = `${pixelY}px`;
  } else {
    // Defensive fallback if measurements are somehow not yet settled
    const leftPct = Math.max(15, Math.min(85, (x / imageWidth) * 100));
    const topPct = Math.max(15, Math.min(85, (y / imageHeight) * 100));
    isNearTop = topPct < 30;
    cardWidth = 240;
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
        transform: `translate3d(-50%, ${isNearTop ? "14px" : "calc(-100% - 14px)"}, 0) scale(${counterScale})`,
        transformOrigin: isNearTop ? "top center" : "bottom center",
      }}
    >
      <TooltipCard
        title={title}
        note={note}
        isAttention={isAttention}
        criterion={criterion}
        cardWidth={cardWidth}
        caretOffset={caretOffset}
        isNearTop={isNearTop}
        isPinned={isPinned}
        onDismiss={onDismiss}
      />
    </div>
  );
});

/* -------------------------------------------------------------------------- */
/*  Extracted card UI                                                         */
/* -------------------------------------------------------------------------- */

interface TooltipCardProps {
  title: string;
  note: string;
  isAttention: boolean;
  criterion: string;
  cardWidth: number;
  caretOffset: number;
  isNearTop: boolean;
  isPinned: boolean;
  onDismiss?: () => void;
}

function TooltipCard({
  title,
  note,
  isAttention,
  criterion,
  cardWidth,
  caretOffset,
  isNearTop,
  isPinned,
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
        style={{ maxWidth: `${cardWidth}px`, width: `${cardWidth}px` }}
        className={cn(
          "p-2.5 rounded-xl shadow-warm border backdrop-blur-md transition-colors relative",
          isPinned ? "pointer-events-auto select-text" : "pointer-events-none select-none",
          "bg-popover/95 text-popover-foreground",
          isAttention
            ? "border-destructive/40 dark:border-destructive/50 ring-2 ring-destructive/10"
            : "border-brand-600/40 dark:border-brand-500/50 ring-2 ring-brand-600/10"
        )}
      >
        <div className="flex items-center gap-1.5 mb-1 min-w-0">
          {isAttention ? (
            <AlertCircle
              className="size-3.5 shrink-0 text-destructive dark:text-destructive"
              aria-hidden="true"
            />
          ) : (
            <CheckCircle2
              className="size-3.5 shrink-0 text-brand-600 dark:text-brand-400"
              aria-hidden="true"
            />
          )}
          <span
            className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground min-w-0 flex-1 truncate"
            title={CRITERION_LABELS[criterion] ?? criterion}
          >
            {CRITERION_LABELS[criterion] ?? criterion}
          </span>
          <Badge
            variant={isAttention ? "outline" : "secondary"}
            className={cn(
              "ml-auto text-[11px] px-1.5 py-0 h-4.5 font-medium border shrink-0",
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
              className="relative size-7 min-h-[40px] min-w-[40px] sm:min-h-[28px] sm:min-w-[28px] sm:size-6 rounded-md p-0 flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer pointer-events-auto touch-manipulation shrink-0 ml-1 hover:bg-muted/80 transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 after:absolute after:-inset-1.5 sm:after:hidden after:content-['']"
              aria-label="Dismiss pinned annotation details"
              title="Close annotation details"
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          )}
        </div>

        <p className="text-xs font-semibold leading-snug break-words line-clamp-2">
          {title}
        </p>
        <p className="text-xs text-muted-foreground leading-relaxed mt-1 break-words">
          {note}
        </p>

        {!isPinned && (
          <div className="mt-1.5 pt-1 border-t border-border/40 text-[10px] text-muted-foreground/75 flex items-center justify-between">
            <span>Click to pin details</span>
          </div>
        )}
      </div>
    </>
  );
}
