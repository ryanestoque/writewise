"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
  type Activity,
  useActivities,
  useToggleArchive,
  useBulkArchive,
} from "@/lib/hooks/use-activities";
import { activityAssignedTo } from "@/lib/utils/activity-work";
import { isBlockingOverlayOpen } from "@/lib/utils/keyboard";
import { useStudents } from "@/lib/hooks/use-students";
import { useTeacherModals } from "@/components/teacher-modals-provider";
import { CreateActivityDialog } from "@/components/activities/create-activity-dialog";
import { EditActivityDialog } from "@/components/activities/edit-activity-dialog";
import { DeleteActivityDialog } from "@/components/activities/delete-activity-dialog";
import { ActivityCard } from "@/components/activities/activity-card";
import { FloatingActionBar } from "@/components/shared/floating-action-bar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { SearchInput } from "@/components/shared/search-input";
import { FilterPills, type FilterPillItem } from "@/components/shared/filter-pills";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
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
import { toast } from "@/components/ui/toast";

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
    return [
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
      {
        id: "archived",
        label: "Archived",
        count: counts.archived,
      },
    ];
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
        `${activity.title} ${activity.target_text}`.toLowerCase().includes(query)
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
            toast.add({
              type: "success",
              title: archived
                ? `${count} ${count === 1 ? "activity" : "activities"} archived.`
                : `${count} ${count === 1 ? "activity" : "activities"} restored.`,
              actionProps: {
                children: "Undo",
                onClick: () => bulkArchive({ ids, archived: !archived }),
              },
            });
            setSelectedIds(new Set());
            setLastSelectedId(null);
          },
          onError: () => {
            toast.add({ type: "error", title: "Failed to update activities. Please try again." });
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
          toast.add({
            type: "success",
            title: result.is_archived
              ? "Activity moved to archive."
              : "Activity restored from archive.",
            actionProps: {
              children: "Undo",
              onClick: () => toggleArchive(activityId),
            },
          });
        },
        onError: () => {
          toast.add({ type: "error", title: "Failed to update archive state." });
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

  // Keyboard shortcut: "/" to focus search, Escape to deselect (Cmd/Ctrl+K is reserved globally for Upload Worksheet)
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
        duplicatingActivity ||
        isBlockingOverlayOpen()
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

      if (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey && !isTyping) {
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
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertTitle>Unable to load activities</AlertTitle>
          <AlertDescription className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between [&>p]:mb-0">
            <p>Please check your connection and try again.</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="min-h-11 md:min-h-9 shrink-0 border-destructive/30 text-destructive hover:bg-destructive/10 cursor-pointer"
            >
              <RotateCcw data-icon="inline-start" aria-hidden="true" />
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <TooltipProvider delay={150}>
      <div className="flex w-full min-w-0 flex-col gap-5 sm:gap-6 pb-28 sm:pb-24">
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
            aria-keyshortcuts="c"
            className="h-10 sm:h-9 min-h-11 sm:min-h-9 w-full sm:w-auto text-xs sm:text-sm font-medium shadow-xs rounded-lg sm:rounded-xl cursor-pointer"
          >
            <Plus data-icon="inline-start" aria-hidden="true" />
            <span>Create Activity</span>
            <Kbd
              aria-hidden="true"
              className="ml-2 hidden h-auto min-w-0 rounded border border-primary-foreground/30 bg-primary-foreground/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-primary-foreground shadow-2xs sm:inline-flex"
            >
              C
            </Kbd>
          </Button>
        </div>
      </div>

      {/* Filter & Search Bar — only when activities exist */}
      {activities && activities.length > 0 && (
        <Card size="sm" className="py-3">
          <CardContent className="flex flex-col md:flex-row md:items-center justify-between gap-3 px-3">
            {/* Search Input */}
            <SearchInput
              ref={searchInputRef}
              placeholder="Search activities..."
              aria-label="Search activities by target text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onClear={() => setSearchQuery("")}
              containerClassName="w-full md:w-56 lg:w-64 shrink-0"
            />

            {/* Filter Pills & Sort Controls */}
            <div className="relative min-w-0 flex-1 flex flex-col sm:flex-row items-stretch sm:items-center justify-between md:justify-end gap-2 w-full md:w-auto">
              <FilterPills
                items={activityFilterItems}
                value={filterType}
                onChange={handleFilterChange}
                ariaLabel="Filter by activity type"
                containerClassName="min-w-0 flex-1 md:flex-initial md:justify-end"
              />

              {/* Sort Selector */}
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="min-h-11 sm:min-h-8 shrink-0 cursor-pointer text-xs"
                    />
                  }
                >
                  <ArrowUpDown data-icon="inline-start" aria-hidden="true" />
                  <span>
                    {sortBy === "newest" && "Newest First"}
                    {sortBy === "oldest" && "Oldest First"}
                    {sortBy === "most_submissions" && "Most Submissions"}
                    {sortBy === "least_submissions" && "Least Submissions"}
                  </span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuRadioGroup
                    value={sortBy}
                    onValueChange={(value) => setSortBy(value as SortOption)}
                  >
                    <DropdownMenuRadioItem value="newest" className="cursor-pointer text-xs">
                      Newest First
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="oldest" className="cursor-pointer text-xs">
                      Oldest First
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem
                      value="most_submissions"
                      className="cursor-pointer text-xs"
                    >
                      Most Submissions
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem
                      value="least_submissions"
                      className="cursor-pointer text-xs"
                    >
                      Least Submissions
                    </DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardContent>
        </Card>
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
          <Button
            type="button"
            variant="link"
            size="xs"
            onClick={() => setSearchQuery("")}
            className="relative h-auto p-0 cursor-pointer after:absolute after:-inset-2 sm:after:hidden"
          >
            Clear search
          </Button>
        </div>
      )}

      {/* Content Area */}
      {isLoading ? (
        /* Loading Skeleton */
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))] gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} size="sm">
              <CardContent className="flex flex-col gap-3">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <div className="flex gap-2 pt-2">
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-5 w-12 rounded-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : activities?.length === 0 ? (
        /* Empty State — No activities */
        <Card className="py-0">
          <CardContent className="px-0">
            <Empty className="py-14 border-0">
              <EmptyMedia
                variant="icon"
                className="bg-secondary text-secondary-foreground"
              >
                <ClipboardList className="size-6" aria-hidden="true" />
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
                  className="h-10 sm:h-9 min-h-11 sm:min-h-9 w-full sm:w-auto font-medium text-xs sm:text-sm rounded-lg sm:rounded-xl cursor-pointer"
                >
                  <Plus data-icon="inline-start" aria-hidden="true" />
                  Create Activity
                </Button>
              </EmptyContent>
            </Empty>
          </CardContent>
        </Card>
      ) : filteredAndSortedActivities.length === 0 ? (
        /* Empty State — No search / filter results */
        <Card className="py-0">
          <CardContent className="px-0">
            <Empty className="py-12 border-0">
              <EmptyMedia
                variant="icon"
                className="bg-muted text-muted-foreground"
              >
                {filterType === "archived" ? (
                  <Archive className="size-6" aria-hidden="true" />
                ) : (
                  <SearchX className="size-6" aria-hidden="true" />
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
                    className="h-10 sm:h-9 min-h-11 sm:min-h-9 font-medium text-xs sm:text-sm rounded-lg sm:rounded-xl cursor-pointer"
                  >
                    Clear Search
                  </Button>
                )}
                {filterType !== "all" && (
                  <Button
                    variant="ghost"
                    onClick={() => setFilterType("all")}
                    className="h-10 sm:h-9 min-h-11 sm:min-h-9 font-medium text-xs sm:text-sm rounded-lg sm:rounded-xl cursor-pointer"
                  >
                    View Active Activities
                  </Button>
                )}
              </EmptyContent>
            </Empty>
          </CardContent>
        </Card>
      ) : (
        /* Activity Card Grid */
        <div
          id="activities-grid"
          role="region"
          aria-label="Activities list"
          className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))] gap-4"
        >
          {filteredAndSortedActivities.map((activity) => {
            const assignedStudents = (students ?? []).filter((s) =>
              activityAssignedTo(activity, s)
            );
            return (
              <ActivityCard
                key={activity.id}
                activity={activity}
                isSelected={selectedIds.has(activity.id)}
                isSelectMode={isSelectMode}
                totalStudents={assignedStudents.length}
                assignedStudentIds={assignedStudents.map((s) => s.id)}
                onToggleSelect={handleToggleSelect}
                onUpload={handleUpload}
                onDuplicate={handleDuplicate}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onToggleArchive={handleToggleArchiveActivity}
              />
            );
          })}
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
                  className="h-10 sm:h-8 px-2.5 sm:px-3 text-xs font-medium border-border/80 hover:bg-muted/80 hover:text-foreground active:scale-[0.97] transition-all motion-reduce:transform-none motion-reduce:transition-colors shrink-0 rounded-lg cursor-pointer"
                  aria-label={`Archive ${selectedIds.size} selected ${
                    selectedIds.size === 1 ? "activity" : "activities"
                  }`}
                >
                  <Archive data-icon="inline-start" className="text-muted-foreground" aria-hidden="true" />
                  <span>Archive</span>
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
                  className="h-10 sm:h-8 px-2.5 sm:px-3 text-xs font-medium border-border/80 hover:bg-muted/80 hover:text-foreground active:scale-[0.97] transition-all motion-reduce:transform-none motion-reduce:transition-colors shrink-0 rounded-lg cursor-pointer"
                  aria-label={`Restore ${selectedIds.size} selected ${
                    selectedIds.size === 1 ? "activity" : "activities"
                  }`}
                >
                  <ArchiveRestore data-icon="inline-start" className="text-muted-foreground" aria-hidden="true" />
                  <span>Restore</span>
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
                ...duplicatingActivity,
                due_at: null, close_after_due: false,
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
