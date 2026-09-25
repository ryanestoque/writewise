"use client";

import { memo, useLayoutEffect, useState, useRef } from "react";
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
  const overlayRef = useRef<HTMLSpanElement>(null);
  const [measuredFallback, setMeasuredFallback] = useState<{
    width: number;
    height: number;
  } | null>(null);

  // If containerWidth/containerHeight wasn't provided or measured by parent yet,
  // synchronously measure parent element on mount/render
  useLayoutEffect(() => {
    if (containerWidth && containerHeight && containerWidth > 0 && containerHeight > 0) {
      return;
    }
    const anchor = overlayRef.current;
    const parent = anchor?.parentElement;
    if (parent) {
      const rect = parent.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setMeasuredFallback((prev) => {
          const w = Math.round(rect.width);
          const h = Math.round(rect.height);
          if (prev && prev.width === w && prev.height === h) return prev;
          return { width: w, height: h };
        });
      }
    }
  }, [containerWidth, containerHeight, hover]);

  // Always keep an anchor element so we can measure parent context if hover is null
  if (!hover || imageWidth <= 0 || imageHeight <= 0) {
    return (
      <span
        ref={overlayRef}
        className="absolute top-0 left-0 size-0 pointer-events-none"
        aria-hidden="true"
      />
    );
  }

  const { title, note, severity, criterion, x, y } = hover;
  const isAttention = severity === "needs_attention";
  const effectiveZoom = zoomScale && zoomScale > 0 ? zoomScale : 1;
  const counterScale = 1 / effectiveZoom;

  const resolvedContainerW =
    (containerWidth && containerWidth > 0 ? containerWidth : measuredFallback?.width) ?? 0;
  const resolvedContainerH =
    (containerHeight && containerHeight > 0 ? containerHeight : measuredFallback?.height) ?? 0;
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

    // Fade out cleanly if target stroke has panned far outside visible viewport
    isOffscreen =
      targetViewportX < -100 ||
      targetViewportX > viewportW + 100 ||
      targetViewportY < -100 ||
      targetViewportY > viewportH + 100;

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

    // Vertical placement: flip below if pin is within 140px of top of viewport
    isNearTop = targetViewportY < 140;

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
    <>
      <span
        ref={overlayRef}
        className="absolute top-0 left-0 size-0 pointer-events-none"
        aria-hidden="true"
      />
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
          transform: `translate3d(-50%, ${isNearTop ? "10px" : "calc(-100% - 10px)"}, 0) scale(${counterScale})`,
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
          onDismiss={onDismiss}
        />
      </div>
    </>
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
        style={{ maxWidth: `${cardWidth}px`, width: `${cardWidth}px` }}
        className={cn(
          "p-2.5 rounded-xl shadow-warm border backdrop-blur-md transition-colors select-text pointer-events-auto relative",
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
        <p className="text-xs text-muted-foreground leading-relaxed mt-1 break-words">
          {note}
        </p>
      </div>
    </>
  );
}
