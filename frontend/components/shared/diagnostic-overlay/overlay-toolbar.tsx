"use client";

import { useState, useMemo, useCallback, useEffect, useRef, memo } from "react";
import type { CriterionFilter, DiagnosticOverlayData, ActiveAnnotationHover } from "./types";
import { getAttentionItems } from "./types";
import { OVERLAY_COLORS } from "./constants";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  Layers,
  PenTool,
  AlignJustify,
  Compass,
  Ruler,
  Maximize2,
  HelpCircle,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface OverlayToolbarProps {
  overlay: DiagnosticOverlayData | null | undefined;
  activeCriterion: CriterionFilter;
  onChangeCriterion: (criterion: CriterionFilter) => void;
  visible: boolean;
  onToggleVisible: (visible: boolean) => void;
  selectedAttentionId?: string | null;
  onSelectAttentionItem?: (item: ActiveAnnotationHover | null) => void;
  className?: string;
  variant?: "full" | "compact";
  showGuideLines?: boolean;
  onToggleGuideLines?: () => void;
  hasGuideLines?: boolean;
}

interface FilterItem {
  id: CriterionFilter;
  label: string;
  icon: typeof Layers;
}

const FILTERS: FilterItem[] = [
  {
    id: "all",
    label: "All Guides",
    icon: Layers,
  },
  {
    id: "letter_formation",
    label: "Formation",
    icon: PenTool,
  },
  {
    id: "spacing",
    label: "Spacing",
    icon: AlignJustify,
  },
  {
    id: "slant",
    label: "Slant",
    icon: Compass,
  },
  {
    id: "baseline_alignment",
    label: "Baseline",
    icon: Ruler,
  },
  {
    id: "size_consistency",
    label: "Size",
    icon: Maximize2,
  },
];

export const OverlayToolbar = memo(function OverlayToolbar({
  overlay,
  activeCriterion,
  onChangeCriterion,
  visible,
  onToggleVisible,
  selectedAttentionId,
  onSelectAttentionItem,
  className,
  variant = "full",
  showGuideLines,
  onToggleGuideLines,
  hasGuideLines,
}: OverlayToolbarProps) {
  const [showLegend, setShowLegend] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const weakest = overlay?.summary.weakest_criterion;

  const attentionCounts = useMemo<Record<CriterionFilter, number>>(() => {
    if (!overlay) {
      return {
        all: 0,
        letter_formation: 0,
        spacing: 0,
        slant: 0,
        baseline_alignment: 0,
        size_consistency: 0,
      };
    }
    return {
      all: overlay.summary.attention_item_count,
      letter_formation:
        overlay.letter_formation?.annotations?.filter(
          (a) => a.severity === "needs_attention"
        ).length ?? 0,
      spacing:
        overlay.spacing?.annotations?.filter(
          (a) => a.severity === "needs_attention"
        ).length ?? 0,
      slant:
        overlay.slant?.annotations?.filter(
          (a) => a.severity === "needs_attention"
        ).length ?? 0,
      baseline_alignment:
        overlay.baseline?.annotations?.filter(
          (a) => a.severity === "needs_attention"
        ).length ?? 0,
      size_consistency:
        overlay.size?.annotations?.filter(
          (a) => a.severity === "needs_attention"
        ).length ?? 0,
    };
  }, [overlay]);

  // Extract all attention items for current criterion
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
    onSelectAttentionItem?.(attentionItems[nextIdx]);
  }, [attentionItems, currentIndex, onSelectAttentionItem]);

  const handleNextAttention = useCallback(() => {
    if (attentionItems.length === 0) return;
    const nextIdx =
      currentIndex === -1 || currentIndex >= attentionItems.length - 1
        ? 0
        : currentIndex + 1;
    onSelectAttentionItem?.(attentionItems[nextIdx]);
  }, [attentionItems, currentIndex, onSelectAttentionItem]);

  // Keyboard shortcut navigation for stepping through attention items
  // Conforms to WCAG 2.1.4: Alt+[ and Alt+] globally, or [ and ] when inspector/toolbar has focus
  useEffect(() => {
    if (!visible || attentionItems.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable)
      ) {
        return;
      }

      // Dismiss in-situ guide legend on Escape without bubbling out of submission
      if (e.key === "Escape" && showLegend) {
        e.preventDefault();
        e.stopPropagation();
        setShowLegend(false);
        return;
      }

      const isPrevKey = (e.altKey && e.key === "[") || e.key === "[";
      const isNextKey = (e.altKey && e.key === "]") || e.key === "]";

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
  }, [visible, attentionItems.length, showLegend, handlePrevAttention, handleNextAttention]);

  const activeFilterMeta = useMemo(() => {
    return FILTERS.find((f) => f.id === activeCriterion) ?? FILTERS[0];
  }, [activeCriterion]);

  return (
    <div ref={toolbarRef} className="flex flex-col gap-1.5 min-w-0 max-w-full">
      {/* Screen reader live region for practice area navigation announcements (WCAG 4.1.3) */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {currentIndex >= 0 && attentionItems[currentIndex]
          ? `Practice area ${currentIndex + 1} of ${attentionItems.length}: ${attentionItems[currentIndex].title}. ${attentionItems[currentIndex].note}`
          : ""}
      </div>

      <div
        className={cn(
          "flex items-center justify-between gap-2 p-1.5 sm:p-2 rounded-xl bg-muted/40 border border-border/70 backdrop-blur-xs text-xs min-w-0 max-w-full",
          className
        )}
      >
        {/* 1. Filter Pills or Compact Spotlight Indicator */}
        {variant === "compact" ? (
          <div className="flex items-center gap-1.5 min-w-0 flex-1 flex-wrap">
            <div className="inline-flex items-center gap-1 bg-surface dark:bg-card px-2.5 py-1 rounded-lg border border-border/70 text-xs shadow-2xs min-w-0">
              {(() => {
                const Icon = activeFilterMeta.icon;
                return <Icon className="size-3 text-brand-700 dark:text-brand-300 shrink-0" aria-hidden="true" />;
              })()}
              <span className="font-semibold text-foreground truncate">
                {activeCriterion === "all" ? "All Guides" : `${activeFilterMeta.label} Spotlight`}
              </span>
              {attentionCounts[activeCriterion] > 0 && (
                <Badge
                  variant="secondary"
                  className="px-1.5 py-0 h-4 text-[10px] font-bold rounded-full bg-band-1/15 text-band-1-text dark:bg-band-1/25 dark:text-orange-200 border border-band-1/30 ml-0.5 shrink-0"
                >
                  <span className="sr-only">({attentionCounts[activeCriterion]} attention items)</span>
                  <span aria-hidden="true">{attentionCounts[activeCriterion]}</span>
                </Badge>
              )}
            </div>

            {activeCriterion !== "all" && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onChangeCriterion("all")}
                className="h-9 sm:h-7 min-h-[36px] sm:min-h-0 px-2.5 sm:px-2 text-xs sm:text-[11px] font-medium text-muted-foreground hover:text-foreground rounded-lg cursor-pointer transition-colors touch-manipulation focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                title="Reset to show all guides"
              >
                <X className="size-3 mr-1" aria-hidden="true" />
                <span>Show All</span>
              </Button>
            )}
          </div>
        ) : (
          <div
            role="group"
            aria-label="Worksheet diagnostic criteria filters"
            className="flex items-center gap-1 overflow-x-auto no-scrollbar scroll-smooth py-0.5 min-w-0 flex-1 sm:flex-wrap sm:overflow-visible [mask-image:linear-gradient(to_right,black_88%,transparent_100%)] sm:[mask-image:none]"
          >
            {FILTERS.map((item) => {
              const Icon = item.icon;
              const isSelected = activeCriterion === item.id;
              const count = attentionCounts[item.id] ?? 0;
              const isWeakest = weakest === item.id;

              return (
                <Button
                  key={item.id}
                  type="button"
                  variant={isSelected ? "default" : "ghost"}
                  size="sm"
                  disabled={!visible}
                  onClick={() => onChangeCriterion(item.id)}
                  aria-pressed={isSelected}
                  className={cn(
                    "shrink-0 h-10 sm:h-8 min-h-[40px] sm:min-h-[32px] px-2.5 sm:px-2 text-xs sm:text-[11px] font-medium rounded-lg gap-1.5 transition-all cursor-pointer touch-manipulation",
                    isSelected
                      ? "bg-brand-600 hover:bg-brand-700 text-white shadow-2xs font-semibold"
                      : "hover:bg-muted text-muted-foreground hover:text-foreground",
                    !visible && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <Icon className="size-3 shrink-0" aria-hidden="true" />
                  <span>{item.label}</span>
                  {isWeakest && !isSelected && count > 0 && (
                    <span
                      role="img"
                      className="size-1.5 rounded-full bg-band-1 animate-pulse motion-reduce:animate-none shrink-0"
                      title="Recommended focus area"
                      aria-label="Recommended focus area"
                    >
                      <span className="sr-only">Recommended focus area</span>
                    </span>
                  )}
                  {count > 0 && (
                    <Badge
                      variant="secondary"
                      className={cn(
                        "px-1.5 py-0 h-4 text-[10px] font-bold rounded-full",
                        isSelected
                          ? "bg-white/25 text-white"
                          : "bg-band-1/15 text-band-1-text dark:bg-band-1/25 dark:text-orange-200 border border-band-1/30"
                      )}
                    >
                      <span className="sr-only">({count} attention items)</span>
                      <span aria-hidden="true">{count}</span>
                    </Badge>
                  )}
                </Button>
              );
            })}
          </div>
        )}

        {/* 2. Sequential Attention Item Stepper, Guideline Toggle, Legend, & Master Switch */}
        <div className="flex items-center gap-1.5 pl-2 border-l border-border/60 shrink-0">
          {hasGuideLines && onToggleGuideLines && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onToggleGuideLines}
              className={cn(
                "h-10 sm:h-7 min-h-[40px] sm:min-h-0 px-2.5 sm:px-2 text-[11px] font-medium rounded-lg gap-1.5 cursor-pointer transition-colors touch-manipulation",
                showGuideLines
                  ? "bg-brand-100 text-brand-900 dark:bg-brand-950 dark:text-brand-200 font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
              title={showGuideLines ? "Hide detected 3-line penmanship guidelines" : "Show detected 3-line penmanship guidelines"}
              aria-pressed={showGuideLines}
            >
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" className="shrink-0" aria-hidden="true">
                <line x1="1" y1="4" x2="13" y2="4" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 2" />
                <line x1="1" y1="7" x2="13" y2="7" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.6" strokeDasharray="2 2" />
                <line x1="1" y1="10" x2="13" y2="10" stroke="currentColor" strokeWidth="1.5" />
              </svg>
              <span className="hidden min-[480px]:inline">Lines</span>
            </Button>
          )}
          {visible && attentionItems.length > 0 && (
            <div
              role="group"
              aria-label="Practice areas sequential navigation stepper"
              className="flex items-center gap-1 bg-background/80 dark:bg-card/80 rounded-lg px-2 py-0.5 border border-border/70 text-xs shrink-0 shadow-2xs"
            >
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider hidden min-[480px]:inline select-none">
                Focus
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={!visible}
                onClick={handlePrevAttention}
                className="relative size-10 sm:size-6 p-0 min-h-[40px] min-w-[40px] sm:min-h-[24px] sm:min-w-[24px] rounded-md hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer touch-manipulation flex items-center justify-center focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 after:absolute after:-inset-1.5 after:content-['']"
                aria-label="Previous practice area (Key: Alt+[ or [)"
                title="Previous practice area (Alt+[ or [)"
              >
                <ChevronLeft className="size-4 sm:size-3" aria-hidden="true" />
              </Button>
              <span className="tabular-nums font-semibold text-foreground px-0.5 text-[11px] select-none">
                {currentIndex >= 0 ? currentIndex + 1 : 1}
                <span className="text-muted-foreground font-normal"> / </span>
                {attentionItems.length}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={!visible}
                onClick={handleNextAttention}
                className="relative size-10 sm:size-6 p-0 min-h-[40px] min-w-[40px] sm:min-h-[24px] sm:min-w-[24px] rounded-md hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer touch-manipulation flex items-center justify-center focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 after:absolute after:-inset-1.5 after:content-['']"
                aria-label="Next practice area (Key: Alt+] or ])"
                title="Next practice area (Alt+] or ])"
              >
                <ChevronRight className="size-4 sm:size-3" aria-hidden="true" />
              </Button>
            </div>
          )}

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowLegend((prev) => !prev)}
            className={cn(
              "relative h-10 sm:h-7 min-h-[40px] sm:min-h-[28px] px-2.5 sm:px-2 text-[11px] font-medium rounded-lg gap-1 cursor-pointer transition-colors touch-manipulation focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 after:absolute after:-inset-1",
              showLegend
                ? "bg-brand-100 text-brand-900 dark:bg-brand-950 dark:text-brand-200 font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
            title="Toggle diagnostic symbols legend"
            aria-expanded={showLegend}
            aria-label="Toggle diagnostic symbols legend"
          >
            <HelpCircle className="size-3.5" aria-hidden="true" />
            <span className="hidden md:inline">Legend</span>
          </Button>

          <div className="flex items-center gap-1.5 min-h-[40px] sm:min-h-0 touch-manipulation px-0.5">
            <Switch
              id="toggle-diagnostic-overlay"
              aria-label="Toggle handwriting diagnostic overlay"
              checked={visible}
              onCheckedChange={onToggleVisible}
              className="cursor-pointer scale-90 sm:scale-75 touch-manipulation"
            />
            <Label
              htmlFor="toggle-diagnostic-overlay"
              className="text-xs sm:text-[11px] font-medium text-muted-foreground cursor-pointer select-none whitespace-nowrap hidden min-[360px]:inline"
            >
              {visible ? "Overlay on" : "Overlay off"}
            </Label>
          </div>
        </div>
      </div>

      {/* 3. In-Situ Visual Guide Legend (Collapsible) */}
      {showLegend && visible && (
        <div
          role="region"
          aria-label="Diagnostic guide legend"
          className="p-3 rounded-xl bg-card border border-border/80 shadow-warm text-xs flex flex-col gap-2 transition-all animate-in fade-in duration-150 motion-reduce:animate-none"
        >
          <div className="flex items-center justify-between pb-1 border-b border-border/50">
            <span className="font-semibold text-foreground text-xs flex items-center gap-1.5">
              <HelpCircle className="size-3.5 text-brand-600 dark:text-brand-400" aria-hidden="true" />
              <span>How to Interpret Handwriting Diagnostic Guides</span>
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowLegend(false)}
              className="relative size-10 sm:size-7 min-h-[40px] min-w-[40px] sm:min-h-[28px] sm:min-w-[28px] p-0 text-muted-foreground hover:text-foreground cursor-pointer touch-manipulation after:absolute after:-inset-1"
              aria-label="Close guide legend"
            >
              <X className="size-4 sm:size-3.5" />
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1 text-[11px]">
            <div className="flex items-start gap-2">
              <div
                className="size-3 rounded-full mt-0.5 shrink-0"
                style={{ backgroundColor: OVERLAY_COLORS.proficient.stroke }}
              />
              <div>
                <p className="font-semibold text-foreground">3-Line Penmanship Ruling</p>
                <p className="text-muted-foreground leading-snug">
                  Gray topline (headline limit), teal dotted midline (x-height limit), and solid teal baseline.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <div
                className="size-3 rounded-full mt-0.5 shrink-0"
                style={{ backgroundColor: OVERLAY_COLORS.consistent.stroke }}
              />
              <div>
                <p className="font-semibold text-foreground">Consistent Strokes (Green / Teal)</p>
                <p className="text-muted-foreground leading-snug">
                  Proficient formation, aligned baselines, proportional size, and uniform slant angles.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <div
                className="size-3 rounded-full mt-0.5 shrink-0"
                style={{ backgroundColor: OVERLAY_COLORS.needs_attention.stroke }}
              />
              <div>
                <p className="font-semibold text-foreground">Practice Areas (Terracotta)</p>
                <p className="text-muted-foreground leading-snug">
                  Identified irregularities in stroke closure, baseline drift, spacing gaps, or slant tilt.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
