"use client";

import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ResponsiveRichOverlay,
  ResponsiveRichOverlayContent,
  ResponsiveRichOverlayDescription,
  ResponsiveRichOverlayHeader,
  ResponsiveRichOverlayTitle,
} from "@/components/shared/responsive-rich-overlay";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SearchInput } from "@/components/shared/search-input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  AlertTriangleIcon,
  ArrowLeftIcon,
  CheckCircle2Icon,
  ChevronLeftIcon,
  ChevronRightIcon,
  RotateCcwIcon,
  SlidersHorizontalIcon,
  XIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CursiveStrokeCanvas } from "@/components/cursive-stroke-canvas";
import { getLetterStrokes, PAIRED_LETTER_OFFSETS } from "@/components/cursive-strokes-data";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  CURSIVE_ALPHABET,
  LetterGuideItem,
  LetterZone,
} from "@/components/cursive-guide-data";

// Re-export data types for backward compatibility
export { CURSIVE_ALPHABET };
export type { LetterGuideItem, LetterZone };

type CaseFilter = "pairs" | "upper" | "lower";
type ZoneFilter = "all" | "ascender" | "midline" | "descender" | "highJoiner";

const CASE_OPTIONS: { value: CaseFilter; label: string }[] = [
  { value: "pairs", label: "Pairs (Aa)" },
  { value: "upper", label: "Upper (A–Z)" },
  { value: "lower", label: "Lower (a–z)" },
];

const ZONE_OPTIONS: {
  id: ZoneFilter;
  label: string;
  count: number;
  description: string;
}[] = [
  { id: "all", label: "All", count: 26, description: "All 26 alphabet letters" },
  { id: "ascender", label: "Ascenders", count: 7, description: "Tall letters reaching top line (b, d, f, h, k, l, t)" },
  { id: "midline", label: "Midline", count: 14, description: "Short letters within midline zone" },
  { id: "descender", label: "Descenders", count: 6, description: "Tail letters extending below baseline" },
  { id: "highJoiner", label: "High Joiners", count: 4, description: "Letters that connect from midline (b, o, v, w)" },
];

interface CursiveGuideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialLetterId?: string | null;
  initialQuery?: string;
}

export function CursiveGuideDialog({
  open,
  onOpenChange,
  initialLetterId,
  initialQuery,
}: CursiveGuideDialogProps) {
  const [searchQuery, setSearchQuery] = useState(() =>
    typeof initialQuery === "string" ? initialQuery : ""
  );
  const [caseFilter, setCaseFilter] = useState<CaseFilter>("pairs");
  const [zoneFilter, setZoneFilter] = useState<ZoneFilter>("all");
  const [selectedLetterId, setSelectedLetterId] = useState<string | null>(() => {
    if (typeof initialLetterId === "string" && initialLetterId.trim().length > 0) {
      const target = initialLetterId.trim().toUpperCase();
      const found = CURSIVE_ALPHABET.find((l) => l.id.toUpperCase() === target);
      if (found) return found.id;
    }
    return "A";
  });
  const [mobileView, setMobileView] = useState<"grid" | "detail">(() => {
    return typeof initialLetterId === "string" && initialLetterId.trim().length > 0
      ? "detail"
      : "grid";
  });
  const [activeStepTab, setActiveStepTab] = useState<"lower" | "upper">("lower");
  const [activeDemoStep, setActiveDemoStep] = useState<{
    mode: "lower" | "upper";
    index: number;
  } | null>(null);
  const demoCaseRef = useRef<"lower" | "upper" | null>(null);
  const isMobile = useIsMobile();

  const handleActiveDemoStep = useCallback((mode: "lower" | "upper", index: number | null) => {
    if (index === 0 || demoCaseRef.current !== mode) setActiveStepTab(mode);
    demoCaseRef.current = mode;
    setActiveDemoStep(index === null ? null : { mode, index });
  }, []);

  const activeFilterCount = (caseFilter !== "pairs" ? 1 : 0) + (zoneFilter !== "all" ? 1 : 0);
  const activeCaseLabel = CASE_OPTIONS.find((opt) => opt.value === caseFilter)?.label;
  const activeZoneLabel = ZONE_OPTIONS.find((chip) => chip.id === zoneFilter)?.label;

  const searchInputRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const backButtonRef = useRef<HTMLButtonElement>(null);
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setMobileView("grid");
    }
    onOpenChange(nextOpen);
  };

  // Focus management: when entering detail view on mobile, focus the back button
  useEffect(() => {
    if (open && isMobile && mobileView === "detail") {
      const timer = setTimeout(() => {
        backButtonRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [open, isMobile, mobileView]);

  const handleBackToGrid = React.useCallback(() => {
    setMobileView("grid");
    // Return focus to the letter card that was opened
    setTimeout(() => {
      const targetBtn = gridRef.current?.querySelector(
        `button[data-letter-id="${selectedLetterId}"]`
      ) as HTMLButtonElement | null;
      targetBtn?.focus();
    }, 50);
  }, [selectedLetterId]);

  // Mobile Escape key navigates back to grid instead of dismissing dialog immediately
  useEffect(() => {
    if (!open || !isMobile || mobileView !== "detail") return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        handleBackToGrid();
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [open, isMobile, mobileView, handleBackToGrid]);

  // Global hotkey '/' inside modal to focus search (guarded per WCAG 2.1.4)
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable)
      ) {
        return;
      }
      if (e.key === "/" && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  // Filtered letters computation
  const filteredLetters = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return CURSIVE_ALPHABET.filter((item) => {
      // Zone filter
      if (zoneFilter === "ascender" && item.zone !== "ascender") return false;
      if (zoneFilter === "midline" && item.zone !== "midline") return false;
      if (zoneFilter === "descender" && item.zone !== "descender") return false;
      if (zoneFilter === "highJoiner" && !item.isHighJoiner) return false;

      // Search query
      if (!q) return true;
      return (
        item.id.toLowerCase() === q ||
        item.name.toLowerCase().includes(q) ||
        item.zoneLabel.toLowerCase().includes(q) ||
        item.strokeSummary.toLowerCase().includes(q) ||
        item.keywords.some((k) => k.toLowerCase().includes(q)) ||
        item.practiceWords.some((w) => w.toLowerCase().includes(q))
      );
    });
  }, [searchQuery, zoneFilter]);

  // Active selected letter object
  const activeLetter = useMemo(() => {
    if (!selectedLetterId) return filteredLetters[0] ?? CURSIVE_ALPHABET[0];
    return CURSIVE_ALPHABET.find((l) => l.id === selectedLetterId) ?? filteredLetters[0] ?? CURSIVE_ALPHABET[0];
  }, [selectedLetterId, filteredLetters]);

  // Navigation indices for Stepper in Mobile Detail View
  const currentIndex = useMemo(() => {
    return filteredLetters.findIndex((l) => l.id === activeLetter?.id);
  }, [filteredLetters, activeLetter]);

  const hasPrevLetter = currentIndex > 0;
  const hasNextLetter = currentIndex >= 0 && currentIndex < filteredLetters.length - 1;

  const handlePrevLetter = () => {
    if (hasPrevLetter) {
      setSelectedLetterId(filteredLetters[currentIndex - 1].id);
    }
  };

  const handleNextLetter = () => {
    if (hasNextLetter) {
      setSelectedLetterId(filteredLetters[currentIndex + 1].id);
    }
  };

  // Touch swipe gestures for mobile letter cycling
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchStartXRef.current = e.touches[0].clientX;
      touchStartYRef.current = e.touches[0].clientY;
    }
  };

  const handleTouchCancel = () => {
    touchStartXRef.current = null;
    touchStartYRef.current = null;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null || touchStartYRef.current === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const deltaX = touchEndX - touchStartXRef.current;
    const deltaY = touchEndY - touchStartYRef.current;

    // Only recognize primarily horizontal swipes with min 45px distance
    if (Math.abs(deltaX) > 45 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
      if (deltaX < 0) {
        // Swiped left -> next letter
        handleNextLetter();
      } else {
        // Swiped right -> prev letter
        handlePrevLetter();
      }
    }
    touchStartXRef.current = null;
    touchStartYRef.current = null;
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    searchInputRef.current?.focus();
  };

  const handleResetFilters = () => {
    setSearchQuery("");
    setCaseFilter("pairs");
    setZoneFilter("all");
    searchInputRef.current?.focus();
  };

  const handleGridKeyDown = (e: React.KeyboardEvent) => {
    if (!["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
    e.preventDefault();

    const index = filteredLetters.findIndex((l) => l.id === activeLetter.id);
    if (index === -1) return;

    let columns = 2; // mobile default
    if (typeof window !== "undefined") {
      if (window.matchMedia("(min-width: 1024px)").matches) columns = 4;
      else if (window.matchMedia("(min-width: 640px)").matches) columns = 3;
    }

    let nextIndex = index;
    if (e.key === "ArrowRight") nextIndex = index + 1;
    else if (e.key === "ArrowLeft") nextIndex = index - 1;
    else if (e.key === "ArrowDown") nextIndex = index + columns;
    else if (e.key === "ArrowUp") nextIndex = index - columns;
    else if (e.key === "Home") nextIndex = 0;
    else if (e.key === "End") nextIndex = filteredLetters.length - 1;

    nextIndex = Math.max(0, Math.min(nextIndex, filteredLetters.length - 1));

    const targetLetter = filteredLetters[nextIndex];
    if (targetLetter) {
      setSelectedLetterId(targetLetter.id);
      const targetBtn = gridRef.current?.querySelector(`button[data-letter-id="${targetLetter.id}"]`) as HTMLButtonElement | null;
      targetBtn?.focus();
    }
  };

  const renderSpotlightContent = (isMobileDetail = false) => {
    if (!activeLetter) return null;
    return (
      <section
        aria-label={`Detailed formation guide for Letter ${activeLetter.id}`}
        className={cn(
          "flex flex-col gap-4",
          isMobileDetail
            ? "bg-transparent p-0"
            : "rounded-2xl border border-primary/25 bg-linear-to-b from-card via-card to-primary/5 p-4 shadow-xs sm:p-5"
        )}
      >
        {/* Spotlight Header: Letter Title */}
        <div className="flex items-center gap-2.5 border-b border-border/70 pb-3">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary font-heading text-lg font-bold text-primary-foreground shadow-xs">
            {activeLetter.id}
          </span>
          <h3 className="font-heading text-base leading-tight font-semibold text-foreground">
            {activeLetter.name}
          </h3>
        </div>

        {/* Realistic Animated Penmanship Stroke Display */}
        <CursiveStrokeCanvas
          key={activeLetter.id}
          letterId={activeLetter.id}
          onActiveStepChange={handleActiveDemoStep}
        />

        {/* Step-by-Step Formation Cues */}
        <div className="flex flex-col gap-2.5 rounded-xl border border-border/80 bg-muted/20 p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-foreground">
              Step-by-Step Formation
            </span>
            <ToggleGroup
              value={[activeStepTab]}
              multiple={false}
              variant="outline"
              size="sm"
              onValueChange={(vals) => {
                if (vals.length > 0) {
                  setActiveStepTab(vals[0] as "lower" | "upper");
                }
              }}
              aria-label="Formation step case"
            >
              <ToggleGroupItem value="lower" className="min-h-10 sm:min-h-8">
                Lower ({activeLetter.lower})
              </ToggleGroupItem>
              <ToggleGroupItem value="upper" className="min-h-10 sm:min-h-8">
                Upper ({activeLetter.upper})
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          <ol className="flex list-none flex-col gap-1.5 pl-0 text-xs text-muted-foreground">
            {getLetterStrokes(activeLetter.id)[activeStepTab].map((step, index) => {
              const isActive = activeDemoStep?.mode === activeStepTab && activeDemoStep.index === index;
              return (
                <li
                  key={step.d}
                  aria-current={isActive ? "step" : undefined}
                  className="flex items-start gap-2"
                >
                  <span
                    className={cn(
                      "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                      isActive ? "bg-primary text-primary-foreground" : "bg-primary/15 text-primary",
                    )}
                  >
                    {index + 1}
                  </span>
                  <span className="leading-relaxed text-foreground/90">{step.instruction}</span>
                </li>
              );
            })}
          </ol>
        </div>

        {/* Coaching Tip & Common Pitfall */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Alert className="border-primary/25 bg-primary/5 text-primary">
            <CheckCircle2Icon aria-hidden="true" />
            <AlertTitle className="text-xs font-semibold">Coaching Tip</AlertTitle>
            <AlertDescription className="text-xs leading-relaxed">
              {activeLetter.coachingTip}
            </AlertDescription>
          </Alert>

          <Alert className="border-warning/35 bg-warning/10 text-warning-foreground">
            <AlertTriangleIcon aria-hidden="true" />
            <AlertTitle className="text-xs font-semibold">Watch Out</AlertTitle>
            <AlertDescription className="text-xs leading-relaxed">
              {activeLetter.commonPitfall}
            </AlertDescription>
          </Alert>
        </div>

        {/* Practice Vocabulary Words */}
        <div className="flex flex-wrap items-center gap-2 pt-2 text-xs">
          <span className="flex items-center gap-1 font-semibold text-muted-foreground">
            Practice Words:
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            {activeLetter.practiceWords.map((word) => (
              <Badge key={word} variant="outline" className="h-auto gap-1.5 px-2.5 py-1">
                <span className="font-cursive text-sm text-primary">{word}</span>
                <span className="font-sans text-xs text-muted-foreground">({word})</span>
              </Badge>
            ))}
          </div>
        </div>
      </section>
    );
  };

  return (
    <ResponsiveRichOverlay open={open} onOpenChange={handleOpenChange}>
      <ResponsiveRichOverlayContent
        id="cursive-guide-dialog"
        overlayClassName="bg-foreground/25 supports-backdrop-filter:backdrop-blur-xs"
        className="p-0 overflow-hidden flex flex-col gap-0 shadow-warm w-[calc(100%-1rem)] sm:max-w-4xl max-h-[min(92dvh,calc(100dvh-1.5rem))] rounded-2xl print:max-w-none print:w-full print:max-h-none print:shadow-none print:rounded-none print:border-none print:p-0"
      >
        {/* Streamlined Header: Title + Stepper (Mobile) / Search (Desktop) */}
        <ResponsiveRichOverlayHeader className="shrink-0 gap-3 border-b border-border/70 bg-card/95 p-3.5 pb-3 backdrop-blur-xs sm:p-5 sm:pb-3.5 print:hidden">
          {isMobile && mobileView === "detail" ? (
            <div className="flex min-w-0 items-center justify-between gap-2 pr-14 sm:pr-8">
              {/* Back to Grid Button */}
              <div className="flex min-w-0 items-center gap-2">
                <Button
                  ref={backButtonRef}
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleBackToGrid}
                  className="-ml-1 min-h-10 shrink-0 text-primary hover:bg-primary/10 hover:text-primary"
                  aria-label="Back to alphabet letters list"
                >
                  <ArrowLeftIcon data-icon="inline-start" aria-hidden="true" />
                  <span>All Letters</span>
                </Button>
                <ResponsiveRichOverlayTitle className="sr-only">
                  Letter {activeLetter?.id} Guide
                </ResponsiveRichOverlayTitle>
              </div>

              {/* Prev / Next Stepper */}
              <div className="flex shrink-0 items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handlePrevLetter}
                  disabled={!hasPrevLetter}
                  className="size-10"
                  aria-label="Previous letter"
                  title="Previous letter"
                >
                  <ChevronLeftIcon aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleNextLetter}
                  disabled={!hasNextLetter}
                  className="size-10"
                  aria-label="Next letter"
                  title="Next letter"
                >
                  <ChevronRightIcon aria-hidden="true" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex min-w-0 items-center justify-between gap-3 pr-14 sm:pr-8">
              <ResponsiveRichOverlayTitle className="truncate font-heading text-base font-semibold tracking-tight text-foreground sm:text-lg">
                Cursive Alphabet Guide
              </ResponsiveRichOverlayTitle>
            </div>
          )}

          <ResponsiveRichOverlayDescription className="sr-only">
            Zaner-Bloser cursive letter forms with animated strokes and written steps for uppercase and lowercase.
          </ResponsiveRichOverlayDescription>

          {/* Search & Case / Zone Filters Bar (Hidden on Mobile Detail View to Maximize Screen Room) */}
          {!(isMobile && mobileView === "detail") && (
            <div className="flex flex-col gap-2.5">
              {/* Top Bar: Search Input + Case Mode Selector */}
              <div className="flex items-center gap-2.5">
                {/* Quick Search */}
                <div role="search" aria-label="Search cursive letters" className="min-w-0 flex-1">
                  <SearchInput
                    id="cursive-search-input"
                    ref={searchInputRef}
                    containerClassName="w-full sm:w-full"
                    placeholder="Search letters (e.g., 'G', 'loop')..."
                    aria-label="Filter cursive alphabet by letter or keyword"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onClear={handleClearSearch}
                    onKeyDown={(e) => {
                      if (e.key === "Escape" && searchQuery) {
                        e.stopPropagation();
                      }
                    }}
                    className="rounded-lg text-base sm:text-xs"
                  />
                </div>

                {/* Case Mode Selector (Desktop) */}
                <ToggleGroup
                  value={[caseFilter]}
                  multiple={false}
                  variant="outline"
                  size="sm"
                  onValueChange={(vals) => {
                    if (vals.length > 0) {
                      setCaseFilter(vals[0] as CaseFilter);
                    }
                  }}
                  aria-label="Filter letter case"
                  className="hidden shrink-0 sm:inline-flex"
                >
                  {CASE_OPTIONS.map((opt) => (
                    <ToggleGroupItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>

                {/* Mobile Filters Drawer */}
                <div className="sm:hidden">
                  <Drawer showSwipeHandle>
                    <DrawerTrigger
                      render={
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="min-h-11 shrink-0"
                          aria-label={
                            activeFilterCount > 0
                              ? `Filters (${activeFilterCount} active)`
                              : "Filters"
                          }
                        />
                      }
                    >
                      <SlidersHorizontalIcon data-icon="inline-start" aria-hidden="true" />
                      <span>Filters</span>
                      {activeFilterCount > 0 && (
                        <Badge variant="secondary">{activeFilterCount}</Badge>
                      )}
                    </DrawerTrigger>
                    <DrawerContent>
                      <DrawerHeader>
                        <DrawerTitle>Filter Letters</DrawerTitle>
                        <DrawerDescription>
                          Filter by letter case and writing zone.
                        </DrawerDescription>
                      </DrawerHeader>
                      <div className="flex flex-col gap-4 p-4">
                        <div className="flex flex-col gap-2">
                          <span className="text-xs font-medium text-muted-foreground">
                            Letter Case
                          </span>
                          <ToggleGroup
                            value={[caseFilter]}
                            multiple={false}
                            variant="outline"
                            size="sm"
                            onValueChange={(vals) => {
                              if (vals.length > 0) {
                                setCaseFilter(vals[0] as CaseFilter);
                              }
                            }}
                            aria-label="Filter letter case"
                            className="w-full"
                          >
                            {CASE_OPTIONS.map((opt) => (
                              <ToggleGroupItem
                                key={opt.value}
                                value={opt.value}
                                className="min-h-11 flex-1"
                              >
                                {opt.label}
                              </ToggleGroupItem>
                            ))}
                          </ToggleGroup>
                        </div>

                        <div className="flex flex-col gap-2">
                          <span className="text-xs font-medium text-muted-foreground">
                            Writing Zone
                          </span>
                          <ToggleGroup
                            value={[zoneFilter]}
                            multiple={false}
                            variant="outline"
                            size="sm"
                            onValueChange={(vals) => {
                              if (vals.length > 0) {
                                setZoneFilter(vals[0] as ZoneFilter);
                              }
                            }}
                            aria-label="Filter by letter category"
                            className="w-full flex-wrap"
                          >
                            {ZONE_OPTIONS.map((chip) => (
                              <ToggleGroupItem
                                key={chip.id}
                                value={chip.id}
                                className="min-h-11"
                              >
                                <span>{chip.label}</span>
                                <span className="text-xs opacity-80 tabular-nums">
                                  ({chip.count})
                                </span>
                              </ToggleGroupItem>
                            ))}
                          </ToggleGroup>
                        </div>
                      </div>
                      <DrawerFooter>
                        <Button
                          type="button"
                          variant="outline"
                          className="min-h-11"
                          onClick={() => {
                            setCaseFilter("pairs");
                            setZoneFilter("all");
                          }}
                          disabled={activeFilterCount === 0}
                        >
                          Reset
                        </Button>
                        <DrawerClose
                          render={
                            <Button type="button" className="min-h-11">
                              Done
                            </Button>
                          }
                        />
                      </DrawerFooter>
                    </DrawerContent>
                  </Drawer>
                </div>
              </div>

              {/* Active Filter Summary Chips (Mobile) */}
              {activeFilterCount > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 text-xs sm:hidden">
                  <span className="text-muted-foreground">Active filters:</span>
                  {caseFilter !== "pairs" && activeCaseLabel && (
                    <Badge variant="secondary" className="gap-1 pr-1">
                      <span>{activeCaseLabel}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => setCaseFilter("pairs")}
                        aria-label={`Clear ${activeCaseLabel} filter`}
                        className="relative after:absolute after:-inset-2.5"
                      >
                        <XIcon aria-hidden="true" />
                      </Button>
                    </Badge>
                  )}
                  {zoneFilter !== "all" && activeZoneLabel && (
                    <Badge variant="secondary" className="gap-1 pr-1">
                      <span>{activeZoneLabel}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => setZoneFilter("all")}
                        aria-label={`Clear ${activeZoneLabel} filter`}
                        className="relative after:absolute after:-inset-2.5"
                      >
                        <XIcon aria-hidden="true" />
                      </Button>
                    </Badge>
                  )}
                </div>
              )}

              {/* Dedicated Zone / Category Filter Strip (Desktop) */}
              <ScrollArea orientation="horizontal" hideScrollbar className="hidden w-full sm:flex">
                <ToggleGroup
                  value={[zoneFilter]}
                  multiple={false}
                  variant="outline"
                  size="sm"
                  spacing={1.5}
                  onValueChange={(vals) => {
                    if (vals.length > 0) {
                      setZoneFilter(vals[0] as ZoneFilter);
                    }
                  }}
                  aria-label="Filter by letter category"
                  className="flex w-max items-center py-0.5 text-xs"
                >
                  {ZONE_OPTIONS.map((chip) => (
                    <ToggleGroupItem
                      key={chip.id}
                      value={chip.id}
                      title={chip.description}
                      className="min-h-8 shrink-0 rounded-full text-xs font-medium text-muted-foreground hover:text-foreground data-pressed:border-primary data-pressed:bg-primary data-pressed:font-semibold data-pressed:text-primary-foreground data-pressed:shadow-2xs data-pressed:hover:bg-primary data-pressed:hover:text-primary-foreground"
                    >
                      <span>{chip.label}</span>
                      <span className="text-xs opacity-80 tabular-nums">({chip.count})</span>
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </ScrollArea>
            </div>
          )}

          {/* Accessible Live Region for Screen Readers */}
          <div aria-live="polite" aria-atomic="true" className="sr-only">
            {filteredLetters.length === 26
              ? `Showing all 26 cursive letters. Letter ${activeLetter.id} currently selected.`
              : `Showing ${filteredLetters.length} letters matching filter. Letter ${activeLetter.id} currently selected.`}
          </div>
        </ResponsiveRichOverlayHeader>

        {/* Split Body */}
        <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
          {/* Left: Grid View */}
          <div
            className={cn(
              "flex flex-col gap-5 overflow-y-auto overscroll-contain border-border/70 p-3.5 focus-visible:outline-none sm:p-5 md:border-r",
              isMobile && mobileView === "detail" ? "hidden md:flex md:flex-1" : "flex-1"
            )}
          >
            {/* Letter Cards Grid */}
            <section aria-labelledby="alphabet-grid-heading" className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3
                  id="alphabet-grid-heading"
                  className="text-xs font-semibold tracking-wider text-muted-foreground uppercase print:text-black"
                >
                  Cursive Letterforms ({filteredLetters.length})
                </h3>
              </div>

              {filteredLetters.length === 0 ? (
                <Empty className="border border-border/80 bg-muted/20 p-8">
                  <EmptyHeader>
                    <EmptyTitle className="text-sm">No letters match your search criteria</EmptyTitle>
                    <EmptyDescription className="text-xs">
                      Try clearing your search or resetting the active letter filters.
                    </EmptyDescription>
                  </EmptyHeader>
                  <EmptyContent>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleResetFilters}
                      className="min-h-10 sm:min-h-8"
                    >
                      <RotateCcwIcon data-icon="inline-start" aria-hidden="true" />
                      Reset filters
                    </Button>
                  </EmptyContent>
                </Empty>
              ) : (
                <ToggleGroup
                  ref={gridRef}
                  value={[activeLetter.id]}
                  multiple={false}
                  spacing={2.5}
                  onKeyDown={handleGridKeyDown}
                  onValueChange={(vals) => {
                    if (vals.length > 0) {
                      setSelectedLetterId(vals[0]);
                    }
                    setMobileView("detail");
                  }}
                  aria-label="Cursive alphabet letters"
                  className="grid w-full grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4 print:grid-cols-4 print:gap-3"
                >
                  {filteredLetters.map((item) => {
                    const isSelected = activeLetter.id === item.id;
                    const strokes = getLetterStrokes(item.id);
                    const previewCases = caseFilter === "pairs"
                      ? (["upper", "lower"] as const)
                      : [caseFilter];

                    return (
                      <div key={item.id} className="min-w-0 print:break-inside-avoid">
                        <ToggleGroupItem
                          value={item.id}
                          data-letter-id={item.id}
                          aria-label={`Letter ${item.id}, ${item.zoneLabel} zone. Click to view formation guide.`}
                          className={cn(
                            "group relative flex h-20 w-full cursor-pointer flex-col items-stretch justify-start overflow-hidden rounded-xl border p-0 text-left whitespace-normal transition-all duration-150 select-none sm:h-24 print:h-20 print:border-black print:bg-white",
                            isSelected
                              ? "border-primary bg-card shadow-sm ring-2 ring-primary/40 hover:bg-card data-pressed:bg-card"
                              : "border-border/70 bg-card/60 hover:border-border hover:bg-card hover:shadow-2xs"
                          )}
                        >
                          <div className="relative z-10 flex items-center justify-between px-3 pt-2 pb-0.5 min-w-0">
                            <span className="font-sans font-bold text-xs text-foreground/80 tracking-tight">
                              {item.id}{item.lower}
                            </span>
                          </div>
                          <div className="relative flex-1 w-full min-h-0 overflow-hidden flex items-center justify-center">
                            <svg
                              aria-hidden="true"
                              viewBox={caseFilter === "pairs" ? "105 18 180 87" : "150 18 94 87"}
                              className="h-full max-w-full text-foreground print:text-black"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="3"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              {previewCases.map((mode) => (
                                <g
                                  key={mode}
                                  transform={caseFilter === "pairs"
                                    ? `translate(${PAIRED_LETTER_OFFSETS[mode]}, 0)`
                                    : undefined}
                                >
                                  {strokes[mode].map((step) => (
                                    <path key={step.d} d={step.d} />
                                  ))}
                                </g>
                              ))}
                            </svg>
                          </div>
                        </ToggleGroupItem>
                      </div>
                    );
                  })}
                </ToggleGroup>
              )}
            </section>
          </div>

          {/* Right: Spotlight View (Desktop or Mobile Detail Drill-down with Swipe Support) */}
          <div
            onTouchStart={isMobile && mobileView === "detail" ? handleTouchStart : undefined}
            onTouchCancel={isMobile && mobileView === "detail" ? handleTouchCancel : undefined}
            onTouchEnd={isMobile && mobileView === "detail" ? handleTouchEnd : undefined}
            className={cn(
              "overflow-y-auto",
              isMobile && mobileView === "detail"
                ? "flex-1 block p-4 sm:p-5 bg-card touch-pan-y"
                : "hidden md:block w-[420px] lg:w-[480px] shrink-0 bg-muted/20 p-4 sm:p-5"
            )}
          >
            {(!isMobile || mobileView === "detail") && renderSpotlightContent(isMobile)}
          </div>
        </div>
      </ResponsiveRichOverlayContent>
    </ResponsiveRichOverlay>
  );
}
