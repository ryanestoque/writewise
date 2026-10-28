"use client";

import { useId, useState } from "react";
import { WorksheetImageInspector } from "@/components/shared/worksheet-image-inspector";
import { DiagnosticOverlay } from "@/components/shared/diagnostic-overlay/diagnostic-overlay";
import type { ActiveAnnotationHover } from "@/components/shared/diagnostic-overlay/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { getScoreBandLabel } from "@/lib/utils/submission-status";
import { EXAMPLE_CRITERIA, EXAMPLE_OVERLAY, EXAMPLE_WORKSHEET } from "./assessment-preview-data";
import styles from "@/app/landing.module.css";

/** Real assessment controls with local synthetic data; never calls a submission API. */
export function AssessmentPreview() {
  const criterionId = useId();
  const [criterion, setCriterion] = useState<(typeof EXAMPLE_CRITERIA)[number]["id"]>("spacing");
  const [visible, setVisible] = useState(true);
  const [guides, setGuides] = useState(true);
  const [annotation, setAnnotation] = useState<ActiveAnnotationHover | null>(null);
  const focused = EXAMPLE_CRITERIA.find((item) => item.id === criterion);

  const selectCriterion = (next: string) => {
    const selected = EXAMPLE_CRITERIA.find((item) => item.id === next);
    if (!selected) return;
    setCriterion(selected.id);
    setAnnotation(null);
  };

  return (
    <section id="assessment-preview" className={styles.preview} aria-labelledby="preview-heading">
      <div className={styles.previewIntro}>
        <h2 id="preview-heading" className={styles.sectionTitle}>
          The worksheet. The feedback. Together.
        </h2>
        <p>
          Try the worksheet viewer and diagnostic guides used in an assessment. Choose a criterion
          to explore the marks, then read what to practice next.
        </p>
        <p id="preview-disclosure">
          This example uses synthetic handwriting and illustrative scores, not a student&rsquo;s
          results or a live assessment.
        </p>
      </div>

      <div className={styles.previewSurface} aria-describedby="preview-disclosure">
        <div className={styles.previewHeading}>
          <div>
            <h3>Cursive practice: kites fly high</h3>
            <p>Example assessment &middot; automatic scoring</p>
          </div>
          <Badge variant="secondary">Completed</Badge>
        </div>

        <div className={styles.previewGrid}>
          <WorksheetImageInspector
            imageUrl={EXAMPLE_WORKSHEET}
            headerLabel="Example handwriting worksheet"
            altText="Synthetic cursive worksheet: the first line has crowded then wide word spaces; the second has even word spaces."
            showShortcutsLegend={false}
            keyboardScope="focused"
            imageToolsDisclosure
            autoAspectRatio={false}
            aspectRatioClass="aspect-[62/43] min-h-[210px]"
            diagnosticToolbar={
              <div className={styles.previewGuideTools}>
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  aria-pressed={visible}
                  onClick={() => setVisible((current) => !current)}
                >
                  Assessment marks
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  aria-pressed={guides}
                  onClick={() => setGuides((current) => !current)}
                >
                  Guide lines
                </Button>
              </div>
            }
          >
            <DiagnosticOverlay
              overlay={EXAMPLE_OVERLAY}
              imageUrl={EXAMPLE_WORKSHEET}
              activeCriterion={criterion}
              visible={visible}
              selectedAnnotation={annotation}
              onSelectAnnotation={setAnnotation}
              showGuideLines={guides}
            />
          </WorksheetImageInspector>

          <div className={styles.previewSummary}>
            <h4 id={`${criterionId}-heading`}>Choose a criterion</h4>
            <p className={styles.previewHint} id={`${criterionId}-hint`}>
              Select an example result to see its marks and coaching tip.
            </p>
            <RadioGroup
              value={criterion}
              onValueChange={selectCriterion}
              aria-labelledby={`${criterionId}-heading`}
              aria-describedby={`${criterionId}-hint`}
              className={styles.previewCriteria}
            >
              {EXAMPLE_CRITERIA.map((item) => {
                const band = getScoreBandLabel(item.score, { source: "calibrated" });
                return (
                  <label
                    key={item.id}
                    htmlFor={`${criterionId}-${item.id}`}
                    className={styles.previewCriterion}
                    data-selected={item.id === criterion}
                  >
                    <RadioGroupItem id={`${criterionId}-${item.id}`} value={item.id} />
                    <span>{item.name}</span>
                    <span className={styles.previewResult}>
                      <span>{item.score}%</span>
                      <Badge variant="outline" className={band.className}>
                        {band.band}
                      </Badge>
                    </span>
                  </label>
                );
              })}
            </RadioGroup>
            <div className={styles.previewFeedback} aria-live="polite" aria-atomic="true">
              <h4>{focused ? `${focused.name}: coaching tip` : "Five guides, one worksheet"}</h4>
              <p>
                {focused?.observation ??
                  "Each guide highlights a different part of the handwriting."}
              </p>
              <p>
                <strong>Practice next: </strong>
                {focused?.next ?? "Choose one criterion to see its next step."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
