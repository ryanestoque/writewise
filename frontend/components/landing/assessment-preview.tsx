"use client";

import { useId, useState } from "react";
import { WorksheetImageInspector } from "@/components/shared/worksheet-image-inspector";
import { DiagnosticOverlay } from "@/components/shared/diagnostic-overlay/diagnostic-overlay";
import type { ActiveAnnotationHover } from "@/components/shared/diagnostic-overlay/types";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
  const [criterion, setCriterion] = useState<(typeof EXAMPLE_CRITERIA)[number]["id"]>("spacing");
  const [visible, setVisible] = useState(true);
  const [guides, setGuides] = useState(true);
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
  };

  return (
    <div
      id="assessment-preview"
      className={styles.studioCard}
      aria-label="Interactive worksheet assessment studio"
    >
      <div className={styles.studioHeader}>
        <div>
          <span className={styles.studioEyebrow}>Interactive worksheet sample</span>
          <h2 className={styles.studioTitle}>Cursive practice: &ldquo;kites fly high&rdquo;</h2>
        </div>
        <span className={styles.band} data-band="satisfactory">
          <span className={styles.bandDot} aria-hidden="true" />
          74% Overall · Satisfactory
        </span>
      </div>

      <div className={styles.studioViewerWrap}>
        <WorksheetImageInspector
          imageUrl={EXAMPLE_WORKSHEET}
          imageDimensions={EXAMPLE_WORKSHEET_DIMENSIONS}
          headerLabel="Sample handwriting worksheet"
          altText="Cursive worksheet showing two lines of 'kites fly high': the first line has crowded then wide word spaces; the second has even word spaces."
          showShortcutsLegend={false}
          keyboardScope="focused"
          imageToolsDisclosure
          autoAspectRatio={false}
          aspectRatioClass="aspect-[62/43] min-h-[210px]"
          diagnosticToolbar={
            <div className={styles.previewGuideTools}>
              <button
                type="button"
                aria-pressed={visible}
                onClick={() => setVisible((current) => !current)}
              >
                Assessment marks
              </button>
              <button
                type="button"
                aria-pressed={guides}
                onClick={() => setGuides((current) => !current)}
              >
                Guide lines
              </button>
            </div>
          }
        >
          <DiagnosticOverlay
            overlay={EXAMPLE_OVERLAY}
            imageUrl={EXAMPLE_WORKSHEET}
            imageDimensions={EXAMPLE_WORKSHEET_DIMENSIONS}
            activeCriterion={criterion}
            visible={visible}
            selectedAnnotation={annotation}
            onSelectAnnotation={setAnnotation}
            showGuideLines={guides}
          />
        </WorksheetImageInspector>
      </div>

      <div className={styles.studioControls}>
        <div className={styles.studioCriteriaHeader}>
          <span id={`${criterionId}-heading`} className={styles.studioCriteriaLabel}>
            Select a criterion to inspect marks
          </span>
          <span className={styles.studioCriteriaHint}>5 criteria</span>
        </div>

        <RadioGroup
          value={criterion}
          onValueChange={selectCriterion}
          aria-labelledby={`${criterionId}-heading`}
          className={styles.studioCriteriaGrid}
        >
          {EXAMPLE_CRITERIA.map((item) => {
            const band = getScoreBandLabel(item.score, { source: "calibrated" });
            const bandKey =
              band.band === "Needs Improvement" ? "needs" : band.band.toLowerCase();
            const isSelected = item.id === criterion;
            return (
              <label
                key={item.id}
                htmlFor={`${criterionId}-${item.id}`}
                className={styles.studioCriterionPill}
                data-selected={isSelected}
              >
                <RadioGroupItem
                  id={`${criterionId}-${item.id}`}
                  value={item.id}
                  className={styles.srOnlyRadio}
                />
                <span className={styles.studioCriterionTop}>
                  <span className={styles.studioCriterionName}>{item.name}</span>
                  <span className={styles.studioCriterionScore}>{item.score}%</span>
                </span>
                <span className={`${styles.band} ${styles.previewBand}`} data-band={bandKey}>
                  <span className={styles.bandDot} aria-hidden="true" />
                  {band.band}
                </span>
              </label>
            );
          })}
        </RadioGroup>

        <div className={styles.studioCoaching} aria-live="polite" aria-atomic="true">
          <div className={styles.studioCoachingHead}>
            <span className={styles.studioCoachingTitle}>{focused.name} feedback</span>
            <span className={styles.band} data-band={focusedBandKey}>
              <span className={styles.bandDot} aria-hidden="true" />
              {focused.score}% · {focusedBand.band}
            </span>
          </div>
          <dl className={styles.studioCoachingGrid}>
            <div>
              <dt>What we see</dt>
              <dd>{focused.observation}</dd>
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
