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
        const [cx, cy, cw, ch] = ann.core_bbox ?? [x, y, w, h];
        const isAttention = ann.severity === "needs_attention";

        if (!isAttention && !isSpotlight) return null;

        const boxColor = isAttention
          ? OVERLAY_COLORS.needs_attention.stroke
          : OVERLAY_COLORS.consistent.stroke;
        const id = `size-${ann.line_index}-${ann.word_index}`;
        const ratioPercent = Math.round(ann.size_ratio * 100);
        const title = isAttention
          ? `Letter Size Irregular (${ratioPercent}% of guide)`
          : `Proportional Letter Size (${ratioPercent}% of guide)`;
        const hoverPayload = {
          id,
          criterion: "size_consistency" as const,
          title,
          note: ann.note,
          severity: ann.severity,
          x: cx + cw / 2,
          y: cy - 8,
        };

        const toggleAnnotation = () => {
          onHoverAnnotation((prev) => (prev?.id === id ? null : hoverPayload));
        };

        const isFocusable = isSpotlight || isAttention;
        const isActive = activeAnnotationId === id;
        const minHit = Math.max(36, 36 * hitScale);
        const hitW = Math.max(minHit, w);
        const hitH = Math.max(minHit, Math.max(h, ch));

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
            {/* Transparent padding to guarantee minimum 36x36px hit target */}
            <rect
              x={x - (hitW > w ? (hitW - w) / 2 : 0)}
              y={Math.min(y, cy) - (hitH > Math.max(h, ch) ? (hitH - Math.max(h, ch)) / 2 : 0)}
              width={hitW}
              height={hitH}
              fill="transparent"
              className="pointer-events-auto"
            />

            {/* Outer Word Extent Brackets (Subtle indication of full word bounds) */}
            {ann.core_bbox && (
              <g className="opacity-65 transition-opacity group-hover:opacity-90">
                {/* Left side bracket */}
                <path
                  d={`M ${x + 6 * hitScale} ${y} L ${x} ${y} L ${x} ${y + h} L ${x + 6 * hitScale} ${y + h}`}
                  fill="none"
                  stroke={boxColor}
                  strokeWidth={2.0}
                  vectorEffect="non-scaling-stroke"
                  strokeDasharray={`${4 * hitScale} ${2 * hitScale}`}
                />
                {/* Right side bracket */}
                <path
                  d={`M ${x + w - 6 * hitScale} ${y} L ${x + w} ${y} L ${x + w} ${y + h} L ${x + w - 6 * hitScale} ${y + h}`}
                  fill="none"
                  stroke={boxColor}
                  strokeWidth={2.0}
                  vectorEffect="non-scaling-stroke"
                  strokeDasharray={`${4 * hitScale} ${2 * hitScale}`}
                />
              </g>
            )}

            {/* Keyboard Focus / Selection Highlight Ring */}
            <rect
              x={cx - 2 * hitScale}
              y={cy - 2 * hitScale}
              width={cw + 4 * hitScale}
              height={ch + 4 * hitScale}
              fill="none"
              strokeWidth={3.5}
              vectorEffect="non-scaling-stroke"
              strokeDasharray={`${6 * hitScale} ${3 * hitScale}`}
              rx={4 * hitScale}
              className={`transition-opacity stroke-brand-700 dark:stroke-brand-400 pointer-events-none ${
                isActive ? "opacity-100" : "opacity-0 group-hover:opacity-75 group-focus-visible:opacity-100"
              }`}
            />

            {/* Core Ruling Zone Box (Baseline to Midline Reference Band) */}
            <rect
              x={cx}
              y={cy}
              width={cw}
              height={ch}
              fill={boxColor}
              fillOpacity={isAttention ? 0.32 : 0.20}
              stroke={boxColor}
              strokeWidth={isAttention ? 3.5 : 2.75}
              vectorEffect="non-scaling-stroke"
              strokeDasharray={isAttention ? "none" : `${5 * hitScale} ${3 * hitScale}`}
              rx={3 * hitScale}
              className="transition-all"
            />

            {/* Top (Midline) and Bottom (Baseline) Guideline Accent Bars */}
            <line
              x1={cx}
              y1={cy}
              x2={cx + cw}
              y2={cy}
              stroke={boxColor}
              strokeWidth={isAttention ? 3.5 : 2.5}
              vectorEffect="non-scaling-stroke"
            />
            <line
              x1={cx}
              y1={cy + ch}
              x2={cx + cw}
              y2={cy + ch}
              stroke={boxColor}
              strokeWidth={isAttention ? 3.5 : 2.5}
              vectorEffect="non-scaling-stroke"
            />

            {/* Corner Guide Accent on Attention */}
            {isAttention && (
              <path
                d={`M ${cx} ${cy + 10 * hitScale} L ${cx} ${cy} L ${cx + 10 * hitScale} ${cy}`}
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

