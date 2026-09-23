"use client";

import { memo } from "react";
import type {
  FormationOverlay,
  CriterionFilter,
  HoverAnnotationCallback,
} from "../types";

import { OVERLAY_COLORS, OVERLAY_WEIGHTS } from "../constants";

interface FormationLayerProps {
  data: FormationOverlay;
  activeCriterion: CriterionFilter;
  hitScale?: number;
  activeAnnotationId?: string | null;
  onHoverAnnotation: HoverAnnotationCallback;
}

export const FormationLayer = memo(function FormationLayer({
  data,
  activeCriterion,
  hitScale = 1,
  activeAnnotationId,
  onHoverAnnotation,
}: FormationLayerProps) {
  const isSpotlight = activeCriterion === "letter_formation";
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

        const formationColor = isAttention
          ? OVERLAY_COLORS.needs_attention.stroke
          : OVERLAY_COLORS.proficient.stroke;
        const underlineY = y + h + 3;
        const id = `formation-${ann.line_index}-${ann.word_index}`;
        const title = isAttention
          ? ann.band
            ? `Letter Formation (${ann.band})`
            : "Letter Formation Developing"
          : "Clear Letter Formation";
        const hoverPayload = {
          id,
          criterion: "letter_formation" as const,
          title,
          note: ann.note,
          severity: ann.severity,
          x: x + w / 2,
          y: underlineY + 10,
        };

        const toggleAnnotation = () => {
          onHoverAnnotation((prev) => (prev?.id === id ? null : hoverPayload));
        };

        // Only add tab stops to attention items in All Guides, or all items in Spotlight mode
        const isFocusable = isSpotlight || isAttention;
        const isActive = activeAnnotationId === id;
        const hitH = Math.max(36, 36 * hitScale);
        const hitW = Math.max(hitH, w);
        const badgeW = 34 * hitScale;
        const badgeH = 20 * hitScale;

        return (
          <g
            key={`formation-word-${idx}`}
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
            {/* Generous touch hit target (scaled to maintain minimum 36px physical screen pixels on mobile) */}
            <rect
              x={x - (hitW > w ? (hitW - w) / 2 : 0)}
              y={underlineY - hitH / 2}
              width={hitW}
              height={hitH}
              fill="transparent"
              className="pointer-events-auto"
            />

            {/* Keyboard Focus / Selection Highlight Indicator (WCAG 2.4.7) */}
            <rect
              x={x - 2 * hitScale}
              y={underlineY - 1 * hitScale}
              width={w + 4 * hitScale}
              height={4 * hitScale}
              rx={2 * hitScale}
              className={`transition-opacity fill-brand-700 dark:fill-brand-400 pointer-events-none ${
                isActive ? "opacity-100" : "opacity-0 group-focus-visible:opacity-100"
              }`}
            />

            {/* Penmanship stroke underline */}
            <rect
              x={x}
              y={underlineY}
              width={w}
              height={Math.max(4 * hitScale, (isAttention ? OVERLAY_WEIGHTS.strokeAttention : OVERLAY_WEIGHTS.strokeNormal) * hitScale)}
              rx={2 * hitScale}
              fill={formationColor}
              fillOpacity={isAttention ? 0.95 : 0.75}
              className="transition-all group-hover:opacity-100 group-focus-visible:opacity-100"
            />

            {/* Score & Rubric Band Badge in Spotlight Mode */}
            {isSpotlight && (
              <g transform={`translate(${x + w}, ${y + 4 * hitScale})`}>
                <rect
                  x={-badgeW / 2}
                  y={-badgeH / 2}
                  width={badgeW}
                  height={badgeH}
                  rx={badgeH / 2}
                  fill={formationColor}
                  className="transition-transform group-hover:scale-110 motion-reduce:transform-none"
                />
                <text
                  x={0}
                  y={4 * hitScale}
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize={11 * hitScale}
                  fontWeight="600"
                  fontFamily="system-ui, sans-serif"
                >
                  {Math.round(ann.score)}
                </text>
              </g>
            )}
          </g>
        );
      })}
    </g>
  );
});
