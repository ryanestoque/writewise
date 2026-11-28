"use client";

import { useId, useMemo, useCallback, useEffect, useRef, useState, memo } from "react";
import type { CriterionFilter, DiagnosticOverlayData, ActiveAnnotationHover } from "./types";
import { getAttentionItems } from "./types";
import { OVERLAY_COLORS } from "./constants";
import { PARENT_CRITERIA_METADATA, type CriterionKey } from "@/lib/utils/scoring";
import { Button } from "@/components/ui/button";
import { ButtonGroup, ButtonGroupText } from "@/components/ui/button-group";
import { Field, FieldLabel } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { Toggle } from "@/components/ui/toggle";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ChevronLeft, ChevronRight, HelpCircle, X } from "lucide-react";

const CRITERION_SHORT_LABELS: Record<CriterionKey, string> = {
  letter_formation: "Formation",
  size_consistency: "Size",
  spacing: "Spacing",
  slant: "Slant",
  baseline_alignment: "Baseline",
};

export interface CalmOverlayToolbarProps {
  overlay: DiagnosticOverlayData | null | undefined;
  activeCriterion: CriterionFilter;
  onChangeCriterion: (criterion: CriterionFilter) => void;
  visible: boolean;
  onToggleVisible: (visible: boolean) => void;
  selectedAttentionId?: string | null;
  onSelectAttentionItem?: (item: ActiveAnnotationHover | null) => void;
  showGuideLines?: boolean;
  onToggleGuideLines?: () => void;
  hasGuideLines?: boolean;
  isParentView?: boolean;
  showStepper?: boolean;
}

/**
 * Shared single-row calm diagnostic toolbar for WorksheetImageInspector.
 * Uses a floating Guide popover instead of an inline drawer to avoid shifting the worksheet.
 */
export const CalmOverlayToolbar = memo(function CalmOverlayToolbar({
  overlay,
  activeCriterion,
  onChangeCriterion,
  visible,
  onToggleVisible,
  selectedAttentionId,
  onSelectAttentionItem,
  showGuideLines = false,
  onToggleGuideLines,
  hasGuideLines = false,
  isParentView = false,
  showStepper = !isParentView,
}: CalmOverlayToolbarProps) {
  const switchId = useId();
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [debouncedAnnouncement, setDebouncedAnnouncement] = useState("");

  const attentionItems = useMemo(
    () => getAttentionItems(overlay, activeCriterion),
    [overlay, activeCriterion]
  );

  const currentIndex = useMemo(() => {
    if (!selectedAttentionId || attentionItems.length === 0) return -1;
    return attentionItems.findIndex((item) => item.id === selectedAttentionId);
  }, [selectedAttentionId, attentionItems]);

  const handlePrevAttention = useCallback(() => {
    if (attentionItems.length === 0) return;
    const nextIdx =
      currentIndex <= 0 ? attentionItems.length - 1 : currentIndex - 1;
    const nextItem = attentionItems[nextIdx];
    onSelectAttentionItem?.(nextItem);
    if (nextItem.id) {
      requestAnimationFrame(() => {
        document.getElementById(nextItem.id!)?.focus();
      });
    }
  }, [attentionItems, currentIndex, onSelectAttentionItem]);

  const handleNextAttention = useCallback(() => {
    if (attentionItems.length === 0) return;
    const nextIdx =
      currentIndex === -1 || currentIndex >= attentionItems.length - 1
        ? 0
        : currentIndex + 1;
    const nextItem = attentionItems[nextIdx];
    onSelectAttentionItem?.(nextItem);
    if (nextItem.id) {
      requestAnimationFrame(() => {
        document.getElementById(nextItem.id!)?.focus();
      });
    }
  }, [attentionItems, currentIndex, onSelectAttentionItem]);

  // Keyboard shortcuts (Alt+[ / Alt+] globally, or [ / ] when focused inside inspector)
  useEffect(() => {
    if (!showStepper || !visible || attentionItems.length <= 1) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable)
      ) {
        return;
      }

      const activeEl = document.activeElement;
      const isFocusedInInspector =
        (toolbarRef.current !== null && toolbarRef.current.contains(activeEl)) ||
        (activeEl instanceof HTMLElement &&
          (activeEl.closest('[role="region"][aria-label*="inspector"]') !== null ||
            activeEl.closest('[role="region"][aria-label*="annotations"]') !== null ||
            activeEl.closest('[aria-label*="practice area"]') !== null));

      const isPrevKey =
        (e.altKey && e.key === "[") || (e.key === "[" && isFocusedInInspector);
      const isNextKey =
        (e.altKey && e.key === "]") || (e.key === "]" && isFocusedInInspector);

      if (isPrevKey) {
        e.preventDefault();
        handlePrevAttention();
      } else if (isNextKey) {
        e.preventDefault();
        handleNextAttention();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showStepper, visible, attentionItems.length, handlePrevAttention, handleNextAttention]);

  useEffect(() => {
    if (currentIndex >= 0 && attentionItems[currentIndex]) {
      const currentItem = attentionItems[currentIndex];
      const timer = setTimeout(() => {
        setDebouncedAnnouncement(
          `Practice area ${currentIndex + 1} of ${attentionItems.length}: ${currentItem.title}. ${currentItem.note}`
        );
      }, 200);
      return () => clearTimeout(timer);
    }
    setDebouncedAnnouncement("");
  }, [currentIndex, attentionItems]);

  const marksNoun = "writing marks";
  const marksNounCap = "Writing marks";
  const fullCriterionLabel =
    activeCriterion !== "all"
      ? PARENT_CRITERIA_METADATA[activeCriterion as CriterionKey]?.label ?? activeCriterion
      : "";
  const shortCriterionLabel =
    activeCriterion !== "all"
      ? CRITERION_SHORT_LABELS[activeCriterion as CriterionKey] ?? activeCriterion
      : "";

  return (
    <div
      ref={toolbarRef}
      className="flex items-center justify-between gap-1.5 sm:gap-2 px-1.5 sm:px-2 py-1 min-h-10 sm:min-h-9 flex-nowrap w-full"
    >
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {debouncedAnnouncement}
      </div>

      {/* Left: Switch + Contextual Label / Filter Chip */}
      <Field orientation="horizontal" className="w-auto min-w-0 shrink gap-1.5 sm:gap-2">
        <Switch
          id={switchId}
          size="sm"
          checked={visible}
          onCheckedChange={onToggleVisible}
          aria-label={`Toggle ${marksNoun} overlay`}
        />

        {visible && activeCriterion !== "all" ? (
          <div className="inline-flex items-center gap-1.5 min-w-0">
            <span className="hidden sm:inline text-xs font-medium text-foreground shrink-0">
              {marksNounCap}:
            </span>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                onChangeCriterion("all");
                onSelectAttentionItem?.(null);
              }}
              className="h-auto min-h-10 sm:min-h-8 rounded-md px-2 py-1 text-xs font-medium shrink min-w-0"
              title="Filtering by this skill. Click to show all marks."
            >
              <span className="hidden sm:inline truncate max-w-[140px]">
                {fullCriterionLabel}
              </span>
              <span className="sm:hidden font-medium">{shortCriterionLabel}</span>
              <X data-icon="inline-end" className="opacity-70" aria-hidden="true" />
              <span className="sr-only">Show all marks</span>
            </Button>
          </div>
        ) : (
          <FieldLabel
            htmlFor={switchId}
            className="inline-flex items-center text-xs font-medium text-foreground cursor-pointer min-h-10 sm:min-h-8 touch-manipulation shrink-0"
          >
            <span className="hidden sm:inline">Show {marksNoun}</span>
            <span className="hidden min-[360px]:inline sm:hidden">{marksNounCap}</span>
            <span className="min-[360px]:hidden">Marks</span>
          </FieldLabel>
        )}
      </Field>

      {/* Right: Optional Focus Stepper + Paper lines toggle + Guide Popover */}
      <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
        {showStepper && visible && attentionItems.length > 1 && (
          <ButtonGroup
            aria-label="Practice areas sequential navigation stepper"
            className="items-center shrink-0"
          >
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={handlePrevAttention}
              className="size-11 md:size-7"
              aria-label="Previous practice area (Key: Alt+[ or [)"
              title="Previous practice area (Alt+[ or [)"
            >
              <ChevronLeft aria-hidden="true" />
            </Button>
            <ButtonGroupText className="h-11 md:h-7 bg-background px-2 text-xs font-semibold tabular-nums select-none">
              {currentIndex >= 0 ? currentIndex + 1 : 1}/{attentionItems.length}
            </ButtonGroupText>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={handleNextAttention}
              className="size-11 md:size-7"
              aria-label="Next practice area (Key: Alt+] or ])"
              title="Next practice area (Alt+] or ])"
            >
              <ChevronRight aria-hidden="true" />
            </Button>
          </ButtonGroup>
        )}

        {hasGuideLines && onToggleGuideLines && (
          <Toggle
            size="sm"
            variant="outline"
            pressed={showGuideLines}
            onPressedChange={onToggleGuideLines}
            className="h-auto min-h-10 sm:min-h-8 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground aria-pressed:bg-secondary aria-pressed:text-secondary-foreground aria-pressed:font-semibold shrink-0"
            title="Toggle 3-line penmanship paper guides"
          >
            <span className="hidden sm:inline">Paper lines</span>
            <span className="sm:hidden">Lines</span>
          </Toggle>
        )}

        {visible && (
          <Popover>
            <PopoverTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-auto min-h-10 sm:min-h-8 rounded-md px-1.5 sm:px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground shrink-0"
                  aria-label={`What the ${marksNoun} mean`}
                  title={`What the ${marksNoun} mean`}
                />
              }
            >
              <HelpCircle data-icon="inline-start" aria-hidden="true" />
              <span className="hidden min-[380px]:inline">Guide</span>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="w-72 max-w-[calc(100vw-2rem)] rounded-xl p-3.5 text-xs flex flex-col gap-2.5 shadow-warm border border-border"
            >
              <PopoverHeader>
                <PopoverTitle className="text-xs font-semibold text-foreground">
                  {isParentView ? "What the marks mean" : "Diagnostic guide"}
                </PopoverTitle>
              </PopoverHeader>
              <div className="flex flex-col gap-2 text-muted-foreground leading-snug">
                <div className="flex items-start gap-2">
                  <span
                    className="mt-1 size-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: OVERLAY_COLORS.consistent.stroke }}
                    aria-hidden="true"
                  />
                  <p>
                    <strong className="text-foreground font-medium">
                      {isParentView ? "Steady strokes:" : "Consistent strokes:"}
                    </strong>{" "}
                    {isParentView
                      ? "Clear letter shapes, even spacing, and smooth line placement."
                      : "Proficient letter formation, aligned baselines, proportional size, and uniform slant."}
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <span
                    className="mt-1 size-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: OVERLAY_COLORS.needs_attention.stroke }}
                    aria-hidden="true"
                  />
                  <p>
                    <strong className="text-foreground font-medium">
                      {isParentView ? "Practice spots:" : "Needs attention:"}
                    </strong>{" "}
                    {isParentView
                      ? "Areas where loops, gaps, lean, or line placement can steady with practice."
                      : "Irregularities in stroke closure, baseline drift, spacing gaps, or slant tilt (6°–15° target)."}
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <span
                    className="mt-1 size-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: OVERLAY_COLORS.guidelines.midline }}
                    aria-hidden="true"
                  />
                  <p>
                    <strong className="text-foreground font-medium">Paper lines:</strong>{" "}
                    Top, middle, and base guides showing expected letter height.
                  </p>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  );
});
