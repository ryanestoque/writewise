"use client";

import { useState, useEffect, useCallback, memo } from "react";
import type {
  DiagnosticOverlayData,
  CriterionFilter,
  ActiveAnnotationHover,
} from "./types";
import { BaselineLayer } from "./layers/baseline-layer";
import { SpacingLayer } from "./layers/spacing-layer";
import { SizeLayer } from "./layers/size-layer";
import { SlantLayer } from "./layers/slant-layer";
import { FormationLayer } from "./layers/formation-layer";
import { AnnotationTooltip } from "./annotation-tooltip";

/**
 * Safely extracts DiagnosticOverlayData from a measurement record or raw_output object.
 * Returns null if no valid overlay data is present.
 */
export function extractDiagnosticOverlay(
  recordOrRaw: unknown
): DiagnosticOverlayData | null {
  if (!recordOrRaw || typeof recordOrRaw !== "object") return null;
  const obj = recordOrRaw as Record<string, unknown>;

  // Check direct overlay property on measurement
  if ("overlay" in obj && obj.overlay && typeof obj.overlay === "object") {
    const ov = obj.overlay as Record<string, unknown>;
    if ("baseline" in ov && "summary" in ov) {
      return obj.overlay as DiagnosticOverlayData;
    }
  }

  // Check nested in measurement row
  if ("measurement" in obj && obj.measurement && typeof obj.measurement === "object") {
    const meas = obj.measurement as Record<string, unknown>;
    if ("overlay" in meas && meas.overlay && typeof meas.overlay === "object") {
      return meas.overlay as DiagnosticOverlayData;
    }
  }

  return null;
}

interface DiagnosticOverlayProps {
  overlay: DiagnosticOverlayData | null | undefined;
  imageUrl?: string | null;
  visible?: boolean;
  activeCriterion?: CriterionFilter;
}

export const DiagnosticOverlay = memo(function DiagnosticOverlay({
  overlay,
  imageUrl,
  visible = true,
  activeCriterion = "all",
}: DiagnosticOverlayProps) {
  const [naturalSize, setNaturalSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [hoveredAnnotation, setHoveredAnnotation] =
    useState<ActiveAnnotationHover | null>(null);

  // Load natural dimensions of the image so SVG viewBox aligns 1:1 with pixel coordinates
  useEffect(() => {
    if (!imageUrl) return;

    let active = true;
    const img = new Image();
    img.onload = () => {
      if (active) {
        setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
      }
    };
    img.onerror = () => {
      if (active) {
        setNaturalSize(null);
      }
    };
    img.src = imageUrl;

    return () => {
      active = false;
      img.onload = null;
      img.onerror = null;
    };
  }, [imageUrl]);

  const handleHoverAnnotation = useCallback(
    (hover: ActiveAnnotationHover | null) => {
      setHoveredAnnotation(hover);
    },
    []
  );

  if (!visible || !overlay || !naturalSize) return null;

  return (
    <>
      {/* Root SVG Canvas matching natural image size */}
      <svg
        viewBox={`0 0 ${naturalSize.width} ${naturalSize.height}`}
        preserveAspectRatio="xMidYMid meet"
        className="absolute inset-0 size-full pointer-events-none z-10 select-none"
        aria-hidden="true"
      >
        {/* Baseline & Reference Guides Layer */}
        {overlay.baseline && (
          <BaselineLayer
            data={overlay.baseline}
            activeCriterion={activeCriterion}
            viewWidth={naturalSize.width}
            onHoverAnnotation={handleHoverAnnotation}
          />
        )}

        {/* Spacing Brackets Layer */}
        {overlay.spacing && (
          <SpacingLayer
            data={overlay.spacing}
            activeCriterion={activeCriterion}
            onHoverAnnotation={handleHoverAnnotation}
          />
        )}

        {/* Size Consistency Bounding Boxes Layer */}
        {overlay.size && (
          <SizeLayer
            data={overlay.size}
            activeCriterion={activeCriterion}
            onHoverAnnotation={handleHoverAnnotation}
          />
        )}

        {/* Slant Direction Vectors Layer */}
        {overlay.slant && (
          <SlantLayer
            data={overlay.slant}
            activeCriterion={activeCriterion}
            onHoverAnnotation={handleHoverAnnotation}
          />
        )}

        {/* Letter Formation CNN Highlights Layer */}
        {overlay.letter_formation && (
          <FormationLayer
            data={overlay.letter_formation}
            activeCriterion={activeCriterion}
            onHoverAnnotation={handleHoverAnnotation}
          />
        )}
      </svg>

      {/* Floating HTML Diagnostic Tooltip Popover */}
      <AnnotationTooltip
        hover={hoveredAnnotation}
        imageWidth={naturalSize.width}
        imageHeight={naturalSize.height}
      />
    </>
  );
});
