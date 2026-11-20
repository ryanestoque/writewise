"use client";

import {
  memo,
  type RefObject,
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { SearchInput } from "@/components/ui/search-input";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  SlidersHorizontal,
  Trash2,
  Filter,
  X,
  ChevronDown,
  Check,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { reviewFilterHelp, type LegacyReviewFilter } from "@/lib/utils/activity-attempt-review";
import { cn } from "@/lib/utils";

export type SubmissionFilter = LegacyReviewFilter;
export type SubmissionSort =
  "attention" | "newest" | "oldest" | "name_asc" | "name_desc" | "score_desc";
export type ViewMode = "review" | "grouped" | "all";

const secondaryFilters: { id: SubmissionFilter; label: string }[] = [
  { id: "ready", label: "Ready to release" },
  { id: "returned", label: "Returned for redo" },
  { id: "excused", label: "Excused" },
  { id: "processing", label: "Analyzing strokes" },
  { id: "needs_action", label: "Needs action (any)" },
  { id: "unread_comments", label: "Unread comments" },
];

export interface ActivityReviewToolbarProps {
  searchInputRef: RefObject<HTMLInputElement | null>;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  onClearSearch: () => void;
  altKey: string;

  statusFilter: SubmissionFilter;
  onStatusFilterChange: (filter: SubmissionFilter) => void;
  submissionFilterItems: {
    id: SubmissionFilter;
    label: string;
    disabled?: boolean;
    count?: number;
  }[];

  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;

  compact: boolean;
  onLayoutChange: (layout: "compact" | "photos") => void;

  sortBy: SubmissionSort;
  onSortByChange: (sort: SubmissionSort) => void;

  managingAttempts: boolean;
  onToggleManagingAttempts: () => void;

  allVisibleSelected: boolean;
  someVisibleSelected: boolean;
  onToggleSelectAll: () => void;
  selectedCount: number;
  hiddenSelectedCount: number;
  onClearSelection: () => void;
  onClearHiddenSelection?: () => void;
}

export const ActivityReviewToolbar = memo(function ActivityReviewToolbar({
  searchInputRef,
  searchQuery,
  onSearchQueryChange,
  onClearSearch,
  altKey,
  statusFilter,
  onStatusFilterChange,
  submissionFilterItems,
  viewMode,
  onViewModeChange,
  compact,
  onLayoutChange,
  sortBy,
  onSortByChange,
  managingAttempts,
  onToggleManagingAttempts,
  allVisibleSelected,
  someVisibleSelected,
  onToggleSelectAll,
  selectedCount,
  hiddenSelectedCount,
  onClearSelection,
  onClearHiddenSelection,
}: ActivityReviewToolbarProps) {
  const allWorkFilter = submissionFilterItems.find(({ id }) => id === "all");

  const needsScoringCount =
    submissionFilterItems.find(({ id }) => id === "needs_scoring")?.count ?? 0;
  const missingCount =
    submissionFilterItems.find(({ id }) => id === "missing")?.count ?? 0;
  const releasedCount =
    submissionFilterItems.find(({ id }) => id === "released")?.count ?? 0;
  const unreadCommentsItem = submissionFilterItems.find(({ id }) => id === "unread_comments");
  const unreadCommentsCount = unreadCommentsItem?.count ?? 0;

  const isSecondaryActive = secondaryFilters.some((f) => f.id === statusFilter);
  const activeSecondaryItem = secondaryFilters.find((f) => f.id === statusFilter);
  const activeSecondaryCount = activeSecondaryItem
    ? submissionFilterItems.find((f) => f.id === activeSecondaryItem.id)?.count
    : undefined;

  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 4);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 4);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    checkScroll();

    const handleScroll = () => checkScroll();
    el.addEventListener("scroll", handleScroll, { passive: true });

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => checkScroll());
      resizeObserver.observe(el);
    } else {
      window.addEventListener("resize", handleScroll);
    }

    return () => {
      el.removeEventListener("scroll", handleScroll);
      if (resizeObserver) {
        resizeObserver.disconnect();
      } else {
        window.removeEventListener("resize", handleScroll);
      }
    };
  }, [checkScroll]);

  // Scroll active filter pill into view smoothly when changed
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const activeEl = el.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (activeEl) {
      activeEl.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
        block: "nearest",
        inline: "nearest",
      });
    }
  }, [statusFilter]);

  const handleScrollLeft = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({
        left: -180,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
    }
  };

  const handleScrollRight = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({
        left: 180,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
    }
  };

  const maskStyle: React.CSSProperties = useMemo(() => {
    if (canScrollLeft && canScrollRight) {
      return {
        WebkitMaskImage:
          "linear-gradient(to right, transparent, black 24px, black calc(100% - 24px), transparent)",
        maskImage:
          "linear-gradient(to right, transparent, black 24px, black calc(100% - 24px), transparent)",
      };
    }
    if (canScrollLeft) {
      return {
        WebkitMaskImage:
          "linear-gradient(to right, transparent, black 24px, black 100%)",
        maskImage:
          "linear-gradient(to right, transparent, black 24px, black 100%)",
      };
    }
    if (canScrollRight) {
      return {
        WebkitMaskImage:
          "linear-gradient(to right, black 0%, black calc(100% - 24px), transparent)",
        maskImage:
          "linear-gradient(to right, black 0%, black calc(100% - 24px), transparent)",
      };
    }
    return {};
  }, [canScrollLeft, canScrollRight]);

  return (
    <div className="flex flex-col gap-2.5">
      {/* Contained Filter & Search Toolbar Card matching Activities directory style */}
      <div className="bg-surface dark:bg-card p-3 rounded-xl sm:rounded-2xl border border-border shadow-warm flex flex-col gap-2.5 sm:gap-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 sm:gap-3">
          {/* Status filter pills track with scroll indicators */}
          <div className="relative min-w-0 flex-1 flex items-center group/pills">
            {canScrollLeft && (
              <button
                type="button"
                onClick={handleScrollLeft}
                aria-label="Scroll filters left"
                tabIndex={-1}
                className="absolute left-0 z-10 flex size-7 items-center justify-center rounded-full border border-border bg-background/90 text-foreground shadow-xs backdrop-blur-xs transition-opacity hover:bg-muted focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring cursor-pointer shrink-0"
              >
                <ChevronLeft className="size-4" />
              </button>
            )}

            <div
              ref={scrollRef}
              role="group"
              aria-label="Student work inbox filters"
              style={maskStyle}
              className="flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden scroll-smooth max-w-full touch-pan-x overscroll-x-contain py-0.5"
            >
              <button
                type="button"
                onClick={() => {
                  if (viewMode !== "grouped") onViewModeChange("grouped");
                  onStatusFilterChange("all");
                }}
                aria-pressed={statusFilter === "all"}
                className={cn(
                  "relative inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 min-h-[34px] sm:min-h-[32px] text-xs font-medium rounded-lg border transition-all shrink-0 cursor-pointer whitespace-nowrap focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
                  statusFilter === "all"
                    ? "bg-brand-700 dark:bg-primary text-white dark:text-primary-foreground border-brand-700 dark:border-primary shadow-warm-sm font-semibold"
                    : "bg-background text-muted-foreground border-border hover:bg-muted/60 hover:text-foreground"
                )}
              >
                <span>All Students</span>
                {allWorkFilter?.count != null && (
                  <span
                    className={cn(
                      "text-xs font-semibold px-1.5 py-0.5 rounded-full transition-colors tabular-nums",
                      statusFilter === "all"
                        ? "bg-white/20 dark:bg-primary-foreground/20 text-white dark:text-primary-foreground"
                        : "bg-muted text-foreground"
                    )}
                  >
                    {allWorkFilter.count}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  if (viewMode !== "grouped") onViewModeChange("grouped");
                  onStatusFilterChange("needs_scoring");
                }}
                aria-pressed={statusFilter === "needs_scoring"}
                className={cn(
                  "relative inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 min-h-[34px] sm:min-h-[32px] text-xs font-medium rounded-lg border transition-all shrink-0 cursor-pointer whitespace-nowrap focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
                  statusFilter === "needs_scoring"
                    ? "bg-brand-700 dark:bg-primary text-white dark:text-primary-foreground border-brand-700 dark:border-primary shadow-warm-sm font-semibold"
                    : "bg-background text-muted-foreground border-border hover:bg-muted/60 hover:text-foreground"
                )}
              >
                <span>To Grade</span>
                {needsScoringCount > 0 && (
                  <span
                    className={cn(
                      "text-xs font-semibold px-1.5 py-0.5 rounded-full transition-colors tabular-nums",
                      statusFilter === "needs_scoring"
                        ? "bg-white/20 dark:bg-primary-foreground/20 text-white dark:text-primary-foreground"
                        : "bg-primary/10 text-primary font-bold"
                    )}
                  >
                    {needsScoringCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  if (viewMode !== "grouped") onViewModeChange("grouped");
                  onStatusFilterChange("missing");
                }}
                aria-pressed={statusFilter === "missing"}
                className={cn(
                  "relative inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 min-h-[34px] sm:min-h-[32px] text-xs font-medium rounded-lg border transition-all shrink-0 cursor-pointer whitespace-nowrap focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
                  statusFilter === "missing"
                    ? "bg-brand-700 dark:bg-primary text-white dark:text-primary-foreground border-brand-700 dark:border-primary shadow-warm-sm font-semibold"
                    : "bg-background text-muted-foreground border-border hover:bg-muted/60 hover:text-foreground"
                )}
              >
                <span>Missing</span>
                {missingCount > 0 && (
                  <span
                    className={cn(
                      "text-xs font-semibold px-1.5 py-0.5 rounded-full transition-colors tabular-nums",
                      statusFilter === "missing"
                        ? "bg-white/20 dark:bg-primary-foreground/20 text-white dark:text-primary-foreground"
                        : "bg-muted text-foreground"
                    )}
                  >
                    {missingCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  if (viewMode !== "grouped") onViewModeChange("grouped");
                  onStatusFilterChange("released");
                }}
                aria-pressed={statusFilter === "released"}
                className={cn(
                  "relative inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 min-h-[34px] sm:min-h-[32px] text-xs font-medium rounded-lg border transition-all shrink-0 cursor-pointer whitespace-nowrap focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
                  statusFilter === "released"
                    ? "bg-band-4 text-white border-band-4 shadow-warm-sm font-semibold"
                    : "bg-background text-muted-foreground border-border hover:bg-muted/60 hover:text-foreground"
                )}
              >
                <span>Done &amp; Released</span>
                {releasedCount > 0 && (
                  <span
                    className={cn(
                      "text-xs font-semibold px-1.5 py-0.5 rounded-full transition-colors tabular-nums",
                      statusFilter === "released"
                        ? "bg-white/20 text-white"
                        : "bg-muted text-foreground"
                    )}
                  >
                    {releasedCount}
                  </span>
                )}
              </button>

              {unreadCommentsCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    if (viewMode !== "grouped") onViewModeChange("grouped");
                    onStatusFilterChange("unread_comments");
                  }}
                  aria-pressed={statusFilter === "unread_comments"}
                  className={cn(
                    "relative inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 min-h-[34px] sm:min-h-[32px] text-xs font-medium rounded-lg border transition-all shrink-0 cursor-pointer whitespace-nowrap focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
                    statusFilter === "unread_comments"
                      ? "bg-brand-700 dark:bg-primary text-white dark:text-primary-foreground border-brand-700 dark:border-primary shadow-warm-sm font-semibold"
                      : "border-primary/30 text-primary bg-primary/5 hover:bg-primary/10"
                  )}
                >
                  <MessageSquare className="size-3.5 shrink-0" aria-hidden="true" />
                  <span>Unread Notes</span>
                  <span
                    className={cn(
                      "text-xs font-semibold px-1.5 py-0.5 rounded-full transition-colors tabular-nums",
                      statusFilter === "unread_comments"
                        ? "bg-white/20 dark:bg-primary-foreground/20 text-white dark:text-primary-foreground"
                        : "bg-primary/15 text-primary"
                    )}
                  >
                    {unreadCommentsCount}
                  </span>
                </button>
              )}

              <div className="inline-flex items-center shrink-0">
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <button
                        type="button"
                        aria-pressed={isSecondaryActive}
                        className={cn(
                          "relative inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 min-h-[34px] sm:min-h-[32px] text-xs font-medium rounded-lg border transition-all shrink-0 cursor-pointer whitespace-nowrap focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
                          isSecondaryActive
                            ? "rounded-r-none bg-brand-700 dark:bg-primary text-white dark:text-primary-foreground border-brand-700 dark:border-primary shadow-warm-sm font-semibold"
                            : "bg-background text-muted-foreground border-border hover:bg-muted/60 hover:text-foreground"
                        )}
                      />
                    }
                  >
                    <Filter className="size-3.5 shrink-0" aria-hidden="true" />
                    <span>{isSecondaryActive ? activeSecondaryItem?.label : "More filters"}</span>
                    {isSecondaryActive && activeSecondaryCount != null && (
                      <span className="rounded-full bg-white/20 dark:bg-primary-foreground/20 text-white dark:text-primary-foreground px-1.5 py-0.5 text-xs font-semibold tabular-nums">
                        {activeSecondaryCount}
                      </span>
                    )}
                    <ChevronDown className="size-3 opacity-70 shrink-0" aria-hidden="true" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56 text-xs">
                    <DropdownMenuGroup>
                      <DropdownMenuLabel className="text-muted-foreground px-2 py-1.5 text-xs font-semibold uppercase tracking-wider">
                        Additional Statuses
                      </DropdownMenuLabel>
                      {secondaryFilters.map((sf) => {
                        const item = submissionFilterItems.find((f) => f.id === sf.id);
                        const isSelected = statusFilter === sf.id;
                        return (
                          <DropdownMenuItem
                            key={sf.id}
                            onClick={() => {
                              if (viewMode !== "grouped") onViewModeChange("grouped");
                              onStatusFilterChange(sf.id);
                            }}
                            className={cn(
                              "min-h-9 cursor-pointer justify-between text-xs",
                              isSelected && "bg-primary/10 text-primary font-medium"
                            )}
                          >
                            <span>{sf.label}</span>
                            <div className="text-muted-foreground flex items-center gap-1.5">
                              {item?.count != null && <span className="tabular-nums">({item.count})</span>}
                              {isSelected && <Check className="text-primary size-3 stroke-[2.5]" aria-hidden="true" />}
                            </div>
                          </DropdownMenuItem>
                        );
                      })}
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
                {isSecondaryActive && (
                  <button
                    type="button"
                    aria-label="Clear additional filter"
                    onClick={() => onStatusFilterChange("all")}
                    className="size-[34px] min-h-[34px] min-w-[34px] sm:size-[32px] sm:min-h-[32px] sm:min-w-[32px] inline-flex items-center justify-center rounded-r-lg border border-l-0 border-brand-700 dark:border-primary bg-brand-700 dark:bg-primary text-white dark:text-primary-foreground hover:bg-destructive hover:border-destructive hover:text-white transition-colors cursor-pointer shrink-0 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <X className="size-3.5" aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>

            {canScrollRight && (
              <button
                type="button"
                onClick={handleScrollRight}
                aria-label="Scroll filters right"
                tabIndex={-1}
                className="absolute right-0 z-10 flex size-7 items-center justify-center rounded-full border border-border bg-background/90 text-foreground shadow-xs backdrop-blur-xs transition-opacity hover:bg-muted focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring cursor-pointer shrink-0"
              >
                <ChevronRight className="size-4" />
              </button>
            )}
          </div>

          {/* Search and View controls */}
          <div className="flex items-center gap-2 w-full lg:w-auto shrink-0">
            <SearchInput
              ref={searchInputRef}
              placeholder="Search student name…"
              aria-label="Search by student name"
              shortcutKey={`${altKey}+/`}
              aria-keyshortcuts="Alt+/"
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              onClear={onClearSearch}
              containerClassName="w-auto flex-1 min-w-0 sm:flex-initial sm:w-64 lg:w-60 xl:w-72"
            />
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="outline"
                    className="h-10 sm:h-9 min-h-[44px] sm:min-h-[36px] px-3 shrink-0 rounded-lg sm:rounded-xl gap-1.5 cursor-pointer font-medium text-xs sm:text-sm transition-colors border-border bg-background hover:bg-muted/60"
                  />
                }
              >
                <SlidersHorizontal className="size-3.5 sm:size-4 shrink-0" aria-hidden="true" />
                <span>View</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                {viewMode !== "review" && (
                  <>
                    <DropdownMenuGroup>
                      <DropdownMenuLabel>Layout</DropdownMenuLabel>
                      <DropdownMenuRadioGroup
                        value={compact ? "compact" : "photos"}
                        onValueChange={(value) => onLayoutChange(value as "compact" | "photos")}
                      >
                        <DropdownMenuRadioItem value="compact" className="min-h-11">
                          Compact
                        </DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="photos" className="min-h-11">
                          Photos
                        </DropdownMenuRadioItem>
                      </DropdownMenuRadioGroup>
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Sort work</DropdownMenuLabel>
                  <DropdownMenuRadioGroup
                    value={sortBy}
                    onValueChange={(value) => onSortByChange(value as SubmissionSort)}
                  >
                    {viewMode === "review" && (
                      <DropdownMenuRadioItem value="attention" className="min-h-11">
                        Review-ready first
                      </DropdownMenuRadioItem>
                    )}
                    <DropdownMenuRadioItem value="newest" className="min-h-11">
                      Newest first
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="oldest" className="min-h-11">
                      Oldest first
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="name_asc" className="min-h-11">
                      Student (A-Z)
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="name_desc" className="min-h-11">
                      Student (Z-A)
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="score_desc" className="min-h-11">
                      Highest score
                    </DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuGroup>
                {viewMode !== "review" && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuGroup>
                      <DropdownMenuLabel>Batch actions</DropdownMenuLabel>
                      <DropdownMenuItem
                        onClick={onToggleManagingAttempts}
                        className="min-h-11 cursor-pointer text-muted-foreground hover:text-foreground gap-2"
                      >
                        <Trash2 className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                        <span>{managingAttempts ? "Exit batch selection" : "Batch select attempts..."}</span>
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {viewMode !== "review" && reviewFilterHelp[statusFilter] && (
          <p id="review-filter-help" className="text-muted-foreground text-xs pt-1.5 border-t border-border/60">
            {reviewFilterHelp[statusFilter]}
          </p>
        )}
      </div>

      {managingAttempts && (
        <div className="bg-muted/40 flex flex-wrap items-center gap-2 rounded-lg border p-3">
          <div className="inline-flex min-h-11 items-center gap-2 text-sm">
            <Checkbox
              id="select-all-displayed-attempts"
              checked={allVisibleSelected}
              indeterminate={someVisibleSelected}
              onCheckedChange={onToggleSelectAll}
              aria-label="Select all visible attempts to delete"
            />
            <label
              htmlFor="select-all-displayed-attempts"
              className="cursor-pointer text-sm select-none"
            >
              Select displayed attempts to delete
            </label>
          </div>
          <span className="text-muted-foreground text-xs">
            {selectedCount} selected. Selection does not limit release.
          </span>
          {hiddenSelectedCount > 0 && (
            <div className="flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-xs text-amber-900 dark:text-amber-200">
              <span>{hiddenSelectedCount} hidden not shown</span>
              {onClearHiddenSelection && (
                <button
                  type="button"
                  onClick={onClearHiddenSelection}
                  className="ml-1 underline hover:no-underline font-semibold cursor-pointer rounded focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
                >
                  Clear hidden
                </button>
              )}
            </div>
          )}
          {selectedCount > 0 && (
            <Button variant="ghost" onClick={onClearSelection} className="min-h-11">
              Clear
            </Button>
          )}
          <Button variant="outline" className="ml-auto min-h-11" onClick={onToggleManagingAttempts}>
            Done
          </Button>
        </div>
      )}
    </div>
  );
});
