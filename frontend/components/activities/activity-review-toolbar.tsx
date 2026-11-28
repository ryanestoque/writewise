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
import { Alert, AlertAction, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  SlidersHorizontal,
  CheckSquare,
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

const PILL_BASE_CLASS =
  "relative h-auto min-h-11 gap-1.5 rounded-lg border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition-all cursor-pointer whitespace-nowrap touch-manipulation hover:bg-muted/60 hover:text-foreground sm:min-h-8 data-pressed:border-primary data-pressed:bg-primary data-pressed:font-semibold data-pressed:text-primary-foreground data-pressed:shadow-warm-sm data-pressed:hover:bg-primary data-pressed:hover:text-primary-foreground";

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

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const getViewport = useCallback(() => {
    return (
      scrollAreaRef.current?.querySelector<HTMLElement>(
        '[data-slot="scroll-area-viewport"]'
      ) ?? null
    );
  }, []);

  const checkScroll = useCallback(() => {
    const el = getViewport();
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 4);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 4);
  }, [getViewport]);

  useEffect(() => {
    const el = getViewport();
    if (!el) return;

    const rafId = window.requestAnimationFrame(() => checkScroll());

    const handleScroll = () => checkScroll();
    el.addEventListener("scroll", handleScroll, { passive: true });

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => checkScroll());
      resizeObserver.observe(el);
      if (el.firstElementChild) {
        resizeObserver.observe(el.firstElementChild);
      }
    } else {
      window.addEventListener("resize", handleScroll);
    }

    return () => {
      window.cancelAnimationFrame(rafId);
      el.removeEventListener("scroll", handleScroll);
      if (resizeObserver) {
        resizeObserver.disconnect();
      } else {
        window.removeEventListener("resize", handleScroll);
      }
    };
  }, [checkScroll, getViewport]);

  // Scroll active filter pill into view smoothly when changed
  useEffect(() => {
    const el = getViewport();
    if (!el) return;

    const activeEl = el.querySelector<HTMLElement>('[data-pressed], [aria-pressed="true"]');
    if (activeEl) {
      activeEl.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
        block: "nearest",
        inline: "nearest",
      });
    }
  }, [getViewport, statusFilter]);

  const handleScrollLeft = () => {
    const el = getViewport();
    if (el) {
      el.scrollBy({
        left: -180,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
    }
  };

  const handleScrollRight = () => {
    const el = getViewport();
    if (el) {
      el.scrollBy({
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
      <Card size="sm" className="p-3 sm:rounded-2xl">
        <CardContent className="p-0 flex flex-col gap-2.5 sm:gap-3">
          <div className="flex flex-col justify-between gap-2.5 sm:gap-3 md:flex-row md:items-center">
            {/* Status filter pills track with scroll indicators */}
            <div className="group/pills relative flex min-w-0 flex-1 items-center">
              {canScrollLeft && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon-xs"
                  onClick={handleScrollLeft}
                  aria-hidden="true"
                  tabIndex={-1}
                  className="absolute left-0 z-10 size-8 sm:size-7 rounded-full bg-background/90 text-foreground shadow-xs backdrop-blur-xs transition-opacity hover:bg-muted"
                >
                  <ChevronLeft aria-hidden="true" />
                </Button>
              )}

              <ScrollArea
                ref={scrollAreaRef}
                orientation="horizontal"
                hideScrollbar
                style={maskStyle}
                viewportClassName="overscroll-x-contain"
                className="w-full min-w-0 touch-pan-x touch-pan-y transition-[mask-image]"
              >
                <div className="flex w-max items-center gap-1.5 py-0.5">
                  <ToggleGroup
                    value={[statusFilter]}
                    multiple={false}
                    spacing={1.5}
                    onValueChange={(vals) => {
                      if (vals.length > 0) {
                        if (viewMode !== "grouped") onViewModeChange("grouped");
                        onStatusFilterChange(vals[0] as SubmissionFilter);
                      }
                    }}
                    aria-label="Student work inbox filters"
                    className="flex items-center gap-1.5"
                  >
                    <ToggleGroupItem
                      value="all"
                      variant="outline"
                      size="sm"
                      className={PILL_BASE_CLASS}
                    >
                      <span>All Students</span>
                      {allWorkFilter?.count != null && (
                        <Badge
                          variant="secondary"
                          className={cn(
                            "h-auto rounded-full px-1.5 py-0.5 text-xs font-semibold tabular-nums transition-colors",
                            statusFilter === "all" && "bg-primary-foreground/20 text-primary-foreground"
                          )}
                        >
                          {allWorkFilter.count}
                        </Badge>
                      )}
                    </ToggleGroupItem>

                    <ToggleGroupItem
                      value="needs_scoring"
                      variant="outline"
                      size="sm"
                      className={PILL_BASE_CLASS}
                    >
                      <span>To Grade</span>
                      {needsScoringCount > 0 && (
                        <Badge
                          variant="secondary"
                          className={cn(
                            "h-auto rounded-full px-1.5 py-0.5 text-xs font-semibold tabular-nums transition-colors",
                            statusFilter === "needs_scoring"
                              ? "bg-primary-foreground/20 text-primary-foreground"
                              : "bg-primary/10 text-primary font-bold"
                          )}
                        >
                          {needsScoringCount}
                        </Badge>
                      )}
                    </ToggleGroupItem>

                    <ToggleGroupItem
                      value="missing"
                      variant="outline"
                      size="sm"
                      className={PILL_BASE_CLASS}
                    >
                      <span>Missing</span>
                      {missingCount > 0 && (
                        <Badge
                          variant="secondary"
                          className={cn(
                            "h-auto rounded-full px-1.5 py-0.5 text-xs font-semibold tabular-nums transition-colors",
                            statusFilter === "missing" && "bg-primary-foreground/20 text-primary-foreground"
                          )}
                        >
                          {missingCount}
                        </Badge>
                      )}
                    </ToggleGroupItem>

                    <ToggleGroupItem
                      value="released"
                      variant="outline"
                      size="sm"
                      className={PILL_BASE_CLASS}
                    >
                      <span>Done &amp; Released</span>
                      {releasedCount > 0 && (
                        <Badge
                          variant="secondary"
                          className={cn(
                            "h-auto rounded-full px-1.5 py-0.5 text-xs font-semibold tabular-nums transition-colors",
                            statusFilter === "released" && "bg-primary-foreground/20 text-primary-foreground"
                          )}
                        >
                          {releasedCount}
                        </Badge>
                      )}
                    </ToggleGroupItem>

                    {unreadCommentsCount > 0 && (
                      <ToggleGroupItem
                        value="unread_comments"
                        variant="outline"
                        size="sm"
                        className={cn(
                          PILL_BASE_CLASS,
                          statusFilter !== "unread_comments" &&
                            "border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 hover:text-primary"
                        )}
                      >
                        <MessageSquare data-icon="inline-start" aria-hidden="true" />
                        <span>Unread Comments</span>
                        <Badge
                          variant="secondary"
                          className={cn(
                            "h-auto rounded-full px-1.5 py-0.5 text-xs font-semibold tabular-nums transition-colors",
                            statusFilter === "unread_comments"
                              ? "bg-primary-foreground/20 text-primary-foreground"
                              : "bg-primary/15 text-primary"
                          )}
                        >
                          {unreadCommentsCount}
                        </Badge>
                      </ToggleGroupItem>
                    )}
                  </ToggleGroup>

                  <ButtonGroup className="shrink-0">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            type="button"
                            variant={isSecondaryActive ? "default" : "outline"}
                            size="sm"
                            aria-pressed={isSecondaryActive}
                            className={cn(
                              "min-h-11 sm:min-h-8 text-xs font-medium",
                              isSecondaryActive && "font-semibold shadow-warm-sm",
                              !isSecondaryActive && "text-muted-foreground hover:text-foreground"
                            )}
                          />
                        }
                      >
                        <Filter data-icon="inline-start" aria-hidden="true" />
                        <span>{isSecondaryActive ? activeSecondaryItem?.label : "More filters"}</span>
                        {isSecondaryActive && activeSecondaryCount != null && (
                          <Badge
                            variant="secondary"
                            className="h-auto rounded-full bg-primary-foreground/20 px-1.5 py-0.5 text-xs font-semibold text-primary-foreground tabular-nums"
                          >
                            {activeSecondaryCount}
                          </Badge>
                        )}
                        <ChevronDown data-icon="inline-end" className="opacity-70" aria-hidden="true" />
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
                                  {isSelected && <Check className="text-primary stroke-[2.5]" aria-hidden="true" />}
                                </div>
                              </DropdownMenuItem>
                            );
                          })}
                        </DropdownMenuGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    {isSecondaryActive && (
                      <Button
                        type="button"
                        variant="default"
                        size="icon-sm"
                        aria-label="Clear additional filter"
                        onClick={() => onStatusFilterChange("all")}
                        className="min-h-11 min-w-11 sm:min-h-8 sm:min-w-8 shrink-0 hover:bg-destructive hover:text-destructive-foreground"
                      >
                        <X aria-hidden="true" />
                      </Button>
                    )}
                  </ButtonGroup>
                </div>
              </ScrollArea>

              {canScrollRight && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon-xs"
                  onClick={handleScrollRight}
                  aria-hidden="true"
                  tabIndex={-1}
                  className="absolute right-0 z-10 size-8 sm:size-7 rounded-full bg-background/90 text-foreground shadow-xs backdrop-blur-xs transition-opacity hover:bg-muted"
                >
                  <ChevronRight aria-hidden="true" />
                </Button>
              )}
            </div>

            {/* Search and View controls */}
            <div className="flex w-full shrink-0 items-center gap-2 md:w-auto">
              <SearchInput
                ref={searchInputRef}
                placeholder="Search student name…"
                aria-label="Search by student name"
                shortcutKey={`${altKey}+/`}
                aria-keyshortcuts="Alt+/"
                value={searchQuery}
                onChange={(e) => onSearchQueryChange(e.target.value)}
                onClear={onClearSearch}
                containerClassName="w-auto flex-1 min-w-0 sm:flex-initial sm:w-56 md:w-52 lg:w-60 xl:w-72"
              />
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="outline"
                      className="h-10 sm:h-9 min-h-11 sm:min-h-9 px-3 shrink-0 rounded-lg sm:rounded-xl font-medium text-xs sm:text-sm"
                    />
                  }
                >
                  <SlidersHorizontal data-icon="inline-start" aria-hidden="true" />
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
                          className="min-h-11 cursor-pointer text-muted-foreground hover:text-foreground"
                        >
                          <CheckSquare className="text-muted-foreground" aria-hidden="true" />
                          <span>{managingAttempts ? "Exit selection" : "Select multiple…"}</span>
                        </DropdownMenuItem>
                      </DropdownMenuGroup>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {viewMode !== "review" && reviewFilterHelp[statusFilter] && (
            <>
              <Separator />
              <p id="review-filter-help" className="text-xs text-muted-foreground">
                {reviewFilterHelp[statusFilter]}
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {managingAttempts && (
        <Card size="sm" className="bg-muted/40 p-3">
          <CardContent className="p-0 flex flex-wrap items-center gap-2">
            <Field orientation="horizontal" className="w-auto min-h-11 items-center gap-2">
              <Checkbox
                id="select-all-displayed-attempts"
                checked={allVisibleSelected}
                indeterminate={someVisibleSelected}
                onCheckedChange={onToggleSelectAll}
                aria-label="Select all displayed attempts"
              />
              <FieldLabel
                htmlFor="select-all-displayed-attempts"
                className="cursor-pointer text-sm font-normal select-none"
              >
                Select displayed attempts
              </FieldLabel>
            </Field>
            <span className="text-muted-foreground text-xs">
              {selectedCount} selected. Use the bar below to release, excuse, or delete.
            </span>
            {hiddenSelectedCount > 0 && (
              <Alert className="flex w-auto items-center gap-2 border-band-2/40 bg-band-2/15 px-3 py-1.5 text-xs text-band-2-text">
                <AlertDescription className="text-xs text-band-2-text">
                  {hiddenSelectedCount} hidden not shown
                </AlertDescription>
                {onClearHiddenSelection && (
                  <AlertAction className="static ml-1">
                    <Button
                      type="button"
                      variant="link"
                      size="xs"
                      onClick={onClearHiddenSelection}
                      className="h-auto px-0 py-0 text-xs font-semibold text-band-2-text underline hover:no-underline"
                    >
                      Clear hidden
                    </Button>
                  </AlertAction>
                )}
              </Alert>
            )}
            {selectedCount > 0 && (
              <Button variant="ghost" onClick={onClearSelection} className="min-h-11">
                Clear
              </Button>
            )}
            <Button variant="outline" className="ml-auto min-h-11" onClick={onToggleManagingAttempts}>
              Done
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
});
