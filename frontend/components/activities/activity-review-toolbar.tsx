"use client";

import { memo, type RefObject } from "react";
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
import { SlidersHorizontal, Trash2, Filter, X, ChevronDown, Check } from "lucide-react";
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

  const isSecondaryActive = secondaryFilters.some((f) => f.id === statusFilter);
  const activeSecondaryItem = secondaryFilters.find((f) => f.id === statusFilter);
  const activeSecondaryCount = activeSecondaryItem
    ? submissionFilterItems.find((f) => f.id === activeSecondaryItem.id)?.count
    : undefined;

  return (
    <div className="flex flex-col gap-2.5">
      <div
        role="group"
        aria-label="Student work inbox filters"
        className="border-border flex flex-wrap items-center gap-1.5 border-b pb-2.5"
      >
        <Button
          type="button"
          variant={statusFilter === "all" ? "secondary" : "ghost"}
          aria-pressed={statusFilter === "all"}
          onClick={() => {
            if (viewMode !== "grouped") onViewModeChange("grouped");
            onStatusFilterChange("all");
          }}
          className={cn(
            "min-h-[44px] md:min-h-[36px] px-3 text-xs font-semibold rounded-lg gap-2 cursor-pointer transition-all",
            statusFilter === "all"
              ? "bg-primary/10 text-primary hover:bg-primary/15 font-semibold"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          )}
        >
          <span>All Students</span>
          {allWorkFilter?.count != null && (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs font-bold tabular-nums",
                statusFilter === "all"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {allWorkFilter.count}
            </span>
          )}
        </Button>

        <Button
          type="button"
          variant={statusFilter === "needs_scoring" ? "secondary" : "ghost"}
          aria-pressed={statusFilter === "needs_scoring"}
          onClick={() => {
            if (viewMode !== "grouped") onViewModeChange("grouped");
            onStatusFilterChange("needs_scoring");
          }}
          className={cn(
            "min-h-[44px] md:min-h-[36px] px-3 text-xs font-semibold rounded-lg gap-2 cursor-pointer transition-all",
            statusFilter === "needs_scoring"
              ? "bg-amber-500/15 text-amber-900 dark:text-amber-300 hover:bg-amber-500/20 font-semibold"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          )}
        >
          <span>To Grade</span>
          {needsScoringCount > 0 && (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs font-bold tabular-nums",
                statusFilter === "needs_scoring"
                  ? "bg-amber-900 text-white dark:bg-amber-300 dark:text-amber-950"
                  : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
              )}
            >
              {needsScoringCount}
            </span>
          )}
        </Button>

        <Button
          type="button"
          variant={statusFilter === "missing" ? "secondary" : "ghost"}
          aria-pressed={statusFilter === "missing"}
          onClick={() => {
            if (viewMode !== "grouped") onViewModeChange("grouped");
            onStatusFilterChange("missing");
          }}
          className={cn(
            "min-h-[44px] md:min-h-[36px] px-3 text-xs font-semibold rounded-lg gap-2 cursor-pointer transition-all",
            statusFilter === "missing"
              ? "bg-primary/10 text-primary hover:bg-primary/15 font-semibold"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          )}
        >
          <span>Missing</span>
          {missingCount > 0 && (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs font-bold tabular-nums",
                statusFilter === "missing"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {missingCount}
            </span>
          )}
        </Button>

        <Button
          type="button"
          variant={statusFilter === "released" ? "secondary" : "ghost"}
          aria-pressed={statusFilter === "released"}
          onClick={() => {
            if (viewMode !== "grouped") onViewModeChange("grouped");
            onStatusFilterChange("released");
          }}
          className={cn(
            "min-h-[44px] md:min-h-[36px] px-3 text-xs font-semibold rounded-lg gap-2 cursor-pointer transition-all",
            statusFilter === "released"
              ? "bg-emerald-500/15 text-emerald-900 dark:text-emerald-300 hover:bg-emerald-500/20 font-semibold"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          )}
        >
          <span>Done &amp; Released</span>
          {releasedCount > 0 && (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs font-bold tabular-nums",
                statusFilter === "released"
                  ? "bg-emerald-900 text-white dark:bg-emerald-300 dark:text-emerald-950"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {releasedCount}
            </span>
          )}
        </Button>

        <div className="inline-flex items-center">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  variant={isSecondaryActive ? "secondary" : "ghost"}
                  className={cn(
                    "min-h-[44px] md:min-h-[36px] px-3 text-xs font-medium rounded-lg gap-1.5 cursor-pointer transition-all",
                    isSecondaryActive
                      ? "rounded-r-none bg-primary/10 text-primary hover:bg-primary/15 font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                />
              }
            >
              <Filter className="size-3.5" aria-hidden="true" />
              <span>{isSecondaryActive ? activeSecondaryItem?.label : "More filters"}</span>
              {isSecondaryActive && activeSecondaryCount != null && (
                <span className="rounded-full bg-primary/20 text-primary px-1.5 py-0.5 text-xs font-bold tabular-nums">
                  {activeSecondaryCount}
                </span>
              )}
              <ChevronDown className="size-3 opacity-60" aria-hidden="true" />
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
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Clear additional filter"
              onClick={() => onStatusFilterChange("all")}
              className="size-11 min-h-[44px] min-w-[44px] md:size-9 md:min-h-[36px] md:min-w-[36px] rounded-l-none bg-primary/10 text-primary hover:bg-destructive/10 hover:text-destructive transition-colors cursor-pointer active:translate-y-0 active:not-aria-[haspopup]:translate-y-0"
            >
              <X className="size-3.5" aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          ref={searchInputRef}
          placeholder="Search student name…"
          aria-label="Search by student name"
          shortcutKey={`${altKey}+/`}
          aria-keyshortcuts="Alt+/"
          value={searchQuery}
          onChange={(e) => onSearchQueryChange(e.target.value)}
          onClear={onClearSearch}
          containerClassName="w-full sm:w-64 sm:flex-1"
        />
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="outline" className="h-11 md:h-9" />}
          >
            <SlidersHorizontal data-icon="inline-start" />
            View
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
          </DropdownMenuContent>
        </DropdownMenu>

        {viewMode !== "review" && (
          <Button
            type="button"
            variant={managingAttempts ? "secondary" : "outline"}
            size="default"
            onClick={onToggleManagingAttempts}
            aria-pressed={managingAttempts}
            className={cn(
              "min-h-[44px] md:min-h-[36px] px-3 rounded-lg text-xs font-medium cursor-pointer transition-all gap-1.5",
              managingAttempts
                ? "bg-destructive/10 text-destructive border-destructive/30 hover:bg-destructive/15 font-semibold"
                : "text-muted-foreground hover:text-foreground border-border hover:bg-muted/50"
            )}
          >
            <Trash2 className="size-3.5 shrink-0" aria-hidden="true" />
            <span>{managingAttempts ? "Done Managing" : "Manage Attempts"}</span>
          </Button>
        )}
      </div>

      {viewMode !== "review" && reviewFilterHelp[statusFilter] && (
        <p id="review-filter-help" className="text-muted-foreground text-sm">
          {reviewFilterHelp[statusFilter]}
        </p>
      )}

      {viewMode !== "review" && (
        <p className="text-muted-foreground hidden text-xs sm:block">
          {compact ? "Compact" : "Photos"} ·{" "}
          {sortBy === "newest"
            ? "Newest first"
            : sortBy === "oldest"
              ? "Oldest first"
              : sortBy === "name_asc"
                ? "Student (A-Z)"
                : sortBy === "name_desc"
                  ? "Student (Z-A)"
                  : "Highest score"}
        </p>
      )}

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
                  className="ml-1 underline hover:no-underline font-semibold cursor-pointer"
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
