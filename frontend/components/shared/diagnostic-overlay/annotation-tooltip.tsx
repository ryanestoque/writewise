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

    // Tooltip width is up to 256px (sm:w-64). Clamp within rendered bounds considering counterScale
    const halfWidth = 128 * counterScale;
    const imageMinX = offsetX + halfWidth + 8;
    const imageMaxX = offsetX + renderedW - halfWidth - 8;
    const minX = Math.max(halfWidth + 4, imageMinX <= imageMaxX ? imageMinX : containerWidth / 2);
    const maxX = Math.min(containerWidth - halfWidth - 4, imageMinX <= imageMaxX ? imageMaxX : containerWidth / 2);
    const clampedX = Math.max(minX, Math.min(maxX, pixelX));

    isNearTop = pixelY < 85 * counterScale;
    leftPos = `${clampedX}px`;
    topPos = `${pixelY}px`;
  } else {
    // Fallback to percentage offset inside relative container
    const leftPct = Math.max(8, Math.min(92, (x / imageWidth) * 100));
    const topPct = Math.max(8, Math.min(92, (y / imageHeight) * 100));
    isNearTop = topPct < 15;
    leftPos = `${leftPct}%`;
    topPos = `${topPct}%`;
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
      <div
        className={cn(
          "w-60 sm:w-64 max-w-[calc(100vw-2rem)] p-2.5 rounded-xl shadow-warm border backdrop-blur-md transition-colors select-none",
          "bg-white/95 dark:bg-card/95 text-foreground",
          isAttention
            ? "border-[#9c4a2f]/40 dark:border-[#9c4a2f]/50 ring-2 ring-[#9c4a2f]/10"
            : "border-[#1b6b63]/40 dark:border-[#1b6b63]/50 ring-2 ring-[#1b6b63]/10"
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
                ? "border-[#9c4a2f]/40 text-[#7c2d12] dark:text-[#fca5a5] bg-[#ffedd5]/90 dark:bg-[#9c4a2f]/25"
                : "border-[#1b6b63]/30 text-[#145049] dark:text-[#2dd4bf] bg-[#e4f1ef]/90 dark:bg-[#1b6b63]/20"
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
