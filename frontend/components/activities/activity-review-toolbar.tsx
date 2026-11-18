"use client";

import { memo, type RefObject } from "react";
import { SearchInput } from "@/components/ui/search-input";
import { NativeSelect, NativeSelectOptGroup, NativeSelectOption } from "@/components/ui/native-select";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { SlidersHorizontal, Trash2 } from "lucide-react";
import { reviewFilterHelp, type LegacyReviewFilter } from "@/lib/utils/activity-attempt-review";

export type SubmissionFilter = LegacyReviewFilter;
export type SubmissionSort =
  "attention" | "newest" | "oldest" | "name_asc" | "name_desc" | "score_desc";
export type ViewMode = "review" | "grouped" | "all";

const workViews = [
  { id: "review", label: "Review queue" },
  { id: "grouped", label: "By student" },
  { id: "all", label: "All uploads" },
] as const;

const filterGroups = [
  { label: "Needs action", filters: ["needs_scoring", "ready", "needs_upload", "missing", "returned"] },
  { label: "Other statuses", filters: ["processing", "released", "excused", "no_upload"] },
] as const;

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
}: ActivityReviewToolbarProps) {
  const allWorkFilter = submissionFilterItems.find(({ id }) => id === "all");

  return (
    <div className="flex flex-col gap-2.5">
      <div
        role="group"
        aria-label="Student work view"
        className="border-border grid grid-cols-3 gap-1 border-b pb-2 sm:flex sm:flex-wrap"
      >
        {workViews.map(({ id, label }) => (
          <Button
            key={id}
            variant={id === viewMode ? "secondary" : "ghost"}
            aria-pressed={id === viewMode}
            onClick={() => {
              if (id !== viewMode) onViewModeChange(id);
            }}
            className="h-auto min-h-11 min-w-0 px-1.5 text-center whitespace-normal sm:px-3 md:min-h-9"
          >
            {label}
          </Button>
        ))}
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
        {viewMode !== "review" && (
          <NativeSelect
            aria-label="Filter student work by status"
            aria-describedby={reviewFilterHelp[statusFilter] ? "review-filter-help" : undefined}
            value={statusFilter}
            onChange={(event) => onStatusFilterChange(event.target.value as SubmissionFilter)}
            className="min-w-0 flex-1 sm:flex-none [&_select]:min-h-11 md:[&_select]:min-h-9"
          >
            <NativeSelectOption value="all">
              {allWorkFilter?.label ?? "All work"}
              {allWorkFilter?.count != null && ` (${allWorkFilter.count})`}
            </NativeSelectOption>
            {filterGroups.map(({ label, filters }) => {
              const options = submissionFilterItems.filter(({ id }) =>
                filters.some((filter) => filter === id)
              );
              return (
                <NativeSelectOptGroup key={label} label={label}>
                  {options.map(({ id, label, disabled, count }) => (
                    <NativeSelectOption key={id} value={id} disabled={disabled}>
                      {label}
                      {count != null && ` (${count})`}
                    </NativeSelectOption>
                  ))}
                </NativeSelectOptGroup>
              );
            })}
          </NativeSelect>
        )}
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
            {viewMode !== "review" && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem className="min-h-11" onClick={onToggleManagingAttempts}>
                    <Trash2 />
                    {managingAttempts ? "Done managing attempts" : "Manage attempts"}
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
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
            {selectedCount} selected
            {hiddenSelectedCount ? " · " + hiddenSelectedCount + " not shown" : ""}. Selection does
            not limit release.
          </span>
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
