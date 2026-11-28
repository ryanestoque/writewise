"use client";

import { useState, useMemo, useCallback, useEffect, useRef, memo } from "react";
import type { CriterionFilter, DiagnosticOverlayData, ActiveAnnotationHover } from "./types";
import { getAttentionItems } from "./types";
import { OVERLAY_COLORS } from "./constants";
import { Button } from "@/components/ui/button";
import { ButtonGroup, ButtonGroupText } from "@/components/ui/button-group";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Field, FieldLabel } from "@/components/ui/field";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
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
  hideCriterionSelectorOnMobile?: boolean;
  isParentView?: boolean;
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
  hideCriterionSelectorOnMobile = false,
  isParentView = false,
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

  const filterToggleItems = FILTERS.map((item) => {
    const Icon = item.icon;
    const isSelected = activeCriterion === item.id;
    const count = attentionCounts[item.id] ?? 0;
    const isWeakest = weakest === item.id;

    return (
      <ToggleGroupItem
        key={item.id}
        value={item.id}
        size="sm"
        disabled={!visible}
        className={cn(
          "shrink-0 h-11 @min-[540px]:h-8 min-h-11 @min-[540px]:min-h-0 px-2.5 @min-[540px]:px-2 text-xs @min-[540px]:text-xs font-medium rounded-lg gap-1.5 transition-colors",
          isSelected
            ? "bg-primary hover:bg-primary-hover text-primary-foreground aria-pressed:bg-primary aria-pressed:text-primary-foreground shadow-2xs font-semibold"
            : "hover:bg-muted text-muted-foreground hover:text-foreground"
        )}
      >
        <Icon data-icon="inline-start" aria-hidden="true" />
        <span className="hidden @min-[400px]:inline">{item.label}</span>
        <span className="inline @min-[400px]:hidden">{item.shortLabel ?? item.label}</span>
        {isWeakest && !isSelected && count > 0 && (
          <span
            role="img"
            className="size-1.5 rounded-full bg-band-1 shrink-0"
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
                ? "bg-primary-foreground/20 text-primary-foreground"
                : "bg-band-1/15 text-band-1-text border border-band-1/30"
            )}
          >
            <span className="sr-only">({count} attention items)</span>
            <span aria-hidden="true">{count}</span>
          </Badge>
        )}
      </ToggleGroupItem>
    );
  });

  return (
    <Collapsible
      open={showLegend && visible}
      onOpenChange={(next) => {
        if (visible) setShowLegend(next);
      }}
      ref={toolbarRef}
      className="@container flex flex-col gap-1.5 min-w-0 max-w-full"
    >
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
          "flex flex-col @min-[540px]:flex-row @min-[540px]:items-center @min-[540px]:justify-between gap-1.5 @min-[540px]:gap-2 p-1.5 @min-[540px]:p-2 rounded-xl bg-muted/40 border border-border/70 backdrop-blur-xs text-xs min-w-0 max-w-full",
          className
        )}
      >
        {/* Tier 1 / Primary Controls: Rubric Selector (+ Reset) + Mobile/Compact Master Switch */}
        <div className="flex items-center justify-between gap-1.5 min-w-0 w-full @min-[540px]:w-auto @min-[540px]:flex-1">
          {variant === "compact" ? (
            <>
              {hideCriterionSelectorOnMobile && (
                <span className="lg:hidden text-xs font-semibold text-foreground truncate">
                  {isParentView
                    ? visible
                      ? "Writing marks on"
                      : "Writing marks off"
                    : visible
                      ? "Diagnostic lines on"
                      : "Diagnostic lines off"}
                </span>
              )}
              <div
                className={cn(
                  "items-center gap-1.5 min-w-0 flex-1 @min-[540px]:flex-initial",
                  hideCriterionSelectorOnMobile ? "hidden lg:flex" : "flex"
                )}
              >
              <DropdownMenu>
                <DropdownMenuTrigger
                  disabled={!visible}
                  render={
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="min-h-11 @min-[540px]:min-h-7 h-auto py-1.5 @min-[540px]:py-1 min-w-0 shrink-0 text-xs"
                      aria-label={`Current guide: ${activeCriterion === "all" ? "All Guides" : activeFilterMeta.label}. Click to select a diagnostic criterion.`}
                      title={visible ? "Select diagnostic criterion" : "Overlay is turned off"}
                    />
                  }
                >
                  {(() => {
                    const Icon = activeFilterMeta.icon;
                    return <Icon data-icon="inline-start" className="text-primary" aria-hidden="true" />;
                  })()}
                  <span className="font-semibold text-foreground truncate min-w-0 max-w-[120px] @min-[380px]:max-w-[160px] @min-[600px]:max-w-none">
                    {activeCriterion === "all" ? "All Guides" : activeFilterMeta.label}
                  </span>
                  {attentionCounts[activeCriterion] > 0 && (
                    <Badge
                      variant="secondary"
                      className="px-1.5 py-0 h-4 text-[10px] font-bold tabular-nums rounded-full bg-band-1/15 text-band-1-text border border-band-1/30 shrink-0"
                    >
                      <span className="sr-only">({attentionCounts[activeCriterion]} attention items)</span>
                      <span aria-hidden="true">{attentionCounts[activeCriterion]}</span>
                    </Badge>
                  )}
                  <ChevronDown data-icon="inline-end" className="text-muted-foreground opacity-70" aria-hidden="true" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56 p-1 text-xs">
                  <DropdownMenuGroup>
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
                            isSelected && "bg-secondary font-semibold text-secondary-foreground"
                          )}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <ItemIcon className="text-primary shrink-0" aria-hidden="true" />
                            <span className="truncate">{item.label}</span>
                          </div>
                          {count > 0 && (
                            <Badge
                              variant="secondary"
                              className={cn(
                                "px-1.5 py-0 h-4 text-[10px] font-bold rounded-full",
                                isSelected
                                  ? "bg-primary/15 text-primary"
                                  : "bg-band-1/15 text-band-1-text border border-band-1/30"
                              )}
                            >
                              {count}
                            </Badge>
                          )}
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>

              {activeCriterion !== "all" && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onChangeCriterion("all")}
                  className="h-11 @min-[540px]:h-7 min-h-11 @min-[540px]:min-h-0 px-2.5 @min-[540px]:px-2 text-xs @min-[540px]:text-xs font-medium text-muted-foreground hover:text-foreground shrink-0"
                  title="Reset to show all guides"
                  aria-label="Reset to show all guides"
                >
                  <X data-icon="inline-start" aria-hidden="true" />
                  <span className="hidden @min-[380px]:inline">Show All</span>
                </Button>
              )}
            </div>
            </>
          ) : (
            <div className="min-w-0 flex-1">
              <ScrollArea
                orientation="horizontal"
                hideScrollbar
                className="w-full min-w-0 @min-[640px]:hidden"
              >
                <ToggleGroup
                  value={[activeCriterion]}
                  multiple={false}
                  spacing={1}
                  disabled={!visible}
                  onValueChange={(vals) => {
                    if (vals.length > 0) {
                      onChangeCriterion(vals[0] as CriterionFilter);
                    }
                  }}
                  aria-label="Worksheet diagnostic criteria filters"
                  className="flex w-max items-center gap-1"
                >
                  {filterToggleItems}
                </ToggleGroup>
              </ScrollArea>

              <ToggleGroup
                value={[activeCriterion]}
                multiple={false}
                spacing={1}
                disabled={!visible}
                onValueChange={(vals) => {
                  if (vals.length > 0) {
                    onChangeCriterion(vals[0] as CriterionFilter);
                  }
                }}
                aria-label="Worksheet diagnostic criteria filters"
                className="hidden @min-[640px]:flex flex-wrap items-center gap-1"
              >
                {filterToggleItems}
              </ToggleGroup>
            </div>
          )}

          {/* Master Switch on Compact / Row-1 layout (aligned to the right on Row 1) */}
          <div className="flex @min-[540px]:hidden items-center justify-center gap-1.5 shrink-0 pl-1 min-h-11 min-w-11">
            <Switch
              id="toggle-diagnostic-overlay-mobile"
              aria-label={isParentView ? "Toggle writing marks on worksheet" : "Toggle handwriting diagnostic overlay"}
              checked={visible}
              onCheckedChange={onToggleVisible}
              className="cursor-pointer touch-manipulation"
            />
          </div>
        </div>

        {/* Tier 2 / Secondary Controls: Stepper, Guideline Toggle, Legend, & Expanded Switch */}
        {hasSecondaryControls && (
          <>
            <Separator orientation="horizontal" className="@min-[540px]:hidden" />
            <Separator orientation="vertical" className="hidden @min-[540px]:block h-5" />
            <div className="flex items-center justify-between @min-[540px]:justify-end gap-1.5 w-full @min-[540px]:w-auto shrink-0 min-w-0">
              {/* Sequential Practice Area Stepper */}
              {visible && attentionItems.length > 0 ? (
                <ButtonGroup
                  aria-label="Practice areas sequential navigation stepper"
                  className="items-center shrink-0"
                >
                  <ButtonGroupText className="hidden @min-[600px]:flex h-8 @min-[540px]:h-7 bg-background px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider select-none">
                    Focus
                  </ButtonGroupText>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    disabled={!visible}
                    onClick={handlePrevAttention}
                    className="size-11 md:size-7"
                    aria-label="Previous practice area (Key: Alt+[ or [)"
                    title="Previous practice area (Alt+[ or [)"
                  >
                    <ChevronLeft aria-hidden="true" />
                  </Button>
                  <ButtonGroupText className="h-11 md:h-7 bg-background px-2 text-xs font-semibold tabular-nums select-none">
                    {currentIndex >= 0 ? currentIndex + 1 : 1}
                    <span className="text-muted-foreground font-normal">/</span>
                    {attentionItems.length}
                  </ButtonGroupText>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    disabled={!visible}
                    onClick={handleNextAttention}
                    className="size-11 md:size-7"
                    aria-label="Next practice area (Key: Alt+] or ])"
                    title="Next practice area (Alt+] or ])"
                  >
                    <ChevronRight aria-hidden="true" />
                  </Button>
                </ButtonGroup>
              ) : (
                <div className="@min-[540px]:hidden" />
              )}

              {/* Utility buttons (Lines & Legend) + Expanded Switch */}
              <div className="flex items-center gap-1 @min-[540px]:gap-1.5 shrink-0">
                {hasGuideLines && onToggleGuideLines && (
                  <Toggle
                    variant="outline"
                    size="sm"
                    pressed={Boolean(showGuideLines)}
                    onPressedChange={() => onToggleGuideLines()}
                    className="h-11 @min-[540px]:h-7 min-h-11 @min-[540px]:min-h-0 px-2.5 @min-[540px]:px-2 text-xs @min-[540px]:text-xs font-medium rounded-lg gap-1.5 aria-pressed:bg-secondary aria-pressed:text-secondary-foreground aria-pressed:border-primary/30 aria-pressed:font-semibold"
                    title={showGuideLines ? "Hide detected 3-line penmanship guidelines" : "Show detected 3-line penmanship guidelines"}
                  >
                    <svg data-icon="inline-start" width="13" height="13" viewBox="0 0 14 14" fill="none" className="shrink-0" aria-hidden="true">
                      <line x1="1" y1="4" x2="13" y2="4" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 2" />
                      <line x1="1" y1="7" x2="13" y2="7" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.6" strokeDasharray="2 2" />
                      <line x1="1" y1="10" x2="13" y2="10" stroke="currentColor" strokeWidth="1.5" />
                    </svg>
                    <span className="hidden @min-[420px]:inline">Lines</span>
                  </Toggle>
                )}

                {visible && (
                  <CollapsibleTrigger
                    render={
                      <Button
                        type="button"
                        variant={showLegend ? "secondary" : "ghost"}
                        size="sm"
                        className="h-11 @min-[540px]:h-7 min-h-11 @min-[540px]:min-h-0 px-2.5 @min-[540px]:px-2 text-xs @min-[540px]:text-xs font-medium rounded-lg"
                        title="Toggle diagnostic symbols legend"
                        aria-label="Toggle diagnostic symbols legend"
                      />
                    }
                  >
                    <HelpCircle data-icon="inline-start" aria-hidden="true" />
                    <span className="hidden @min-[420px]:inline">Legend</span>
                  </CollapsibleTrigger>
                )}

                <Separator orientation="vertical" className="hidden @min-[540px]:block h-5" />

                {/* Expanded Switch with Label */}
                <Field orientation="horizontal" className="hidden @min-[540px]:flex w-auto items-center gap-1.5 shrink-0">
                  <Switch
                    id="toggle-diagnostic-overlay-desktop"
                    size="sm"
                    aria-label={isParentView ? "Toggle writing marks on worksheet" : "Toggle handwriting diagnostic overlay"}
                    checked={visible}
                    onCheckedChange={onToggleVisible}
                    className="cursor-pointer touch-manipulation"
                  />
                  <FieldLabel
                    htmlFor="toggle-diagnostic-overlay-desktop"
                    className="text-xs font-medium text-muted-foreground cursor-pointer select-none whitespace-nowrap inline"
                  >
                    {isParentView
                      ? visible
                        ? "Writing marks on"
                        : "Writing marks off"
                      : visible
                        ? "Overlay on"
                        : "Overlay off"}
                  </FieldLabel>
                </Field>
              </div>
            </div>
          </>
        )}
      </div>

      {/* 3. In-Situ Visual Guide Legend (Collapsible) */}
      <CollapsibleContent>
        <div
          role="region"
          aria-label={isParentView ? "Writing marks guide" : "Diagnostic guide legend"}
          className="p-3 rounded-xl bg-card border border-border/80 shadow-warm text-xs flex flex-col gap-2"
        >
          <div className="flex items-center justify-between">
            <span className="font-semibold text-foreground text-xs">
              {isParentView
                ? "What the marks on the worksheet mean"
                : "How to Interpret Handwriting Diagnostic Guides"}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={() => setShowLegend(false)}
              className="relative text-muted-foreground hover:text-foreground after:absolute after:-inset-2.5 md:after:hidden"
              aria-label="Close guide legend"
            >
              <X aria-hidden="true" />
            </Button>
          </div>
          <Separator />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1 text-[11px]">
            <div className="flex items-start gap-2">
              <div className="flex size-4 items-center justify-center rounded-xs bg-muted/60 border border-border/70 mt-0.5 shrink-0 p-0.5">
                <svg width="12" height="12" viewBox="0 0 14 14" fill="none" className="shrink-0" aria-hidden="true">
                  <line x1="1" y1="3" x2="13" y2="3" stroke={OVERLAY_COLORS.guidelines.topline} strokeWidth="1.5" strokeDasharray="3 2" />
                  <line x1="1" y1="7" x2="13" y2="7" stroke={OVERLAY_COLORS.guidelines.midline} strokeWidth="1.5" strokeDasharray="2 2" />
                  <line x1="1" y1="11" x2="13" y2="11" stroke={OVERLAY_COLORS.guidelines.baseline} strokeWidth="1.5" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-foreground">
                  {isParentView ? "3-Line Paper Guide" : "3-Line Penmanship Ruling"}
                </p>
                <p className="text-muted-foreground leading-snug">
                  {isParentView
                    ? "Top line for tall letters, dotted middle line for small letters, and bottom line where letters rest."
                    : "Gray topline (headline limit), teal dotted midline (x-height limit), and solid teal baseline."}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <div
                className="size-3 rounded-full mt-0.5 shrink-0"
                style={{ backgroundColor: OVERLAY_COLORS.consistent.stroke }}
              />
              <div>
                <p className="font-semibold text-foreground">
                  {isParentView ? "Steady Strokes" : "Consistent Strokes (Green / Teal)"}
                </p>
                <p className="text-muted-foreground leading-snug">
                  {isParentView
                    ? "Clear letter shapes, even spacing, and letters resting smoothly on the bottom line."
                    : "Proficient formation, aligned baselines, proportional size, and uniform slant angles."}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <div
                className="size-3 rounded-full mt-0.5 shrink-0"
                style={{ backgroundColor: OVERLAY_COLORS.needs_attention.stroke }}
              />
              <div>
                <p className="font-semibold text-foreground">
                  {isParentView ? "Spots to Practice" : "Practice Areas (Terracotta)"}
                </p>
                <p className="text-muted-foreground leading-snug">
                  {isParentView
                    ? "Places where a letter loop, spacing gap, lean, or bottom-line alignment can improve with practice."
                    : "Identified irregularities in stroke closure, baseline drift, spacing gaps, or slant tilt."}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <div className="flex size-4 items-center justify-center rounded-xs bg-muted/60 border border-border/70 mt-0.5 shrink-0 p-0.5">
                <svg width="12" height="12" viewBox="0 0 14 14" fill="none" className="shrink-0" aria-hidden="true">
                  <line x1="7" y1="1" x2="7" y2="13" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" strokeOpacity="0.5" />
                  <line x1="7" y1="13" x2="11" y2="2" stroke={OVERLAY_COLORS.proficient.stroke} strokeWidth="1.5" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-foreground">
                  {isParentView ? "Forward Lean (Slant)" : "Cursive Slant (6°–15° Tilt)"}
                </p>
                <p className="text-muted-foreground leading-snug">
                  {isParentView
                    ? "Cursive letters gently lean forward together at a steady angle."
                    : "Provisional forward slant target is 6.0°–15.0° from vertical. Extreme tilts are flagged."}
                </p>
              </div>
            </div>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
});
