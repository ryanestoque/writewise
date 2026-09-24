"use client";

import { memo } from "react";
import type { ActiveAnnotationHover } from "./types";
import { OVERLAY_COLORS } from "./constants";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { AlertCircle, CheckCircle2, X } from "lucide-react";

interface AnnotationTooltipProps {
  hover: ActiveAnnotationHover | null;
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
  if (!hover || imageWidth <= 0 || imageHeight <= 0) return null;

  const { title, note, severity, criterion, x, y } = hover;
  const isAttention = severity === "needs_attention";
  const effectiveZoom = zoomScale && zoomScale > 0 ? zoomScale : 1;
  const counterScale = 1 / effectiveZoom;

  let leftPos: string;
  let topPos: string;
  let isNearTop = false;
  let caretOffset = 0;
  let isOffscreen = false;

  if (containerWidth && containerHeight && containerWidth > 0 && containerHeight > 0) {
    const containerW = containerWidth;
    const containerH = containerHeight;
    const viewportW = viewportWidth && viewportWidth > 0 ? viewportWidth : containerW;
    const viewportH = viewportHeight && viewportHeight > 0 ? viewportHeight : containerH;

    // Calculate exact rendered image box inside object-contain
    const containerRatio = containerW / containerH;
    const imgRatio = imageWidth / imageHeight;

    let renderedW = containerW;
    let renderedH = containerH;
    let offsetX = 0;
    let offsetY = 0;

    if (containerRatio > imgRatio) {
      // Container is wider -> pillarbox (left/right margins)
      renderedW = containerH * imgRatio;
      offsetX = (containerW - renderedW) / 2;
    } else {
      // Container is taller -> letterbox (top/bottom margins)
      renderedH = containerW / imgRatio;
      offsetY = (containerH - renderedH) / 2;
    }

    const pixelX = offsetX + (x / imageWidth) * renderedW;
    const pixelY = offsetY + (y / imageHeight) * renderedH;

    // Map local pixel coordinates to visible viewport screen coordinates
    // Accounting for center-origin scaling and pan translation
    const targetScreenX = viewportW / 2 + panOffset.x + (pixelX - containerW / 2) * effectiveZoom;
    const targetScreenY = viewportH / 2 + panOffset.y + (pixelY - containerH / 2) * effectiveZoom;

    // Fade out cleanly if target stroke has panned far out of visible viewport
    isOffscreen =
      targetScreenX < -80 ||
      targetScreenX > viewportW + 80 ||
      targetScreenY < -80 ||
      targetScreenY > viewportH + 80;

    // Tooltip physical width on screen: 240px on mobile (<640px) or 256px on sm+, bounded by viewport
    const baseCardWidth = viewportW < 640 ? 240 : 256;
    const cardWidth = Math.min(baseCardWidth, Math.max(180, viewportW - 24));
    const cardHalfWidth = cardWidth / 2;
    const margin = 12;

    // Allowed screen range for the card center to ensure card is 100% within the visible frame
    const minCenterX = cardHalfWidth + margin;
    const maxCenterX = viewportW - cardHalfWidth - margin;

    let clampedCenterX_screen: number;
    if (minCenterX <= maxCenterX) {
      clampedCenterX_screen = Math.max(minCenterX, Math.min(maxCenterX, targetScreenX));
    } else {
      clampedCenterX_screen = viewportW / 2;
    }

    // Invert the clamped screen center back into local coordinates of the transformed container
    const clampedLocalX =
      containerW / 2 + (clampedCenterX_screen - viewportW / 2 - panOffset.x) / effectiveZoom;

    // Pointer caret offset relative to the card's horizontal center
    const deltaScreenX = targetScreenX - clampedCenterX_screen;
    const maxCaretOffset = cardHalfWidth - 20;
    caretOffset = Math.max(-maxCaretOffset, Math.min(maxCaretOffset, deltaScreenX));

    // Vertical placement: Flip below if insufficient headroom above target
    isNearTop = targetScreenY < 140;
    leftPos = `${clampedLocalX}px`;
    topPos = `${pixelY}px`;
  } else {
    // Fallback to percentage offset inside relative container
    const leftPct = Math.max(12, Math.min(88, (x / imageWidth) * 100));
    const topPct = Math.max(12, Math.min(88, (y / imageHeight) * 100));
    isNearTop = topPct < 30;
    leftPos = `${leftPct}%`;
    topPos = `${topPct}%`;
    caretOffset = 0;
  }

  return (
    <div
      role="tooltip"
      id="diagnostic-annotation-tooltip"
      className={cn(
        "absolute pointer-events-none z-30 transition-[opacity,transform] duration-150 motion-reduce:transition-none",
        isOffscreen && "opacity-0 invisible"
      )}
      style={{
        left: leftPos,
        top: topPos,
        transform: `translate3d(-50%, ${isNearTop ? "8px" : "calc(-100% - 8px)"}, 0) scale(${counterScale})`,
        transformOrigin: isNearTop ? "top center" : "bottom center",
      }}
    >
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
              "text-white/95 dark:text-card/95",
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
        className={cn(
          "w-60 sm:w-64 max-w-[calc(100vw-2rem)] p-2.5 rounded-xl shadow-warm border backdrop-blur-md transition-colors select-text pointer-events-auto relative",
          "bg-white/95 dark:bg-card/95 text-foreground",
          isAttention
            ? "border-destructive/40 dark:border-destructive/50 ring-2 ring-destructive/10"
            : "border-brand-600/40 dark:border-brand-500/50 ring-2 ring-brand-600/10"
        )}
      >
        <div className="flex items-center gap-1.5 mb-1">
          {isAttention ? (
            <AlertCircle
              className="size-3.5 shrink-0"
              style={{ color: OVERLAY_COLORS.needs_attention.stroke }}
              aria-hidden="true"
            />
          ) : (
            <CheckCircle2
              className="size-3.5 shrink-0"
              style={{ color: OVERLAY_COLORS.proficient.stroke }}
              aria-hidden="true"
            />
          )}
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {CRITERION_LABELS[criterion] ?? criterion}
          </span>
          <Badge
            variant={isAttention ? "outline" : "secondary"}
            className={cn(
              "ml-auto text-[11px] px-1.5 py-0 h-4.5 font-medium border",
              isAttention
                ? "border-band-1/40 text-band-1-text dark:text-destructive bg-band-1/15 dark:bg-band-1/25"
                : "border-brand-300 dark:border-brand-800 text-brand-800 dark:text-brand-300 bg-brand-50/90 dark:bg-brand-950/60"
            )}
          >
            {isAttention ? "Needs Attention" : "Consistent"}
          </Badge>
          {onDismiss && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDismiss();
              }}
              className="relative size-7 min-h-[40px] min-w-[40px] sm:min-h-[28px] sm:min-w-[28px] sm:size-6 rounded-md p-0 flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer pointer-events-auto touch-manipulation shrink-0 ml-1 hover:bg-muted/80 transition-colors after:absolute after:-inset-1.5 sm:after:hidden after:content-['']"
              aria-label="Dismiss annotation details"
              title="Close annotation details"
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          )}
        </div>

        <p className="text-xs font-semibold leading-snug">{title}</p>
        <p className="text-xs text-muted-foreground leading-relaxed mt-1">{note}</p>
      </div>
    </div>
  );
});
