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

type CriterionItem = (typeof EXAMPLE_CRITERIA)[number];

function CoachingContent({
  item,
  annotation,
  isAnnotationTarget,
}: {
  item: CriterionItem;
  annotation: ActiveAnnotationHover | null;
  isAnnotationTarget: boolean;
}) {
  const band = getScoreBandLabel(item.score, { source: "calibrated" });
  const bandKey = band.band === "Needs Improvement" ? "needs" : band.band.toLowerCase();
  const showAnnotation = Boolean(annotation && isAnnotationTarget);

  return (
    <>
      <div className={styles.studioCoachingHead}>
        <span className={styles.studioCoachingTitle}>
          {showAnnotation && annotation ? `${annotation.title} details` : `${item.name} feedback`}
        </span>
        <span
          className={styles.band}
          data-band={
            showAnnotation && annotation
              ? annotation.severity === "needs_attention"
                ? "needs"
                : "excellent"
              : bandKey
          }
        >
          <span className={styles.bandDot} aria-hidden="true" />
          {showAnnotation && annotation
            ? annotation.severity === "needs_attention"
              ? "Needs Attention"
              : "Consistent"
            : `${item.score}% · ${band.band}`}
        </span>
      </div>
      <dl className={styles.studioCoachingGrid}>
        <div>
          <dt>{showAnnotation ? "Selected stroke observation" : "What we see"}</dt>
          <dd>{showAnnotation && annotation ? annotation.note : item.observation}</dd>
        </div>
        <div>
          <dt>Practice next</dt>
          <dd>{item.next}</dd>
        </div>
      </dl>
    </>
  );
}

/** Interactive hero worksheet studio with local sample data; never calls a submission API. */
export function AssessmentPreview() {
  const criterionId = useId();
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [criterion, setCriterion] = useState<CriterionItem["id"]>("spacing");
  const [mobileExpanded, setMobileExpanded] = useState<string | null>("spacing");
  const [showOverlay, setShowOverlay] = useState(true);
  const [annotation, setAnnotation] = useState<ActiveAnnotationHover | null>(null);
  const focused = EXAMPLE_CRITERIA.find((item) => item.id === criterion) ?? EXAMPLE_CRITERIA[2];

  const selectCriterion = (next: string) => {
    const selected = EXAMPLE_CRITERIA.find((item) => item.id === next);
    if (!selected) return;
    setCriterion(selected.id);
    setMobileExpanded(selected.id);
    setAnnotation(null);
    setShowOverlay(true);
  };

  const handleCriterionClick = (id: CriterionItem["id"]) => {
    if (criterion === id) {
      // Toggle accordion open/closed on mobile if clicking the active criterion
      setMobileExpanded((prev) => (prev === id ? null : id));
    } else {
      setCriterion(id);
      setMobileExpanded(id);
      setAnnotation(null);
      setShowOverlay(true);
    }
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
        <WorksheetImageInspector
          imageUrl={EXAMPLE_WORKSHEET}
          imageDimensions={EXAMPLE_WORKSHEET_DIMENSIONS}
          headerLabel=""
          altText="Cursive worksheet showing 'kites fly high' with crowded then wide word spacing."
          showShortcutsLegend={false}
          keyboardScope="focused"
          showImageTools={false}
          autoAspectRatio={false}
          aspectRatioClass="aspect-[62/34]"
        >
          <span className={styles.studioViewerPaperCaption}>
            Illustrative handwriting — no student data
          </span>
          <DiagnosticOverlay
            overlay={EXAMPLE_OVERLAY}
            imageUrl={EXAMPLE_WORKSHEET}
            imageDimensions={EXAMPLE_WORKSHEET_DIMENSIONS}
            activeCriterion={criterion}
            visible={showOverlay}
            selectedAnnotation={annotation}
            onSelectAnnotation={(selectedAnn) => {
              setAnnotation(selectedAnn);
              if (selectedAnn) {
                setMobileExpanded(criterion);
              }
            }}
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
          role="region"
          aria-labelledby={`${criterionId}-heading`}
          className={styles.studioCriteriaGrid}
        >
          {EXAMPLE_CRITERIA.map((item, index) => {
            const band = getScoreBandLabel(item.score, { source: "calibrated" });
            const isSelected = item.id === criterion;
            const isExpanded = isSelected && mobileExpanded === item.id;
            const panelId = `${criterionId}-${item.id}-panel`;
            const buttonId = `${criterionId}-${item.id}-button`;

            return (
              <div
                key={item.id}
                className={styles.studioAccordionItem}
                data-selected={isSelected}
                data-expanded={isExpanded}
              >
                <button
                  ref={(el) => {
                    buttonRefs.current[index] = el;
                  }}
                  id={buttonId}
                  type="button"
                  aria-expanded={isExpanded}
                  aria-controls={panelId}
                  aria-label={`${item.name}, ${item.score}%, ${band.band}`}
                  tabIndex={isSelected ? 0 : -1}
                  onClick={() => handleCriterionClick(item.id)}
                  onKeyDown={(e) => onCriterionKeyDown(e, index)}
                  className={styles.studioCriterionTrigger}
                  data-selected={isSelected}
                >
                  <span className={styles.studioCriterionName}>{item.name}</span>
                  <div className={styles.studioCriterionMeta}>
                    <span className={styles.studioCriterionScore}>{item.score}%</span>
                    <svg
                      viewBox="0 0 20 20"
                      aria-hidden="true"
                      className={styles.studioAccordionChevron}
                    >
                      <path
                        d="M5 7.5L10 12.5L15 7.5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                </button>

                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={buttonId}
                  className={styles.studioAccordionPanel}
                  data-expanded={isExpanded}
                  aria-hidden={!isExpanded}
                >
                  <div className={styles.studioAccordionContent}>
                    <div className={styles.studioAccordionBody}>
                      <CoachingContent
                        item={item}
                        annotation={annotation}
                        isAnnotationTarget={isSelected}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Desktop-only dedicated feedback card (hidden on mobile via CSS) */}
        <div
          className={styles.studioCoachingDesktop}
          aria-live="polite"
          aria-atomic="true"
        >
          <CoachingContent
            item={focused}
            annotation={annotation}
            isAnnotationTarget={true}
          />
        </div>
      </div>
    </div>
  );
}
