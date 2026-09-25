"use client";

import { memo, useEffect, useLayoutEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
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

// Safely check if we're in a browser environment
const canUseDOM = typeof window !== "undefined" && typeof document !== "undefined";

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
  // Track the overlay container's screen rect for fixed positioning.
  const overlayRef = useRef<HTMLSpanElement>(null);
  const [screenRect, setScreenRect] = useState<{
    overlayLeft: number;
    overlayTop: number;
    overlayWidth: number;
    overlayHeight: number;
  } | null>(null);

  // Measure the overlay container's screen rect synchronously before paint
  // so the tooltip never flickers or goes missing for a frame.
  const measureRef = useCallback(() => {
    const anchor = overlayRef.current;
    if (!anchor) return;
    // Walk to the overlay container (the absolute inset-0 parent div from DiagnosticOverlay)
    const overlayContainer = anchor.parentElement;
    if (!overlayContainer) return;

    const rect = overlayContainer.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      setScreenRect((prev) => {
        if (
          prev &&
          Math.abs(prev.overlayLeft - rect.left) < 0.5 &&
          Math.abs(prev.overlayTop - rect.top) < 0.5 &&
          Math.abs(prev.overlayWidth - rect.width) < 0.5 &&
          Math.abs(prev.overlayHeight - rect.height) < 0.5
        ) {
          return prev;
        }
        return {
          overlayLeft: rect.left,
          overlayTop: rect.top,
          overlayWidth: rect.width,
          overlayHeight: rect.height,
        };
      });
    }
  }, []);

  // Synchronous measurement before paint — prevents flash of missing tooltip
  useLayoutEffect(() => {
    measureRef();
  }, [hover, zoomScale, panOffset.x, panOffset.y, containerWidth, containerHeight, measureRef]);

  // Also track scroll/resize to keep fixed position accurate
  useEffect(() => {
    if (!hover || !canUseDOM) return;
    const handler = () => measureRef();
    window.addEventListener("scroll", handler, { capture: true, passive: true });
    window.addEventListener("resize", handler, { passive: true });
    // Also use rAF for continuous updates during animations
    let rafId: number | null = null;
    const rafLoop = () => {
      measureRef();
      rafId = requestAnimationFrame(rafLoop);
    };
    // Run rAF loop for the first ~300ms to catch layout settling and CSS transitions
    rafId = requestAnimationFrame(rafLoop);
    const timeoutId = setTimeout(() => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    }, 300);
    return () => {
      window.removeEventListener("scroll", handler, { capture: true });
      window.removeEventListener("resize", handler);
      if (rafId !== null) cancelAnimationFrame(rafId);
      clearTimeout(timeoutId);
    };
  }, [hover, measureRef]);

  // Always render the anchor span so we can measure; everything below handles the tooltip
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

  // Compute the tooltip's fixed screen position
  let screenX = 0;
  let screenY = 0;
  let isOffscreen = false;
  let cardWidth = 256;
  let hasValidPosition = false;

  if (
    containerWidth &&
    containerHeight &&
    containerWidth > 0 &&
    containerHeight > 0 &&
    screenRect
  ) {
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
      renderedW = containerH * imgRatio;
      offsetX = (containerW - renderedW) / 2;
    } else {
      renderedH = containerW / imgRatio;
      offsetY = (containerH - renderedH) / 2;
    }

    const pixelX = offsetX + (x / imageWidth) * renderedW;
    const pixelY = offsetY + (y / imageHeight) * renderedH;

    // The overlay's getBoundingClientRect includes all ancestor CSS transforms
    // (zoom scale + pan translate), so we can directly map local overlay coords
    // to screen coords using proportional interpolation.
    screenX = screenRect.overlayLeft + (pixelX / containerW) * screenRect.overlayWidth;
    screenY = screenRect.overlayTop + (pixelY / containerH) * screenRect.overlayHeight;

    // Fade out if target panned far offscreen
    const targetViewportX =
      viewportW / 2 + panOffset.x + (pixelX - containerW / 2) * effectiveZoom;
    const targetViewportY =
      viewportH / 2 + panOffset.y + (pixelY - containerH / 2) * effectiveZoom;
    isOffscreen =
      targetViewportX < -80 ||
      targetViewportX > viewportW + 80 ||
      targetViewportY < -80 ||
      targetViewportY > viewportH + 80;

    // Card width: clamp to browser viewport since we're using fixed positioning
    const winW = canUseDOM ? window.innerWidth : 1024;
    const baseCardWidth = winW < 640 ? 240 : 256;
    cardWidth = Math.min(baseCardWidth, Math.max(180, winW - 24));
    hasValidPosition = true;
  }

  // If we can't compute a valid position, fall back to the old absolute approach
  // inside the overlay container (may clip, but at least visible)
  if (!hasValidPosition) {
    const counterScale = 1 / effectiveZoom;
    const leftPct = Math.max(12, Math.min(88, (x / imageWidth) * 100));
    const topPct = Math.max(12, Math.min(88, (y / imageHeight) * 100));
    const isNearTop = topPct < 30;

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
          className="absolute pointer-events-none z-30 transition-[opacity,transform] duration-150 motion-reduce:transition-none"
          style={{
            left: `${leftPct}%`,
            top: `${topPct}%`,
            transform: `translate3d(-50%, ${isNearTop ? "8px" : "calc(-100% - 8px)"}, 0) scale(${counterScale})`,
            transformOrigin: isNearTop ? "top center" : "bottom center",
          }}
        >
          <TooltipCard
            title={title}
            note={note}
            isAttention={isAttention}
            criterion={criterion}
            cardWidth={256}
            caretOffset={0}
            isNearTop={isNearTop}
            onDismiss={onDismiss}
          />
        </div>
      </>
    );
  }

  const cardHalfWidth = cardWidth / 2;
  const margin = 12;
  const winW = canUseDOM ? window.innerWidth : 1024;

  // Clamp tooltip center horizontally to stay within browser viewport
  const minCenterX = cardHalfWidth + margin;
  const maxCenterX = winW - cardHalfWidth - margin;
  let clampedScreenX: number;
  if (minCenterX <= maxCenterX) {
    clampedScreenX = Math.max(minCenterX, Math.min(maxCenterX, screenX));
  } else {
    clampedScreenX = winW / 2;
  }

  // Caret offset: visual distance from tooltip center to annotation
  const deltaScreenX = screenX - clampedScreenX;
  const maxCaretOffset = cardHalfWidth - 20;
  const caretOffset = Math.max(-maxCaretOffset, Math.min(maxCaretOffset, deltaScreenX));

  // Vertical placement
  const isNearTop = screenY < 160;
  const tooltipY = isNearTop ? screenY + 12 : screenY - 12;

  const tooltipContent = (
    <div
      role="tooltip"
      id="diagnostic-annotation-tooltip"
      className={cn(
        "fixed pointer-events-none z-[9999] transition-[opacity,transform] duration-150 motion-reduce:transition-none",
        isOffscreen && "opacity-0 invisible"
      )}
      style={{
        left: `${clampedScreenX}px`,
        top: `${tooltipY}px`,
        transform: `translate3d(-50%, ${isNearTop ? "0%" : "-100%"}, 0)`,
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
  );

  return (
    <>
      <span
        ref={overlayRef}
        className="absolute top-0 left-0 size-0 pointer-events-none"
        aria-hidden="true"
      />
      {canUseDOM ? createPortal(tooltipContent, document.body) : null}
    </>
  );
});

/* -------------------------------------------------------------------------- */
/*  Extracted card UI — shared between portal and fallback paths              */
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
      {/* Directional Caret Stem */}
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
        <p className="text-xs text-muted-foreground leading-relaxed mt-1">
          {note}
        </p>
      </div>
    </>
  );
}
