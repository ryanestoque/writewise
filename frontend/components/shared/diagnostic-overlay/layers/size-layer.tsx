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
        const minHit = Math.max(36, 36 * hitScale);
        const hitW = Math.max(minHit, w);
        const hitH = Math.max(minHit, h);

        return (
          <g
            key={`size-box-${idx}`}
            id={id}
            role="button"
            tabIndex={isFocusable ? 0 : -1}
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
                e.preventDefault();
                e.stopPropagation();
                onHoverAnnotation(null);
              }
            }}
          >
            {/* Transparent padding to guarantee minimum 36x36px hit target (scaled for mobile screen pixels) */}
            <rect
              x={x - (hitW > w ? (hitW - w) / 2 : 0)}
              y={y - (hitH > h ? (hitH - h) / 2 : 0)}
              width={hitW}
              height={hitH}
              fill="transparent"
              className="pointer-events-auto"
            />

            {/* Keyboard Focus / Selection Highlight Ring (WCAG 2.4.7) */}
            <rect
              x={x - 2 * hitScale}
              y={y - 2 * hitScale}
              width={w + 4 * hitScale}
              height={h + 4 * hitScale}
              fill="none"
              strokeWidth={3.5}
              vectorEffect="non-scaling-stroke"
              strokeDasharray={`${6 * hitScale} ${3 * hitScale}`}
              rx={4 * hitScale}
              className={`transition-opacity stroke-brand-700 dark:stroke-brand-400 pointer-events-none ${
                isActive ? "opacity-100" : "opacity-0 group-hover:opacity-75 group-focus-visible:opacity-100"
              }`}
            />

            {/* Word Bounding Box */}
            <rect
              x={x}
              y={y}
              width={w}
              height={h}
              fill={boxColor}
              fillOpacity={isAttention ? 0.16 : 0.06}
              stroke={boxColor}
              strokeWidth={isAttention ? OVERLAY_WEIGHTS.strokeAttention : OVERLAY_WEIGHTS.strokeNormal}
              vectorEffect="non-scaling-stroke"
              strokeDasharray={isAttention ? "none" : `${4 * hitScale} ${3 * hitScale}`}
              rx={4 * hitScale}
              className="transition-all"
            />

            {/* Corner Guide Accent on Attention */}
            {isAttention && (
              <path
                d={`M ${x} ${y + 12 * hitScale} L ${x} ${y} L ${x + 12 * hitScale} ${y}`}
                fill="none"
                stroke={boxColor}
                strokeWidth={3}
                vectorEffect="non-scaling-stroke"
                strokeLinecap="round"
              />
            )}
          </g>
        );
      })}
    </g>
  );
});
