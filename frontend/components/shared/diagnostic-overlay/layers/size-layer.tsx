"use client";

import { memo } from "react";
import type {
  SizeOverlay,
  CriterionFilter,
  HoverAnnotationCallback,
} from "../types";

import { OVERLAY_COLORS, OVERLAY_WEIGHTS } from "../constants";

interface SizeLayerProps {
  data: SizeOverlay;
  activeCriterion: CriterionFilter;
  hitScale?: number;
  activeAnnotationId?: string | null;
  onHoverAnnotation: HoverAnnotationCallback;
}

export const SizeLayer = memo(function SizeLayer({
  data,
  activeCriterion,
  hitScale = 1,
  activeAnnotationId,
  onHoverAnnotation,
}: SizeLayerProps) {
  const isSpotlight = activeCriterion === "size_consistency";
  const isDimmed = activeCriterion !== "all" && !isSpotlight;

  if (isDimmed) return null;

  const annotations = data?.annotations ?? [];

  return (
    <g
      className="transition-opacity duration-200"
      style={{
        opacity: isSpotlight
          ? OVERLAY_WEIGHTS.opacitySpotlight
          : OVERLAY_WEIGHTS.opacityAllGuides,
      }}
    >
      {annotations.map((ann, idx) => {
        const [x, y, w, h] = ann.bbox;
        const isAttention = ann.severity === "needs_attention";

        if (!isAttention && !isSpotlight) return null;

        const boxColor = isAttention
          ? OVERLAY_COLORS.needs_attention.stroke
          : OVERLAY_COLORS.consistent.stroke;
        const id = `size-${ann.line_index}-${ann.word_index}`;
        const title = isAttention ? "Letter Size Irregular" : "Proportional Letter Size";
        const hoverPayload = {
          id,
          criterion: "size_consistency" as const,
          title,
          note: ann.note,
          severity: ann.severity,
          x: x + w / 2,
          y: y - 8,
        };

        const toggleAnnotation = () => {
          onHoverAnnotation((prev) => (prev?.id === id ? null : hoverPayload));
        };

        const isFocusable = isSpotlight || isAttention;
        const isActive = activeAnnotationId === id;
        const minHit = Math.max(28, 28 * hitScale);
        const hitW = Math.max(minHit, w);
        const hitH = Math.max(minHit, h);

        return (
          <g
            key={`size-box-${idx}`}
            role="button"
            tabIndex={isFocusable ? 0 : -1}
            aria-haspopup="dialog"
            aria-expanded={isActive}
            aria-describedby={isActive ? "diagnostic-annotation-tooltip" : undefined}
            aria-label={`${isAttention ? "Needs attention: " : "Consistent: "} ${title}. ${ann.note}`}
            className="cursor-pointer pointer-events-auto group focus-visible:outline-hidden"
            onMouseEnter={() => onHoverAnnotation(hoverPayload)}
            onMouseLeave={() => onHoverAnnotation(null)}
            onFocus={() => onHoverAnnotation(hoverPayload)}
            onBlur={() => onHoverAnnotation(null)}
            onClick={(e) => {
              e.stopPropagation();
              toggleAnnotation();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                toggleAnnotation();
              } else if (e.key === "Escape") {
                onHoverAnnotation(null);
              }
            }}
          >
            {/* Transparent padding to guarantee minimum 28x28px hit target (scaled for mobile screen pixels) */}
            <rect
              x={x - (hitW > w ? (hitW - w) / 2 : 0)}
              y={y - (hitH > h ? (hitH - h) / 2 : 0)}
              width={hitW}
              height={hitH}
              fill="transparent"
              className="pointer-events-auto"
            />

            {/* Keyboard Focus Highlight Ring (WCAG 2.4.7) */}
            <rect
              x={x - 2}
              y={y - 2}
              width={w + 4}
              height={h + 4}
              fill="none"
              strokeWidth={2.5}
              strokeDasharray="4 2"
              rx={4}
              className="opacity-0 group-focus-visible:opacity-100 transition-opacity stroke-[#1b6b63] dark:stroke-[#2dd4bf] pointer-events-none"
            />

            {/* Word Bounding Box */}
            <rect
              x={x}
              y={y}
              width={w}
              height={h}
              fill={boxColor}
              fillOpacity={isAttention ? 0.08 : 0.03}
              stroke={boxColor}
              strokeWidth={isAttention ? OVERLAY_WEIGHTS.strokeAttention : OVERLAY_WEIGHTS.strokeNormal}
              strokeDasharray={isAttention ? "none" : "3 3"}
              rx={3}
              className="transition-all group-hover:stroke-width-2.5 group-focus-visible:stroke-width-2.5"
            />

            {/* Corner Guide Accent on Attention */}
            {isAttention && (
              <path
                d={`M ${x} ${y + 6} L ${x} ${y} L ${x + 6} ${y}`}
                fill="none"
                stroke={boxColor}
                strokeWidth={2}
                strokeLinecap="round"
              />
            )}
          </g>
        );
      })}
    </g>
  );
});
