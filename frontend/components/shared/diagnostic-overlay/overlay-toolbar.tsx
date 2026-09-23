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
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
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
  ChevronDown,
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
  shortLabel?: string;
  icon: typeof Layers;
}

const FILTERS: FilterItem[] = [
  {
    id: "all",
    label: "All Guides",
    shortLabel: "All",
    icon: Layers,
  },
  {
    id: "letter_formation",
    label: "Formation",
    shortLabel: "Formation",
    icon: PenTool,
  },
  {
    id: "spacing",
    label: "Spacing",
    shortLabel: "Spacing",
    icon: AlignJustify,
  },
  {
    id: "slant",
    label: "Slant",
    shortLabel: "Slant",
    icon: Compass,
  },
  {
    id: "baseline_alignment",
    label: "Baseline",
    shortLabel: "Baseline",
    icon: Ruler,
  },
  {
    id: "size_consistency",
    label: "Size",
    shortLabel: "Size",
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
  const filterScrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const weakest = overlay?.summary.weakest_criterion;

  const rafIdRef = useRef<number | null>(null);

  const updateScrollState = useCallback(() => {
    const el = filterScrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  const handleResize = useCallback(() => {
    if (rafIdRef.current !== null) return;
    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = null;
      updateScrollState();
    });
  }, [updateScrollState]);

  useEffect(() => {
    const el = filterScrollRef.current;
    if (!el) return;
    updateScrollState();
    el.addEventListener("scroll", updateScrollState, { passive: true });
    window.addEventListener("resize", handleResize);
    return () => {
      el.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", handleResize);
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [updateScrollState, handleResize]);

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
    const letter_formation =
      overlay.letter_formation?.annotations?.filter(
        (a) => a.severity === "needs_attention"
      ).length ?? 0;
    const spacing =
      overlay.spacing?.annotations?.filter(
        (a) => a.severity === "needs_attention"
      ).length ?? 0;
    const slant =
      overlay.slant?.annotations?.filter(
        (a) => a.severity === "needs_attention"
      ).length ?? 0;
    const baseline_alignment =
      overlay.baseline?.annotations?.filter(
        (a) => a.severity === "needs_attention"
      ).length ?? 0;
    const size_consistency =
      overlay.size?.annotations?.filter(
        (a) => a.severity === "needs_attention"
      ).length ?? 0;
    const total =
      letter_formation + spacing + slant + baseline_alignment + size_consistency;

    return {
      all: total > 0 ? total : overlay.summary.attention_item_count,
      letter_formation,
      spacing,
      slant,
      baseline_alignment,
      size_consistency,
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
    const nextItem = attentionItems[nextIdx];
    onSelectAttentionItem?.(nextItem);
    if (nextItem.id) {
      requestAnimationFrame(() => {
        const el = document.getElementById(nextItem.id!);
        el?.focus();
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
        const el = document.getElementById(nextItem.id!);
        el?.focus();
      });
    }
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

      // Conforms to WCAG 2.1.4: Alt+[ and Alt+] globally, or [ and ] when inspector/toolbar has focus
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
  }, [visible, attentionItems.length, showLegend, handlePrevAttention, handleNextAttention]);

  const [debouncedAnnouncement, setDebouncedAnnouncement] = useState("");

  useEffect(() => {
    if (currentIndex >= 0 && attentionItems[currentIndex]) {
      const currentItem = attentionItems[currentIndex];
      const timer = setTimeout(() => {
        setDebouncedAnnouncement(
          `Practice area ${currentIndex + 1} of ${attentionItems.length}: ${currentItem.title}. ${currentItem.note}`
        );
      }, 200);
      return () => clearTimeout(timer);
    } else {
      setDebouncedAnnouncement("");
    }
  }, [currentIndex, attentionItems]);

  const activeFilterMeta = useMemo(() => {
    return FILTERS.find((f) => f.id === activeCriterion) ?? FILTERS[0];
  }, [activeCriterion]);

  const hasSecondaryControls =
    (visible && attentionItems.length > 0) ||
    (hasGuideLines && Boolean(onToggleGuideLines)) ||
    visible;

  return (
    <div ref={toolbarRef} className="flex flex-col gap-1.5 min-w-0 max-w-full">
      {/* Screen reader live region for practice area navigation announcements (WCAG 4.1.3) */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {debouncedAnnouncement}
      </div>

      <div
        className={cn(
          "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 sm:gap-2 p-1.5 sm:p-2 rounded-xl bg-muted/40 border border-border/70 backdrop-blur-xs text-xs min-w-0 max-w-full",
          className
        )}
      >
        {/* Tier 1 / Primary Controls: Rubric Selector (+ Reset) + Mobile Master Switch */}
        <div className="flex items-center justify-between gap-1.5 min-w-0 w-full sm:w-auto sm:flex-1">
          {variant === "compact" ? (
            <div className="flex items-center gap-1.5 min-w-0 flex-1 sm:flex-initial">
              <DropdownMenu>
                <DropdownMenuTrigger
                  disabled={!visible}
                  className={cn(
                    "inline-flex items-center gap-1.5 bg-surface dark:bg-card px-2.5 py-1.5 sm:py-1 rounded-lg border border-border/70 text-xs shadow-2xs min-w-0 shrink-0 sm:shrink cursor-pointer hover:bg-muted/70 transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring touch-manipulation",
                    !visible && "opacity-50 cursor-not-allowed"
                  )}
                  aria-label={`Current guide: ${activeCriterion === "all" ? "All Guides" : activeFilterMeta.label}. Click to select a diagnostic criterion.`}
                  title={visible ? "Select diagnostic criterion" : "Overlay is turned off"}
                >
                  {(() => {
                    const Icon = activeFilterMeta.icon;
                    return <Icon className="size-3 text-brand-700 dark:text-brand-300 shrink-0" aria-hidden="true" />;
                  })()}
                  <span className="font-semibold text-foreground truncate max-w-[160px] sm:max-w-none">
                    {activeCriterion === "all" ? "All Guides" : activeFilterMeta.label}
                  </span>
                  {attentionCounts[activeCriterion] > 0 && (
                    <Badge
                      variant="secondary"
                      className="px-1.5 py-0 h-4 text-[10px] font-bold rounded-full bg-band-1/15 text-band-1-text dark:bg-band-1/25 dark:text-destructive border border-band-1/30 ml-0.5 shrink-0"
                    >
                      <span className="sr-only">({attentionCounts[activeCriterion]} attention items)</span>
                      <span aria-hidden="true">{attentionCounts[activeCriterion]}</span>
                    </Badge>
                  )}
                  <ChevronDown className="size-3 text-muted-foreground shrink-0 ml-0.5 opacity-70" aria-hidden="true" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56 p-1 text-xs">
                  {FILTERS.map((item) => {
                    const ItemIcon = item.icon;
                    const isSelected = activeCriterion === item.id;
                    const count = attentionCounts[item.id] ?? 0;
                    return (
                      <DropdownMenuItem
                        key={item.id}
                        onClick={() => onChangeCriterion(item.id)}
                        className={cn(
                          "flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md cursor-pointer text-xs",
                          isSelected && "bg-brand-50 dark:bg-brand-950/60 font-semibold text-brand-900 dark:text-brand-200"
                        )}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <ItemIcon className="size-3.5 text-brand-700 dark:text-brand-300 shrink-0" aria-hidden="true" />
                          <span className="truncate">{item.label}</span>
                        </div>
                        {count > 0 && (
                          <Badge
                            variant="secondary"
                            className={cn(
                              "px-1.5 py-0 h-4 text-[10px] font-bold rounded-full",
                              isSelected
                                ? "bg-brand-200/60 text-brand-900 dark:bg-brand-900 dark:text-brand-200"
                                : "bg-band-1/15 text-band-1-text dark:bg-band-1/25 dark:text-destructive border border-band-1/30"
                            )}
                          >
                            {count}
                          </Badge>
                        )}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>

              {activeCriterion !== "all" && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onChangeCriterion("all")}
                  className="h-8 sm:h-7 px-2 text-xs sm:text-[11px] font-medium text-muted-foreground hover:text-foreground rounded-lg cursor-pointer transition-colors touch-manipulation shrink-0 flex items-center justify-center gap-1"
                  title="Reset to show all guides"
                  aria-label="Reset to show all guides"
                >
                  <X className="size-3.5 sm:size-3" aria-hidden="true" />
                  <span className="hidden sm:inline">Show All</span>
                </Button>
              )}
            </div>
          ) : (
            <div className="relative min-w-0 flex-1 flex items-center">
              {canScrollLeft && (
                <button
                  type="button"
                  onClick={() => {
                    filterScrollRef.current?.scrollBy({ left: -80, behavior: "smooth" });
                  }}
                  aria-label="Scroll to see earlier criteria filters"
                  className="sm:hidden absolute left-0 z-10 flex size-8 min-h-[40px] min-w-[40px] items-center justify-center rounded-full bg-background/95 text-muted-foreground shadow-xs border border-border/70 hover:text-foreground active:scale-95 transition-transform cursor-pointer touch-manipulation after:absolute after:-inset-1 after:content-['']"
                >
                  <ChevronLeft className="size-4" aria-hidden="true" />
                </button>
              )}

              <div
                ref={filterScrollRef}
                role="group"
                aria-label="Worksheet diagnostic criteria filters"
                className={cn(
                  "flex items-center gap-1 overflow-x-auto no-scrollbar scroll-smooth py-0.5 min-w-0 flex-1 sm:flex-wrap sm:overflow-visible transition-[mask-image]",
                  canScrollLeft && canScrollRight
                    ? "[mask-image:linear-gradient(to_right,transparent,black_14px,black_calc(100%-14px),transparent)] sm:[mask-image:none]"
                    : canScrollRight
                      ? "[mask-image:linear-gradient(to_right,black_86%,transparent_100%)] sm:[mask-image:none]"
                      : canScrollLeft
                        ? "[mask-image:linear-gradient(to_left,black_86%,transparent_100%)] sm:[mask-image:none]"
                        : "sm:[mask-image:none]"
                )}
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
                        "shrink-0 h-9 sm:h-8 px-2.5 sm:px-2 text-xs sm:text-[11px] font-medium rounded-lg gap-1.5 transition-all cursor-pointer touch-manipulation",
                        isSelected
                          ? "bg-brand-600 hover:bg-brand-700 text-white shadow-2xs font-semibold"
                          : "hover:bg-muted text-muted-foreground hover:text-foreground",
                        !visible && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <Icon className="size-3 shrink-0" aria-hidden="true" />
                      <span className="hidden min-[400px]:inline">{item.label}</span>
                      <span className="min-[400px]:hidden">{item.shortLabel ?? item.label}</span>
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
                              : "bg-band-1/15 text-band-1-text dark:bg-band-1/25 dark:text-destructive border border-band-1/30"
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

              {canScrollRight && (
                <button
                  type="button"
                  onClick={() => {
                    filterScrollRef.current?.scrollBy({ left: 80, behavior: "smooth" });
                  }}
                  aria-label="Scroll to see more criteria filters"
                  className="sm:hidden absolute right-0 z-10 flex size-8 min-h-[40px] min-w-[40px] items-center justify-center rounded-full bg-background/95 text-muted-foreground shadow-xs border border-border/70 hover:text-foreground active:scale-95 transition-transform cursor-pointer touch-manipulation after:absolute after:-inset-1 after:content-['']"
                >
                  <ChevronRight className="size-4" aria-hidden="true" />
                </button>
              )}
            </div>
          )}

          {/* Master Switch on Mobile (aligned to the right on Row 1) */}
          <div className="flex sm:hidden items-center gap-1.5 shrink-0 pl-1">
            <Switch
              id="toggle-diagnostic-overlay-mobile"
              aria-label="Toggle handwriting diagnostic overlay"
              checked={visible}
              onCheckedChange={onToggleVisible}
              className="cursor-pointer scale-85 touch-manipulation"
            />
          </div>
        </div>

        {/* Tier 2 / Secondary Controls: Stepper, Guideline Toggle, Legend, & Desktop Switch */}
        {hasSecondaryControls && (
          <div className="flex items-center justify-between sm:justify-end gap-1.5 pt-1.5 sm:pt-0 border-t border-border/50 sm:border-t-0 sm:pl-2 sm:border-l sm:border-border/60 w-full sm:w-auto shrink-0">
            {/* Sequential Practice Area Stepper */}
            {visible && attentionItems.length > 0 ? (
              <div
                role="group"
                aria-label="Practice areas sequential navigation stepper"
                className="flex items-center gap-1 bg-background/80 dark:bg-card/80 rounded-lg px-2 py-0.5 border border-border/70 text-xs shrink-0 shadow-2xs"
              >
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider hidden lg:inline select-none">
                  Focus
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={!visible}
                  onClick={handlePrevAttention}
                  className="relative size-8 sm:size-7 p-0 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer touch-manipulation flex items-center justify-center focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 after:absolute after:-inset-1.5 after:content-['']"
                  aria-label="Previous practice area (Key: Alt+[ or [)"
                  title="Previous practice area (Alt+[ or [)"
                >
                  <ChevronLeft className="size-4 sm:size-3" aria-hidden="true" />
                </Button>
                <span className="tabular-nums font-semibold text-foreground px-1 text-[11px] select-none">
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
                  className="relative size-8 sm:size-7 p-0 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer touch-manipulation flex items-center justify-center focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 after:absolute after:-inset-1.5 after:content-['']"
                  aria-label="Next practice area (Key: Alt+] or ])"
                  title="Next practice area (Alt+] or ])"
                >
                  <ChevronRight className="size-4 sm:size-3" aria-hidden="true" />
                </Button>
              </div>
            ) : (
              <div className="sm:hidden" />
            )}

            {/* Utility buttons (Lines & Legend) + Desktop Switch */}
            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
              {hasGuideLines && onToggleGuideLines && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onToggleGuideLines}
                  className={cn(
                    "h-8 sm:h-7 px-2.5 sm:px-2 text-[11px] font-medium rounded-lg gap-1.5 cursor-pointer transition-colors touch-manipulation",
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
                  <span className="hidden xl:inline">Lines</span>
                </Button>
              )}

              {visible && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowLegend((prev) => !prev)}
                  className={cn(
                    "relative h-8 sm:h-7 px-2 text-[11px] font-medium rounded-lg gap-1 cursor-pointer transition-colors touch-manipulation focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 after:absolute after:-inset-1",
                    showLegend
                      ? "bg-brand-100 text-brand-900 dark:bg-brand-950 dark:text-brand-200 font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  title="Toggle diagnostic symbols legend"
                  aria-expanded={showLegend}
                  aria-label="Toggle diagnostic symbols legend"
                >
                  <HelpCircle className="size-3.5" aria-hidden="true" />
                  <span className="hidden xl:inline">Legend</span>
                </Button>
              )}

              {/* Desktop Switch with Label */}
              <div className="hidden sm:flex items-center gap-1.5 pl-2 border-l border-border/60 shrink-0">
                <Switch
                  id="toggle-diagnostic-overlay-desktop"
                  aria-label="Toggle handwriting diagnostic overlay"
                  checked={visible}
                  onCheckedChange={onToggleVisible}
                  className="cursor-pointer scale-90 sm:scale-75 touch-manipulation"
                />
                <Label
                  htmlFor="toggle-diagnostic-overlay-desktop"
                  className="text-xs sm:text-[11px] font-medium text-muted-foreground cursor-pointer select-none whitespace-nowrap hidden xl:inline"
                >
                  {visible ? "Overlay on" : "Overlay off"}
                </Label>
              </div>
            </div>
          </div>
        )}
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
              <div className="flex size-4 items-center justify-center rounded-xs bg-muted/60 border border-border/70 mt-0.5 shrink-0 p-0.5">
                <svg width="12" height="12" viewBox="0 0 14 14" fill="none" className="shrink-0" aria-hidden="true">
                  <line x1="1" y1="3" x2="13" y2="3" stroke={OVERLAY_COLORS.guidelines.topline} strokeWidth="1.5" strokeDasharray="3 2" />
                  <line x1="1" y1="7" x2="13" y2="7" stroke={OVERLAY_COLORS.guidelines.midline} strokeWidth="1.5" strokeDasharray="2 2" />
                  <line x1="1" y1="11" x2="13" y2="11" stroke={OVERLAY_COLORS.guidelines.baseline} strokeWidth="1.5" />
                </svg>
              </div>
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
