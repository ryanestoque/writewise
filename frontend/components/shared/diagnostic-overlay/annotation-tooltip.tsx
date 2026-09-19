"use client";

import { memo } from "react";
import type { ActiveAnnotationHover } from "./types";
import { OVERLAY_COLORS } from "./constants";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { AlertCircle, CheckCircle2 } from "lucide-react";

interface AnnotationTooltipProps {
  hover: ActiveAnnotationHover | null;
  imageWidth: number;
  imageHeight: number;
  containerWidth?: number;
  containerHeight?: number;
  zoomScale?: number;
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
  zoomScale = 1,
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

  if (containerWidth && containerHeight && containerWidth > 0 && containerHeight > 0) {
    // Calculate exact rendered image box inside object-contain
    const containerRatio = containerWidth / containerHeight;
    const imgRatio = imageWidth / imageHeight;

    let renderedW = containerWidth;
    let renderedH = containerHeight;
    let offsetX = 0;
    let offsetY = 0;

    if (containerRatio > imgRatio) {
      // Container is wider -> pillarbox (left/right margins)
      renderedW = containerHeight * imgRatio;
      offsetX = (containerWidth - renderedW) / 2;
    } else {
      // Container is taller -> letterbox (top/bottom margins)
      renderedH = containerWidth / imgRatio;
      offsetY = (containerHeight - renderedH) / 2;
    }

    const pixelX = offsetX + (x / imageWidth) * renderedW;
    const pixelY = offsetY + (y / imageHeight) * renderedH;

    // Tooltip width is 240px on mobile (w-60) and 256px on sm+ (sm:w-64). Clamp within rendered bounds
    const baseHalfWidth = containerWidth < 640 ? 120 : 128;
    const halfWidth = baseHalfWidth * counterScale;
    const imageMinX = offsetX + halfWidth + 8;
    const imageMaxX = offsetX + renderedW - halfWidth - 8;
    const minX = Math.max(halfWidth + 12, imageMinX <= imageMaxX ? imageMinX : containerWidth / 2);
    const maxX = Math.min(containerWidth - halfWidth - 12, imageMinX <= imageMaxX ? imageMaxX : containerWidth / 2);
    const clampedX = Math.max(minX, Math.min(maxX, pixelX));

    isNearTop = pixelY < 125 * counterScale;
    leftPos = `${clampedX}px`;
    topPos = `${pixelY}px`;

    // Horizontal relative offset for the pointer caret, clamped safely inside card's rounded corners
    const rawCaretOffset = (pixelX - clampedX) / counterScale;
    caretOffset = Math.max(-100, Math.min(100, rawCaretOffset));
  } else {
    // Fallback to percentage offset inside relative container
    const leftPct = Math.max(8, Math.min(92, (x / imageWidth) * 100));
    const topPct = Math.max(8, Math.min(92, (y / imageHeight) * 100));
    isNearTop = topPct < 25;
    leftPos = `${leftPct}%`;
    topPos = `${topPct}%`;
    caretOffset = 0;
  }

  return (
    <div
      role="tooltip"
      id="diagnostic-annotation-tooltip"
      className="absolute pointer-events-none z-30 transition-[opacity,transform] duration-150 motion-reduce:transition-none"
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
          "w-60 sm:w-64 max-w-[calc(100vw-2rem)] p-2.5 rounded-xl shadow-warm border backdrop-blur-md transition-colors select-none relative",
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
                ? "border-band-1/40 text-band-1-text dark:text-orange-200 bg-band-1/15 dark:bg-band-1/25"
                : "border-brand-300 dark:border-brand-800 text-brand-800 dark:text-brand-300 bg-brand-50/90 dark:bg-brand-950/60"
            )}
          >
            {isAttention ? "Needs Attention" : "Consistent"}
          </Badge>
        </div>

        <p className="text-xs font-semibold leading-snug">{title}</p>
        <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">{note}</p>
      </div>
    </div>
  );
});
