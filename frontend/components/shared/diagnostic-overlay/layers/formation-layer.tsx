"use client";

import { memo } from "react";
import type {
  FormationOverlay,
  FormationAnnotation,
  CriterionFilter,
  HoverAnnotationCallback,
} from "../types";

import { OVERLAY_COLORS, OVERLAY_WEIGHTS } from "../constants";

interface FormationLayerProps {
  data: FormationOverlay;
  activeCriterion: CriterionFilter;
  hitScale?: number;
  isMobile?: boolean;
  activeAnnotationId?: string | null;
  onHoverAnnotation: HoverAnnotationCallback;
}

const LETTER_ZONE_PALETTE = [
  { fill: "rgba(26, 74, 43, 0.14)", stroke: "var(--band-4-text)", badgeBg: "var(--band-4-text)", text: "var(--band-4-text)" },
  { fill: "rgba(20, 80, 73, 0.14)", stroke: "var(--color-brand-700)", badgeBg: "var(--color-brand-700)", text: "var(--color-brand-700)" },
  { fill: "rgba(143, 74, 33, 0.14)", stroke: "var(--band-1-text)", badgeBg: "var(--band-1-text)", text: "var(--band-1-text)" },
  { fill: "rgba(122, 78, 0, 0.14)", stroke: "var(--band-2-text)", badgeBg: "var(--band-2-text)", text: "var(--band-2-text)" },
  { fill: "rgba(54, 84, 44, 0.14)", stroke: "var(--band-3-text)", badgeBg: "var(--band-3-text)", text: "var(--band-3-text)" },
  { fill: "rgba(15, 61, 56, 0.14)", stroke: "var(--color-brand-800)", badgeBg: "var(--color-brand-800)", text: "var(--color-brand-800)" },
];

interface FormationWordItemProps {
  ann: FormationAnnotation;
  idx: number;
  isSpotlight: boolean;
  hitScale: number;
  isMobile?: boolean;
  activeAnnotationId?: string | null;
  onHoverAnnotation: HoverAnnotationCallback;
}

const FormationWordItem = memo(function FormationWordItem({
  ann,
  idx,
  isSpotlight,
  hitScale,
  isMobile = false,
  activeAnnotationId,
  onHoverAnnotation,
}: FormationWordItemProps) {
  const [x, y, w, h] = ann.bbox;
  const isAttention = ann.severity === "needs_attention";

  if (!isAttention && !isSpotlight) return null;

  const formationColor = isAttention
    ? OVERLAY_COLORS.needs_attention.stroke
    : OVERLAY_COLORS.proficient.stroke;
  const pillBgColor = isAttention ? "var(--band-1-text)" : "var(--color-brand-700)";
  const underlineY = y + h + 3;
  const underlineHeight = Math.max(
    4 * hitScale,
    (isAttention ? OVERLAY_WEIGHTS.strokeAttention : OVERLAY_WEIGHTS.strokeNormal) * hitScale
  );
  const hasLetterZones = Boolean(ann.letter_zones && ann.letter_zones.length > 0);
  const id = `formation-${ann.line_index}-${ann.word_index}`;
  const title = isAttention
    ? ann.band
      ? `Letter Formation (${ann.band})`
      : "Letter Formation Developing"
    : "Clear Letter Formation";
  const noteText = ann.casing_note ? `${ann.note} (${ann.casing_note})` : ann.note;

  const scoreBadgeW = Math.max(38, 42 * hitScale);
  const scoreBadgeH = Math.max(18, 20 * hitScale);
  const scoreBadgeX = x + w / 2;
  const scoreBadgeY = isMobile
    ? underlineY + underlineHeight + 4 * hitScale + scoreBadgeH / 2
    : hasLetterZones
      ? y - 28 * hitScale
      : y - 10 * hitScale;
  const strokeW = Math.max(1.5, 1.75 * hitScale);

  const hoverPayload = {
    id,
    criterion: "letter_formation" as const,
    title,
    note: noteText,
    severity: ann.severity,
    x: x + w / 2,
    y: underlineY + underlineHeight + 2,
    anchorTopY: isSpotlight
      ? isMobile
        ? hasLetterZones
          ? y - 20 * hitScale
          : y - 2
        : hasLetterZones
          ? y - 40 * hitScale
          : y - 22 * hitScale
      : y - 2,
    anchorBottomY:
      isMobile && isSpotlight
        ? scoreBadgeY + scoreBadgeH / 2 + 2
        : underlineY + underlineHeight + 2,
  };

  const toggleAnnotation = () => {
    onHoverAnnotation((prev) => (prev?.id === id ? null : hoverPayload));
  };

  const isFocusable = isSpotlight || isAttention;
  const isActive = activeAnnotationId === id;
  const hitH = OVERLAY_WEIGHTS.minTargetSize * hitScale;
  const hitW = Math.max(hitH, w);

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
      {/* Centerline SVG Pen Strokes Trace */}
      {ann.stroke_paths?.map((pCmd, pIdx) => (
        <path
          key={`stroke-${id}-${pIdx}`}
          d={pCmd}
          fill="none"
          stroke="var(--color-brand-600)"
          strokeWidth={strokeW}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={
            isSpotlight
              ? "pointer-events-none opacity-75 group-hover:opacity-95"
              : "pointer-events-none opacity-60 group-hover:opacity-85"
          }
        />
      ))}

      {/* Letter-by-Letter Segmentation Zones & Character Badges */}
      {isSpotlight &&
        ann.letter_zones?.map((lz, lzIdx) => {
          const [lzX, lzY, lzW, lzH] = lz.bbox;
          const styleMeta = LETTER_ZONE_PALETTE[lzIdx % LETTER_ZONE_PALETTE.length];
          const letterBadgeSize = Math.max(16, 18 * hitScale);
          const badgeY = Math.max(letterBadgeSize / 2 + 2 * hitScale, lzY - 4 * hitScale);

          return (
            <g key={`lz-${id}-${lzIdx}`} className="pointer-events-none">
              {/* Letter Zone Translucent Box & Border */}
              <rect
                x={lzX}
                y={lzY}
                width={lzW}
                height={lzH}
                fill={styleMeta.fill}
                stroke={styleMeta.stroke}
                strokeWidth={1.2 * hitScale}
                strokeDasharray="3 2"
                rx={3 * hitScale}
              />

              {/* Character Label Badge */}
              <g transform={`translate(${lzX + lzW / 2}, ${badgeY})`}>
                <rect
                  x={-letterBadgeSize / 2}
                  y={-letterBadgeSize / 2}
                  width={letterBadgeSize}
                  height={letterBadgeSize}
                  rx={letterBadgeSize / 4}
                  fill={styleMeta.badgeBg || styleMeta.stroke}
                />
                <text
                  x={0}
                  y={0}
                  dominantBaseline="central"
                  textAnchor="middle"
                  fill="var(--color-surface)"
                  fontSize={11 * hitScale}
                  fontWeight="700"
                  fontFamily="var(--font-sans)"
                >
                  {lz.char}
                </text>
              </g>
            </g>
          );
        })}

      {/* Touch Hit Target */}
      <rect
        x={x - (hitW > w ? (hitW - w) / 2 : 0)}
        y={underlineY - hitH / 2}
        width={hitW}
        height={hitH}
        fill="transparent"
        className="pointer-events-auto"
      />

      {/* Selection Highlight Indicator */}
      <rect
        x={x - 2 * hitScale}
        y={underlineY - 1 * hitScale}
        width={w + 4 * hitScale}
        height={4 * hitScale}
        rx={2 * hitScale}
        className={`transition-opacity fill-brand-700 dark:fill-brand-400 pointer-events-none ${isActive ? "opacity-100" : "opacity-0 group-hover:opacity-75 group-focus-visible:opacity-100"
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
        className="transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
      />

      {/* Word Formation Scoring Percentage Pill in Spotlight Mode */}
      {isSpotlight && (
        <g transform={`translate(${scoreBadgeX}, ${scoreBadgeY})`}>
          <rect
            x={-scoreBadgeW / 2}
            y={-scoreBadgeH / 2}
            width={scoreBadgeW}
            height={scoreBadgeH}
            rx={scoreBadgeH / 2}
            fill={pillBgColor}
            className="transition-transform group-hover:scale-105 motion-reduce:transform-none"
          />
          <text
            x={0}
            y={0}
            dominantBaseline="central"
            textAnchor="middle"
            fill="var(--color-surface)"
            fontSize={11 * hitScale}
            fontWeight="700"
            fontFamily="var(--font-sans)"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {Math.round(ann.score)}%
          </text>
        </g>
      )}
    </g>
  );
});

export const FormationLayer = memo(function FormationLayer({
  data,
  activeCriterion,
  hitScale = 1,
  isMobile = false,
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
      {annotations.map((ann, idx) => (
        <FormationWordItem
          key={`formation-word-${idx}`}
          ann={ann}
          idx={idx}
          isSpotlight={isSpotlight}
          hitScale={hitScale}
          isMobile={isMobile}
          activeAnnotationId={activeAnnotationId}
          onHoverAnnotation={onHoverAnnotation}
        />
      ))}
    </g>
  );
});

