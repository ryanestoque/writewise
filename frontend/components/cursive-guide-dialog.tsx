"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  RotateCcwIcon,
  CheckCircle2Icon,
  AlertTriangleIcon,
  FilterIcon,
  ArrowLeftIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CursiveStrokeCanvas } from "@/components/cursive-stroke-canvas";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  CURSIVE_ALPHABET,
  LetterGuideItem,
  LetterZone,
} from "@/components/cursive-guide-data";

// Re-export data types for backward compatibility
export { CURSIVE_ALPHABET };
export type { LetterGuideItem, LetterZone };

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
  const [caseFilter, setCaseFilter] = useState<"pairs" | "upper" | "lower">("pairs");
  const [zoneFilter, setZoneFilter] = useState<"all" | "ascender" | "midline" | "descender" | "highJoiner">("all");
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
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [activeStepTab, setActiveStepTab] = useState<"lower" | "upper">("lower");
  const isMobile = useIsMobile();

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
          "space-y-4",
          isMobileDetail
            ? "p-0 bg-transparent"
            : "rounded-2xl border border-primary/25 bg-linear-to-b from-card via-card to-primary/5 shadow-xs p-4 sm:p-5"
        )}
      >
        {/* Spotlight Header: Letter Title */}
        <div className="flex items-center gap-2.5 pb-3 border-b border-border/70">
          <span className="size-9 rounded-xl bg-primary text-primary-foreground font-heading font-bold text-lg flex items-center justify-center shadow-xs">
            {activeLetter.id}
          </span>
          <h3 className="text-base font-heading font-semibold text-foreground leading-tight">
            {activeLetter.name}
          </h3>
        </div>

        {/* Realistic Animated Penmanship Stroke Display */}
        <CursiveStrokeCanvas
          key={activeLetter.id}
          letterId={activeLetter.id}
        />

        {/* Step-by-Step Formation Cues (Clarify Feature) */}
        <div className="p-3.5 rounded-xl border border-border/80 bg-muted/20 space-y-2.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-xs font-semibold text-foreground">
              Step-by-Step Formation
            </span>
            <ToggleGroup
              value={[activeStepTab]}
              multiple={false}
              spacing={1}
              onValueChange={(vals) => {
                if (vals.length > 0) {
                  setActiveStepTab(vals[0] as "lower" | "upper");
                }
              }}
              aria-label="Formation step case"
              className="inline-flex items-center p-0.5 gap-0.5 rounded-md border border-border/70 bg-background text-xs"
            >
              <ToggleGroupItem
                value="lower"
                size="sm"
                className="min-h-[40px] sm:min-h-[28px] h-auto px-2.5 py-1 text-xs rounded font-medium text-muted-foreground hover:text-foreground hover:bg-transparent aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:hover:bg-primary aria-pressed:hover:text-primary-foreground aria-pressed:font-semibold aria-pressed:shadow-2xs cursor-pointer touch-manipulation"
              >
                Lower ({activeLetter.lower})
              </ToggleGroupItem>
              <ToggleGroupItem
                value="upper"
                size="sm"
                className="min-h-[40px] sm:min-h-[28px] h-auto px-2.5 py-1 text-xs rounded font-medium text-muted-foreground hover:text-foreground hover:bg-transparent aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:hover:bg-primary aria-pressed:hover:text-primary-foreground aria-pressed:font-semibold aria-pressed:shadow-2xs cursor-pointer touch-manipulation"
              >
                Upper ({activeLetter.upper})
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          <ol className="space-y-1.5 text-xs text-muted-foreground pl-0 list-none">
            {(activeStepTab === "lower" ? activeLetter.lowerSteps : activeLetter.upperSteps).map(
              (step, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="size-5 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <span className="leading-relaxed text-foreground/90">{step}</span>
                </li>
              )
            )}
          </ol>
        </div>

        {/* Coaching Tip & Common Pitfall (Design token styling) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="p-3 rounded-xl border border-primary/25 bg-primary/5 dark:bg-primary/10 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
              <CheckCircle2Icon className="size-3.5 shrink-0" aria-hidden="true" />
              <span>Coaching Tip</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {activeLetter.coachingTip}
            </p>
          </div>

          <div className="p-3 rounded-xl border border-warning/35 bg-warning/10 dark:bg-warning/15 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-warning-foreground dark:text-warning">
              <AlertTriangleIcon className="size-3.5 shrink-0" aria-hidden="true" />
              <span>Watch Out</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {activeLetter.commonPitfall}
            </p>
          </div>
        </div>

        {/* Practice Vocabulary Words */}
        <div className="pt-2 flex items-center gap-2 flex-wrap text-xs">
          <span className="font-semibold text-muted-foreground flex items-center gap-1">
            Practice Words:
          </span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {activeLetter.practiceWords.map((word) => (
              <span
                key={word}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-border/80 bg-muted/40 font-medium text-foreground"
              >
                <span className="font-cursive text-sm text-primary">{word}</span>
                <span className="text-xs text-muted-foreground font-sans">({word})</span>
              </span>
            ))}
          </div>
        </div>
      </section>
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        id="cursive-guide-dialog"
        overlayClassName="bg-foreground/25 supports-backdrop-filter:backdrop-blur-xs"
        className="p-0 overflow-hidden flex flex-col gap-0 shadow-warm w-[calc(100%-1rem)] sm:max-w-4xl max-h-[min(92dvh,calc(100dvh-1.5rem))] rounded-2xl print:max-w-none print:w-full print:max-h-none print:shadow-none print:rounded-none print:border-none print:p-0"
      >
        {/* Streamlined Header: Title + Stepper (Mobile) / Search (Desktop) */}
        <DialogHeader className="p-3.5 sm:p-5 pb-3 sm:pb-3.5 border-b border-border/70 bg-card/95 backdrop-blur-xs shrink-0 space-y-3 print:hidden">
          {isMobile && mobileView === "detail" ? (
            <div className="flex items-center justify-between gap-2 min-w-0 pr-14 sm:pr-8">
              {/* Back to Grid Button */}
              <div className="flex items-center gap-2 min-w-0">
                <Button
                  ref={backButtonRef}
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleBackToGrid}
                  className="gap-1.5 h-10 px-2.5 -ml-1 text-xs font-semibold rounded-lg text-primary hover:text-primary hover:bg-primary/10 shrink-0 active:scale-95"
                  aria-label="Back to alphabet letters list"
                >
                  <ArrowLeftIcon className="size-4 shrink-0" aria-hidden="true" />
                  <span>All Letters</span>
                </Button>
                <DialogTitle className="sr-only">
                  Letter {activeLetter?.id} Guide
                </DialogTitle>
              </div>

              {/* Prev / Next Stepper (Min 40px touch targets for mobile thumbs, clear of dialog Close X) */}
              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handlePrevLetter}
                  disabled={!hasPrevLetter}
                  className={cn(
                    "size-10 rounded-xl border-border/80 text-muted-foreground active:scale-95",
                    hasPrevLetter
                      ? "hover:text-foreground hover:bg-muted/70 bg-background shadow-2xs"
                      : "opacity-35 bg-muted/20"
                  )}
                  aria-label="Previous letter"
                  title="Previous letter"
                >
                  <ChevronLeftIcon className="size-4" aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleNextLetter}
                  disabled={!hasNextLetter}
                  className={cn(
                    "size-10 rounded-xl border-border/80 text-muted-foreground active:scale-95",
                    hasNextLetter
                      ? "hover:text-foreground hover:bg-muted/70 bg-background shadow-2xs"
                      : "opacity-35 bg-muted/20"
                  )}
                  aria-label="Next letter"
                  title="Next letter"
                >
                  <ChevronRightIcon className="size-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3 min-w-0 pr-14 sm:pr-8">
              <DialogTitle className="text-base sm:text-lg font-heading font-semibold text-foreground tracking-tight truncate">
                Cursive Alphabet Guide
              </DialogTitle>
            </div>
          )}

          <DialogDescription className="sr-only">
            Interactive cursive handwriting guide showing uppercase and lowercase letter formations on 3-line ruling with stroke cues.
          </DialogDescription>

          {/* Search & Case / Zone Filters Bar (Hidden on Mobile Detail View to Maximize Screen Room) */}
          {!(isMobile && mobileView === "detail") && (
            <div className="flex flex-col gap-2.5">
              {/* Top Bar: Search Input + Case Mode Selector */}
              <div className="flex items-center gap-2.5">
                {/* Quick Search */}
                <div role="search" aria-label="Search cursive letters" className="flex-1 min-w-0">
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
                    className="text-base sm:text-xs rounded-lg"
                  />
                </div>

                {/* Case Mode Selector (Desktop) */}
                <ToggleGroup
                  value={[caseFilter]}
                  multiple={false}
                  spacing={1}
                  onValueChange={(vals) => {
                    if (vals.length > 0) {
                      setCaseFilter(vals[0] as "pairs" | "upper" | "lower");
                    }
                  }}
                  aria-label="Filter letter case"
                  className="hidden sm:inline-flex items-center p-0.5 gap-0.5 rounded-lg border border-border/70 bg-muted/40 shrink-0"
                >
                  {[
                    { value: "pairs", label: "Pairs (Aa)" },
                    { value: "upper", label: "Upper (A–Z)" },
                    { value: "lower", label: "Lower (a–z)" },
                  ].map((opt) => (
                    <ToggleGroupItem
                      key={opt.value}
                      value={opt.value}
                      size="sm"
                      className="h-auto px-2.5 py-1 text-xs font-medium rounded-md text-muted-foreground hover:text-foreground hover:bg-transparent aria-pressed:bg-background aria-pressed:text-foreground aria-pressed:hover:bg-background aria-pressed:shadow-2xs aria-pressed:font-semibold cursor-pointer"
                    >
                      {opt.label}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>

                {/* Mobile Filters Toggle */}
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setIsFiltersOpen(!isFiltersOpen)}
                  className={cn(
                    "sm:hidden relative size-10 rounded-lg shrink-0",
                    isFiltersOpen
                      ? "bg-primary/10 border-primary/30 text-primary hover:bg-primary/15 hover:text-primary aria-expanded:bg-primary/10 aria-expanded:text-primary"
                      : "border-border/80 bg-background text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                  aria-label={zoneFilter !== "all" ? `Toggle filters (${zoneFilter} active)` : "Toggle filters"}
                  aria-expanded={isFiltersOpen}
                >
                  <FilterIcon className="size-4" aria-hidden="true" />
                  {zoneFilter !== "all" && (
                    <span
                      className="absolute top-1.5 right-1.5 size-2 rounded-full bg-primary ring-2 ring-background"
                      aria-hidden="true"
                    />
                  )}
                </Button>
              </div>

              {/* Active Filter Reminder Tag (Mobile collapsed state, with generous 40px touch dismissal hit area) */}
              {!isFiltersOpen && zoneFilter !== "all" && (
                <div className="sm:hidden flex items-center gap-1.5 text-xs animate-in fade-in slide-in-from-top-1">
                  <span className="text-xs text-muted-foreground">Active filter:</span>
                  <span className="inline-flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-full bg-primary/15 text-primary text-xs font-medium">
                    {zoneFilter === "ascender"
                      ? "Ascenders"
                      : zoneFilter === "midline"
                        ? "Midline"
                        : zoneFilter === "descender"
                          ? "Descenders"
                          : "High Joiners"}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setZoneFilter("all")}
                      className="size-10 min-h-[40px] min-w-[40px] rounded-full text-primary hover:text-foreground hover:bg-primary/20 touch-manipulation"
                      aria-label="Clear active filter"
                    >
                      <span className="text-sm font-bold leading-none" aria-hidden="true">×</span>
                    </Button>
                  </span>
                </div>
              )}

              {/* Mobile-Only Case Selector (when filters expanded) */}
              {isFiltersOpen && (
                <ToggleGroup
                  value={[caseFilter]}
                  multiple={false}
                  spacing={1}
                  onValueChange={(vals) => {
                    if (vals.length > 0) {
                      setCaseFilter(vals[0] as "pairs" | "upper" | "lower");
                    }
                  }}
                  aria-label="Filter letter case"
                  className="sm:hidden flex items-center p-0.5 gap-0.5 rounded-lg border border-border/70 bg-muted/40 shrink-0 self-start w-full animate-in fade-in slide-in-from-top-1"
                >
                  {[
                    { value: "pairs", label: "Pairs (Aa)" },
                    { value: "upper", label: "Upper (A–Z)" },
                    { value: "lower", label: "Lower (a–z)" },
                  ].map((opt) => (
                    <ToggleGroupItem
                      key={opt.value}
                      value={opt.value}
                      size="sm"
                      className="flex-1 h-auto px-2.5 py-2 min-h-10 text-xs font-medium rounded-md text-muted-foreground hover:text-foreground hover:bg-transparent aria-pressed:bg-background aria-pressed:text-foreground aria-pressed:hover:bg-background aria-pressed:shadow-2xs aria-pressed:font-semibold cursor-pointer"
                    >
                      {opt.label}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              )}

              {/* Dedicated Zone / Category Filter Chips Row (Horizontal Scroll Rail on Mobile with 40px touch targets) */}
              <ToggleGroup
                value={[zoneFilter]}
                multiple={false}
                spacing={1}
                onValueChange={(vals) => {
                  if (vals.length > 0) {
                    setZoneFilter(vals[0] as typeof zoneFilter);
                  }
                }}
                aria-label="Filter by letter category"
                className={cn(
                  "flex w-full items-center gap-1.5 text-xs pt-0.5 overflow-x-auto pb-1 sm:pb-0 sm:flex-wrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
                  !isFiltersOpen && "hidden sm:flex"
                )}
              >
                {[
                  { id: "all", label: "All", count: 26, description: "All 26 alphabet letters" },
                  { id: "ascender", label: "Ascenders", count: 7, description: "Tall letters reaching top line (b, d, f, h, k, l, t)" },
                  { id: "midline", label: "Midline", count: 14, description: "Short letters within midline zone" },
                  { id: "descender", label: "Descenders", count: 6, description: "Tail letters extending below baseline" },
                  { id: "highJoiner", label: "High Joiners", count: 4, description: "Letters that connect from midline (b, o, v, w)" },
                ].map((chip) => (
                  <ToggleGroupItem
                    key={chip.id}
                    value={chip.id}
                    title={chip.description}
                    className="h-auto px-3 py-2 sm:py-1 min-h-10 sm:min-h-8 rounded-full text-xs font-medium shrink-0 transition-all cursor-pointer border border-border/70 bg-background/80 text-muted-foreground hover:text-foreground hover:bg-muted/60 aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:border-primary aria-pressed:hover:bg-primary aria-pressed:hover:text-primary-foreground aria-pressed:shadow-2xs aria-pressed:font-semibold active:scale-95"
                  >
                    {chip.label}
                    <span className="ml-1 text-xs opacity-80 tabular-nums">({chip.count})</span>
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
          )}

          {/* Accessible Live Region for Screen Readers */}
          <div aria-live="polite" aria-atomic="true" className="sr-only">
            {filteredLetters.length === 26
              ? `Showing all 26 cursive letters. Letter ${activeLetter.id} currently selected.`
              : `Showing ${filteredLetters.length} letters matching filter. Letter ${activeLetter.id} currently selected.`}
          </div>
        </DialogHeader>

        {/* Split Body */}
        <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
          {/* Left: Grid View */}
          <div
            className={cn(
              "overflow-y-auto overscroll-contain focus-visible:outline-none p-3.5 sm:p-5 space-y-5 md:border-r border-border/70",
              isMobile && mobileView === "detail" ? "hidden md:block md:flex-1" : "flex-1"
            )}
          >
            {/* Letter Cards Grid */}
            <section aria-labelledby="alphabet-grid-heading" className="space-y-3">
              <div className="flex items-center justify-between">
                <h3
                  id="alphabet-grid-heading"
                  className="text-xs font-semibold uppercase tracking-wider text-muted-foreground print:text-black"
                >
                  Cursive Letterforms ({filteredLetters.length})
                </h3>
              </div>

              {filteredLetters.length === 0 ? (
                <div className="p-8 text-center rounded-xl border border-dashed border-border/80 bg-muted/20 space-y-3">
                  <p className="text-xs font-medium text-foreground">No letters match your search criteria</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleClearSearch}
                    className="gap-1.5 h-10 sm:h-8 px-3.5 text-xs font-medium text-primary bg-primary/10 hover:bg-primary/15 hover:text-primary rounded-lg"
                  >
                    <RotateCcwIcon className="size-3.5" aria-hidden="true" />
                    Reset filters
                  </Button>
                </div>
              ) : (
                <div
                  ref={gridRef}
                  onKeyDown={handleGridKeyDown}
                  role="radiogroup"
                  aria-label="Cursive alphabet letters"
                  className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3 print:grid-cols-4 print:gap-3"
                >
                  {filteredLetters.map((item) => {
                    const isSelected = activeLetter.id === item.id;
                    const letterDisplayText =
                      caseFilter === "pairs"
                        ? `${item.upper}${item.lower}`
                        : caseFilter === "upper"
                          ? item.upper
                          : item.lower;

                    return (
                      <div key={item.id} className="min-w-0 print:break-inside-avoid">
                        <Button
                          type="button"
                          variant="ghost"
                          role="radio"
                          aria-checked={isSelected}
                          data-letter-id={item.id}
                          tabIndex={isSelected ? 0 : -1}
                          onClick={() => {
                            setSelectedLetterId(item.id);
                            setMobileView("detail");
                          }}
                          aria-label={`Letter ${item.id}, ${item.zoneLabel} zone. Click to view formation guide.`}
                          className={cn(
                            "w-full relative group flex flex-col items-stretch justify-start p-0 text-left rounded-xl border transition-all duration-150 overflow-hidden cursor-pointer select-none whitespace-normal",
                            "h-20 sm:h-24 print:h-20 print:border-black print:bg-white",
                            isSelected
                              ? "border-primary ring-2 ring-primary/40 bg-card hover:bg-card dark:bg-card/90 dark:hover:bg-card/90 shadow-sm"
                              : "border-border/70 bg-card/60 hover:bg-card hover:border-border hover:shadow-2xs dark:bg-card/40 dark:hover:bg-card"
                          )}
                        >
                          <div className="relative z-10 flex items-center justify-between px-3 pt-2 pb-0.5 min-w-0">
                            <span className="font-sans font-bold text-xs text-foreground/80 tracking-tight">
                              {item.id}{item.lower}
                            </span>
                          </div>
                          <div className="relative flex-1 w-full min-h-0 overflow-hidden flex items-center justify-center">
                            <span
                              className="font-cursive text-foreground print:text-black leading-none"
                              style={{
                                fontSize: caseFilter === "pairs" ? "36px" : "42px",
                                fontWeight: 500,
                              }}
                            >
                              {letterDisplayText}
                            </span>
                          </div>
                        </Button>
                      </div>
                    );
                  })}
                </div>
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
            {renderSpotlightContent(isMobile && mobileView === "detail")}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
