"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
  type Activity,
  useActivities,
  useToggleArchive,
  useBulkArchive,
} from "@/lib/hooks/use-activities";
import { useStudents } from "@/lib/hooks/use-students";
import { useTeacherModals } from "@/components/teacher-modals-provider";
import { CreateActivityDialog } from "@/components/activities/create-activity-dialog";
import { EditActivityDialog } from "@/components/activities/edit-activity-dialog";
import { DeleteActivityDialog } from "@/components/activities/delete-activity-dialog";
import { ActivityCard } from "@/components/activities/activity-card";
import { FloatingActionBar } from "@/components/ui/floating-action-bar";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { FilterPills, type FilterPillItem } from "@/components/ui/filter-pills";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Plus,
  AlertCircle,
  RotateCcw,
  SearchX,
  ClipboardList,
  ArrowUpDown,
  Archive,
  ArchiveRestore,
} from "lucide-react";
import { toast } from "sonner";

type FilterType = "all" | "in_class" | "take_home" | "archived";
type SortOption =
  | "newest"
  | "oldest"
  | "most_submissions"
  | "least_submissions";

export default function ActivitiesPage() {
  const { data: activities, isLoading, error, refetch } = useActivities();
  const { data: students } = useStudents();
  const { openUpload } = useTeacherModals();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [deletingActivity, setDeletingActivity] = useState<Activity | null>(
    null
  );
  const [duplicatingActivity, setDuplicatingActivity] =
    useState<Activity | null>(null);

  const { mutate: toggleArchive } = useToggleArchive();
  const { mutate: bulkArchive, isPending: isBulkPending } = useBulkArchive();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
  const isSelectMode = selectedIds.size > 0;

  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const searchInputRef = useRef<HTMLInputElement>(null);

  const totalStudents = students?.length ?? 0;

  // Counts for filter pills
  const counts = useMemo(() => {
    if (!activities) return { all: 0, in_class: 0, take_home: 0, archived: 0 };
    const archivedList = activities.filter((a) => a.is_archived);
    const activeList = activities.filter((a) => !a.is_archived);

    return {
      all: activeList.length,
      in_class: activeList.filter((a) => !a.is_take_home).length,
      take_home: activeList.filter((a) => a.is_take_home).length,
      archived: archivedList.length,
    };
  }, [activities]);

  const activityFilterItems = useMemo<FilterPillItem<FilterType>[]>(() => {
    const items: FilterPillItem<FilterType>[] = [
      { id: "all", label: "All", count: counts.all },
      {
        id: "in_class",
        label: "In-Class",
        count: counts.in_class,
        disabled: counts.in_class === 0 && filterType !== "in_class",
      },
      {
        id: "take_home",
        label: "Take-Home",
        count: counts.take_home,
        disabled: counts.take_home === 0 && filterType !== "take_home",
      },
    ];
    if (counts.archived > 0) {
      items.push({
        id: "archived",
        label: "Archived",
        count: counts.archived,
        disabled: counts.archived === 0 && filterType !== "archived",
      });
    }
    return items;
  }, [counts, filterType]);

  const filteredAndSortedActivities = useMemo(() => {
    if (!activities) return [];

    // 1. Lifecycle filter (Active vs Archived)
    let result = activities;
    if (filterType === "archived") {
      result = result.filter((a) => a.is_archived);
    } else {
      result = result.filter((a) => !a.is_archived);
      if (filterType === "in_class") {
        result = result.filter((a) => !a.is_take_home);
      } else if (filterType === "take_home") {
        result = result.filter((a) => a.is_take_home);
      }
    }

    // 2. Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((activity) =>
        activity.target_text.toLowerCase().includes(query)
      );
    }

    // 3. Sort
    return [...result].sort((a, b) => {
      if (sortBy === "newest") {
        return (
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      }
      if (sortBy === "oldest") {
        return (
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
      }
      if (sortBy === "most_submissions") {
        const countA = a.submissions?.length ?? 0;
        const countB = b.submissions?.length ?? 0;
        return countB - countA;
      }
      if (sortBy === "least_submissions") {
        const countA = a.submissions?.length ?? 0;
        const countB = b.submissions?.length ?? 0;
        return countA - countB;
      }
      return 0;
    });
  }, [activities, searchQuery, filterType, sortBy]);

  const handleToggleSelect = useCallback(
    (id: string, isShiftKey = false) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);

        if (isShiftKey && lastSelectedId && lastSelectedId !== id) {
          const lastIdx = filteredAndSortedActivities.findIndex(
            (a) => a.id === lastSelectedId
          );
          const currentIdx = filteredAndSortedActivities.findIndex(
            (a) => a.id === id
          );

          if (lastIdx !== -1 && currentIdx !== -1) {
            const start = Math.min(lastIdx, currentIdx);
            const end = Math.max(lastIdx, currentIdx);
            for (let i = start; i <= end; i++) {
              next.add(filteredAndSortedActivities[i].id);
            }
            setLastSelectedId(id);
            return next;
          }
        }

        if (next.has(id)) {
          next.delete(id);
          setLastSelectedId(null);
        } else {
          next.add(id);
          setLastSelectedId(id);
        }
        return next;
      });
    },
    [lastSelectedId, filteredAndSortedActivities]
  );

  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setLastSelectedId(null);
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedIds(new Set(filteredAndSortedActivities.map((a) => a.id)));
  }, [filteredAndSortedActivities]);

  const handleBulkArchive = useCallback(
    (archived: boolean) => {
      const ids = Array.from(selectedIds);
      bulkArchive(
        { ids, archived },
        {
          onSuccess: (result) => {
            const count = result.updated.length;
            toast.success(
              archived
                ? `${count} ${count === 1 ? "activity" : "activities"} archived.`
                : `${count} ${count === 1 ? "activity" : "activities"} restored.`,
              {
                action: {
                  label: "Undo",
                  onClick: () => bulkArchive({ ids, archived: !archived }),
                },
              }
            );
            setSelectedIds(new Set());
            setLastSelectedId(null);
          },
          onError: () => {
            toast.error("Failed to update activities. Please try again.");
          },
        }
      );
    },
    [selectedIds, bulkArchive]
  );

  const handleUpload = useCallback(
    (activityId: string) => {
      openUpload({ activityId });
    },
    [openUpload]
  );

  const handleDuplicate = useCallback((activity: Activity) => {
    setDuplicatingActivity(activity);
    setIsCreateOpen(true);
  }, []);

  const handleEdit = useCallback((activity: Activity) => {
    setEditingActivity(activity);
  }, []);

  const handleDelete = useCallback((activity: Activity) => {
    setDeletingActivity(activity);
  }, []);

  const handleToggleArchiveActivity = useCallback(
    (activityId: string) => {
      toggleArchive(activityId, {
        onSuccess: (result) => {
          toast.success(
            result.is_archived
              ? "Activity moved to archive."
              : "Activity restored from archive.",
            {
              action: {
                label: "Undo",
                onClick: () => toggleArchive(activityId),
              },
            }
          );
        },
        onError: () => {
          toast.error("Failed to update archive state.");
        },
      });
    },
    [toggleArchive]
  );

  const handleFilterChange = useCallback((newType: FilterType) => {
    setFilterType(newType);
    setSelectedIds(new Set());
    setLastSelectedId(null);
  }, []);

  // Keyboard shortcut: "/" or Cmd/Ctrl+K to focus search, Escape to deselect
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      if (
        isCreateOpen ||
        editingActivity ||
        deletingActivity ||
        duplicatingActivity
      )
        return;

      if (e.key === "Escape" && !isTyping) {
        if (selectedIds.size > 0) {
          e.preventDefault();
          setSelectedIds(new Set());
          setLastSelectedId(null);
          return;
        }
        if (searchQuery) {
          e.preventDefault();
          setSearchQuery("");
          return;
        }
      }

      if (
        (e.key === "/" ||
          ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k")) &&
        !isTyping
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }

      if (
        (e.key === "c" || e.key === "C") &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !isTyping
      ) {
        e.preventDefault();
        setDuplicatingActivity(null);
        setIsCreateOpen(true);
      }

      if (
        (e.metaKey || e.ctrlKey) &&
        e.key.toLowerCase() === "a" &&
        !isTyping &&
        filteredAndSortedActivities.length > 0
      ) {
        e.preventDefault();
        setSelectedIds(new Set(filteredAndSortedActivities.map((a) => a.id)));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    isCreateOpen,
    editingActivity,
    deletingActivity,
    duplicatingActivity,
    selectedIds.size,
    searchQuery,
    filteredAndSortedActivities,
  ]);

  if (error) {
    return (
      <div className="w-full">
        <div
          role="alert"
          className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl border border-destructive/20 bg-destructive/10 text-destructive"
        >
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span className="text-sm font-medium">
              Failed to load activities: {error.message}
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="border-destructive/30 hover:bg-destructive/10 text-destructive"
          >
            <RotateCcw className="w-4 h-4 mr-1.5" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider delay={150}>
      <div className="w-full min-w-0 space-y-5 sm:space-y-6 pb-28 sm:pb-24">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-heading font-semibold text-foreground tracking-tight">
            Activities
          </h1>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            onClick={() => {
              setDuplicatingActivity(null);
              setIsCreateOpen(true);
            }}
            className="h-10 sm:h-9 min-h-[44px] sm:min-h-[36px] w-full sm:w-auto bg-primary hover:bg-brand-700 text-primary-foreground text-xs sm:text-sm font-medium shadow-xs rounded-lg sm:rounded-xl cursor-pointer"
          >
            <Plus className="w-4 h-4 mr-1.5 shrink-0" />
            <span>Create Activity</span>
            <kbd className="hidden sm:inline-flex items-center justify-center ml-2 px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground/90 bg-white/20 dark:bg-white/15 rounded border border-white/30 shadow-2xs font-mono">
              C
            </kbd>
          </Button>
        </div>
      </div>

      {/* Filter & Search Bar — only when activities exist */}
      {activities && activities.length > 0 && (
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 bg-surface dark:bg-card p-3 rounded-xl sm:rounded-2xl border border-border shadow-warm">
          {/* Search Input */}
          <SearchInput
            ref={searchInputRef}
            placeholder="Search activities..."
            aria-label="Search activities by target text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onClear={() => setSearchQuery("")}
            containerClassName="w-full xl:w-64 shrink-0"
          />

          {/* Filter Pills & Sort Controls */}
          <div className="relative min-w-0 flex-1 flex flex-col sm:flex-row items-stretch sm:items-center justify-between xl:justify-end gap-2 w-full xl:w-auto">
            <FilterPills
              items={activityFilterItems}
              value={filterType}
              onChange={handleFilterChange}
              ariaLabel="Filter by activity type"
              containerClassName="min-w-0 flex-1 xl:flex-initial xl:justify-end"
            />

            {/* Sort Selector */}
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[34px] sm:min-h-[32px] text-xs font-medium rounded-lg border border-border bg-background text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-all cursor-pointer shrink-0 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring">
                <ArrowUpDown className="size-3 text-muted-foreground shrink-0" />
                <span className="font-medium text-foreground">
                  {sortBy === "newest" && "Newest First"}
                  {sortBy === "oldest" && "Oldest First"}
                  {sortBy === "most_submissions" && "Most Submissions"}
                  {sortBy === "least_submissions" && "Least Submissions"}
                </span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem
                  onClick={() => setSortBy("newest")}
                  className="cursor-pointer text-xs justify-between"
                >
                  <span>Newest First</span>
                  {sortBy === "newest" && (
                    <span className="text-primary font-bold">✓</span>
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setSortBy("oldest")}
                  className="cursor-pointer text-xs justify-between"
                >
                  <span>Oldest First</span>
                  {sortBy === "oldest" && (
                    <span className="text-primary font-bold">✓</span>
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setSortBy("most_submissions")}
                  className="cursor-pointer text-xs justify-between"
                >
                  <span>Most Submissions</span>
                  {sortBy === "most_submissions" && (
                    <span className="text-primary font-bold">✓</span>
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setSortBy("least_submissions")}
                  className="cursor-pointer text-xs justify-between"
                >
                  <span>Least Submissions</span>
                  {sortBy === "least_submissions" && (
                    <span className="text-primary font-bold">✓</span>
                  )}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      )}

      {/* Filter results indicator */}
      {searchQuery && activities && activities.length > 0 && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center justify-between text-xs text-muted-foreground px-1"
        >
          <span>
            Showing{" "}
            <strong className="text-foreground">
              {filteredAndSortedActivities.length}
            </strong>{" "}
            of{" "}
            <strong className="text-foreground">{activities.length}</strong>{" "}
            activities matching &ldquo;
            <strong className="text-foreground">{searchQuery}</strong>
            &rdquo;
          </span>
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="text-primary hover:underline font-medium cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring rounded-sm px-1 py-0.5"
          >
            Clear search
          </button>
        </div>
      )}

      {/* Content Area */}
      {isLoading ? (
        /* Loading Skeleton */
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-surface dark:bg-card border border-border rounded-xl sm:rounded-2xl p-5 space-y-3 shadow-warm"
            >
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <div className="flex gap-2 pt-2">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-5 w-12 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ) : activities?.length === 0 ? (
        /* Empty State — No activities */
        <div className="bg-surface dark:bg-card border border-border rounded-xl sm:rounded-2xl shadow-warm overflow-hidden">
          <Empty className="py-14 border-0">
            <EmptyMedia
              variant="icon"
              className="bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300"
            >
              <ClipboardList className="w-6 h-6" />
            </EmptyMedia>
            <EmptyHeader>
              <EmptyTitle className="text-lg sm:text-xl">
                No activities yet
              </EmptyTitle>
              <EmptyDescription className="text-xs sm:text-sm max-w-sm mx-auto">
                Create your first cursive handwriting activity to begin
                assessing student worksheets.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent className="flex items-center justify-center w-full sm:w-auto px-4 sm:px-0">
              <Button
                onClick={() => {
                  setDuplicatingActivity(null);
                  setIsCreateOpen(true);
                }}
                className="h-10 sm:h-9 min-h-[44px] sm:min-h-[36px] w-full sm:w-auto bg-primary hover:bg-brand-700 text-primary-foreground font-medium text-xs sm:text-sm rounded-lg sm:rounded-xl cursor-pointer"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Activity
              </Button>
            </EmptyContent>
          </Empty>
        </div>
      ) : filteredAndSortedActivities.length === 0 ? (
        /* Empty State — No search / filter results */
        <div className="bg-surface dark:bg-card border border-border rounded-xl sm:rounded-2xl shadow-warm overflow-hidden">
          <Empty className="py-12 border-0">
            <EmptyMedia
              variant="icon"
              className="bg-muted text-muted-foreground"
            >
              {filterType === "archived" ? (
                <Archive className="w-6 h-6" />
              ) : (
                <SearchX className="w-6 h-6" />
              )}
            </EmptyMedia>
            <EmptyHeader>
              <EmptyTitle className="text-lg sm:text-xl">
                {filterType === "archived"
                  ? "No archived activities"
                  : "No matching activities"}
              </EmptyTitle>
              <EmptyDescription className="text-xs sm:text-sm max-w-sm mx-auto">
                {filterType === "archived"
                  ? "When handwriting exercises are completed, you can archive them to keep your active list clean."
                  : "No activities match your current search and filter criteria."}
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent className="flex gap-2">
              {searchQuery && (
                <Button
                  variant="outline"
                  onClick={() => setSearchQuery("")}
                  className="h-10 sm:h-9 min-h-[44px] sm:min-h-[36px] font-medium text-xs sm:text-sm rounded-lg sm:rounded-xl cursor-pointer"
                >
                  Clear Search
                </Button>
              )}
              {filterType !== "all" && (
                <Button
                  variant="ghost"
                  onClick={() => setFilterType("all")}
                  className="h-10 sm:h-9 min-h-[44px] sm:min-h-[36px] font-medium text-xs sm:text-sm rounded-lg sm:rounded-xl cursor-pointer"
                >
                  View Active Activities
                </Button>
              )}
            </EmptyContent>
          </Empty>
        </div>
      ) : (
        /* Activity Card Grid */
        <div
          id="activities-grid"
          role="region"
          aria-label="Activities list"
          className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4"
        >
          {filteredAndSortedActivities.map((activity) => (
            <ActivityCard
              key={activity.id}
              activity={activity}
              isSelected={selectedIds.has(activity.id)}
              isSelectMode={isSelectMode}
              totalStudents={totalStudents}
              onToggleSelect={handleToggleSelect}
              onUpload={handleUpload}
              onDuplicate={handleDuplicate}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onToggleArchive={handleToggleArchiveActivity}
            />
          ))}
        </div>
      )}

      {/* Floating Batch Actions Bar */}
      <FloatingActionBar
        selectedCount={selectedIds.size}
        totalCount={filteredAndSortedActivities.length}
        allSelected={
          selectedIds.size > 0 &&
          selectedIds.size === filteredAndSortedActivities.length
        }
        itemLabel="activity"
        onSelectAll={handleSelectAll}
        onClearSelection={handleClearSelection}
        ariaLabel="Batch activity actions"
      >
        {filterType !== "archived" ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isBulkPending}
                  onClick={() => handleBulkArchive(true)}
                  className="h-8 px-2 sm:px-3 text-xs font-medium border-border/80 hover:bg-muted/80 hover:text-foreground active:scale-[0.97] transition-all shrink-0 rounded-lg cursor-pointer"
                  aria-label={`Archive ${selectedIds.size} selected ${
                    selectedIds.size === 1 ? "activity" : "activities"
                  }`}
                >
                  <Archive className="w-3.5 h-3.5 sm:mr-1.5 text-muted-foreground shrink-0" />
                  <span className="hidden sm:inline">Archive</span>
                  <span className="sm:hidden">Archive</span>
                </Button>
              }
            />
            <TooltipContent
              side="top"
              sideOffset={6}
              className="text-xs font-normal"
            >
              Archive {selectedIds.size} selected{" "}
              {selectedIds.size === 1 ? "activity" : "activities"}
            </TooltipContent>
          </Tooltip>
        ) : (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isBulkPending}
                  onClick={() => handleBulkArchive(false)}
                  className="h-8 px-2 sm:px-3 text-xs font-medium border-border/80 hover:bg-muted/80 hover:text-foreground active:scale-[0.97] transition-all shrink-0 rounded-lg cursor-pointer"
                  aria-label={`Restore ${selectedIds.size} selected ${
                    selectedIds.size === 1 ? "activity" : "activities"
                  }`}
                >
                  <ArchiveRestore className="w-3.5 h-3.5 sm:mr-1.5 text-muted-foreground shrink-0" />
                  <span className="hidden sm:inline">Restore</span>
                  <span className="sm:hidden">Restore</span>
                </Button>
              }
            />
            <TooltipContent
              side="top"
              sideOffset={6}
              className="text-xs font-normal"
            >
              Restore {selectedIds.size} selected{" "}
              {selectedIds.size === 1 ? "activity" : "activities"}
            </TooltipContent>
          </Tooltip>
        )}
      </FloatingActionBar>

      {/* Create / Duplicate Activity Dialog */}
      <CreateActivityDialog
        open={isCreateOpen}
        onOpenChange={(open) => {
          setIsCreateOpen(open);
          if (!open) setDuplicatingActivity(null);
        }}
        initialValues={
          duplicatingActivity
            ? {
                target_text: duplicatingActivity.target_text,
                is_take_home: duplicatingActivity.is_take_home,
              }
            : undefined
        }
        isDuplicate={!!duplicatingActivity}
      />

      {/* Edit Activity Dialog */}
      <EditActivityDialog
        activity={editingActivity}
        open={!!editingActivity}
        onOpenChange={(open) => {
          if (!open) setEditingActivity(null);
        }}
      />

      {/* Delete Activity Confirmation Dialog */}
      <DeleteActivityDialog
        activity={deletingActivity}
        open={!!deletingActivity}
        onOpenChange={(open) => {
          if (!open) setDeletingActivity(null);
        }}
      />
      </div>
    </TooltipProvider>
  );
}