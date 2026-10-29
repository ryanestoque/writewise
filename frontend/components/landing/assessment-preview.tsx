"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import { WorksheetImageInspector } from "@/components/shared/worksheet-image-inspector";
import { DiagnosticOverlay } from "@/components/shared/diagnostic-overlay/diagnostic-overlay";
import type { ActiveAnnotationHover } from "@/components/shared/diagnostic-overlay/types";
import { Switch } from "@/components/ui/switch";
import { getScoreBandLabel } from "@/lib/utils/submission-status";
import {
  EXAMPLE_CRITERIA,
  EXAMPLE_OVERLAY,
  EXAMPLE_WORKSHEET,
  EXAMPLE_WORKSHEET_DIMENSIONS,
} from "./assessment-preview-data";
import styles from "@/app/landing.module.css";

/** Interactive hero worksheet studio with local sample data; never calls a submission API. */
export function AssessmentPreview() {
  const criterionId = useId();
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [criterion, setCriterion] = useState<(typeof EXAMPLE_CRITERIA)[number]["id"]>("spacing");
  const [showOverlay, setShowOverlay] = useState(true);
  const [annotation, setAnnotation] = useState<ActiveAnnotationHover | null>(null);
  const focused = EXAMPLE_CRITERIA.find((item) => item.id === criterion) ?? EXAMPLE_CRITERIA[2];
  const focusedBand = getScoreBandLabel(focused.score, { source: "calibrated" });
  const focusedBandKey =
    focusedBand.band === "Needs Improvement" ? "needs" : focusedBand.band.toLowerCase();

  const selectCriterion = (next: string) => {
    const selected = EXAMPLE_CRITERIA.find((item) => item.id === next);
    if (!selected) return;
    setCriterion(selected.id);
    setAnnotation(null);
    setShowOverlay(true);
  };

  const onCriterionKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number
  ) => {
    const keys: Record<string, number> = {
      ArrowRight: 1,
      ArrowDown: 1,
      ArrowLeft: -1,
      ArrowUp: -1,
    };
    let next: number | null = null;
    if (event.key in keys) {
      next = (index + keys[event.key] + EXAMPLE_CRITERIA.length) % EXAMPLE_CRITERIA.length;
    }
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = EXAMPLE_CRITERIA.length - 1;
    if (next === null) return;
    event.preventDefault();
    selectCriterion(EXAMPLE_CRITERIA[next].id);
    buttonRefs.current[next]?.focus();
  };

  return (
    <div
      id="assessment-preview"
      className={styles.studioCard}
      aria-label="Interactive worksheet assessment studio"
    >
      <div className={styles.studioHeader}>
        <h2 className={styles.studioTitle}>Target text: &ldquo;kites fly high&rdquo;</h2>
        <label
          htmlFor={`${criterionId}-overlay-switch`}
          className={styles.viewerSwitchPill}
        >
          <span className={styles.viewerSwitchLabel}>Assessment marks</span>
          <Switch
            id={`${criterionId}-overlay-switch`}
            size="sm"
            checked={showOverlay}
            onCheckedChange={setShowOverlay}
            aria-label="Toggle assessment marks overlay"
          />
        </label>
      </div>

      <div className={styles.studioViewerWrap}>
        <div className={styles.studioViewerTopRow}>
          <span className={styles.studioViewerCaption}>
            Illustrative handwriting — no student data
          </span>
        </div>

        <WorksheetImageInspector
          imageUrl={EXAMPLE_WORKSHEET}
          imageDimensions={EXAMPLE_WORKSHEET_DIMENSIONS}
          headerLabel=""
          altText="Cursive worksheet showing 'kites fly high' with crowded then wide word spacing."
          showShortcutsLegend={false}
          keyboardScope="focused"
          showImageTools={false}
          autoAspectRatio={false}
          aspectRatioClass="aspect-[62/34] min-h-[220px] sm:min-h-[260px]"
        >
          <DiagnosticOverlay
            overlay={EXAMPLE_OVERLAY}
            imageUrl={EXAMPLE_WORKSHEET}
            imageDimensions={EXAMPLE_WORKSHEET_DIMENSIONS}
            activeCriterion={criterion}
            visible={showOverlay}
            selectedAnnotation={annotation}
            onSelectAnnotation={setAnnotation}
            showGuideLines={showOverlay}
            showMeasurementDetails={false}
          />
        </WorksheetImageInspector>
      </div>

      <div className={styles.studioControls}>
        <div className={styles.studioCriteriaHeader}>
          <span id={`${criterionId}-heading`} className={styles.studioCriteriaLabel}>
            Select a criterion to inspect marks
          </span>
        </div>

        <div
          role="radiogroup"
          aria-labelledby={`${criterionId}-heading`}
          className={styles.studioCriteriaGrid}
        >
          {EXAMPLE_CRITERIA.map((item, index) => {
            const band = getScoreBandLabel(item.score, { source: "calibrated" });
            const isSelected = item.id === criterion;
            return (
              <button
                key={item.id}
                ref={(el) => {
                  buttonRefs.current[index] = el;
                }}
                type="button"
                role="radio"
                aria-checked={isSelected}
                aria-label={`${item.name}, ${item.score}%, ${band.band}`}
                tabIndex={isSelected ? 0 : -1}
                onClick={() => selectCriterion(item.id)}
                onKeyDown={(e) => onCriterionKeyDown(e, index)}
                className={styles.studioCriterionPill}
                data-selected={isSelected}
              >
                <span className={styles.studioCriterionName}>{item.name}</span>
                <span className={styles.studioCriterionScore}>{item.score}%</span>
              </button>
            );
          })}
        </div>

        <div className={styles.studioCoaching} aria-live="polite" aria-atomic="true">
          <div className={styles.studioCoachingHead}>
            <span className={styles.studioCoachingTitle}>
              {annotation ? `${annotation.title} details` : `${focused.name} feedback`}
            </span>
            <span
              className={styles.band}
              data-band={
                annotation
                  ? annotation.severity === "needs_attention"
                    ? "needs"
                    : "excellent"
                  : focusedBandKey
              }
            >
              <span className={styles.bandDot} aria-hidden="true" />
              {annotation
                ? annotation.severity === "needs_attention"
                  ? "Needs Attention"
                  : "Consistent"
                : `${focused.score}% · ${focusedBand.band}`}
            </span>
          </div>
          <dl className={styles.studioCoachingGrid}>
            <div>
              <dt>{annotation ? "Selected stroke observation" : "What we see"}</dt>
              <dd>{annotation ? annotation.note : focused.observation}</dd>
            </div>
            <div>
              <dt>Practice next</dt>
              <dd>{focused.next}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
