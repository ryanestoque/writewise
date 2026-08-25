"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { FloatingActionBar } from "@/components/ui/floating-action-bar";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
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
  DropdownMenuSeparator,
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
  Home,
  CalendarDays,
  MoreVertical,
  Edit3,
  Trash2,
  Inbox,
  CheckCircle2,
  ArrowUpDown,
  Archive,
  ArchiveRestore,
  Copy,
  Upload,
  BookOpen,
} from "lucide-react";
import { toast } from "sonner";

type FilterType = "all" | "in_class" | "take_home" | "archived";
type SortOption =
  | "newest"
  | "oldest"
  | "most_submissions"
  | "least_submissions";

function getWordCount(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
}

function getRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 30) {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  }
  if (diffDays > 0) return `${diffDays}d ago`;
  if (diffHours > 0) return `${diffHours}h ago`;
  if (diffMins > 0) return `${diffMins}m ago`;
  return "Just now";
}

export default function ActivitiesPage() {
  const router = useRouter();
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
      <div className="w-full space-y-5 sm:space-y-6 pb-28 sm:pb-24 px-1 sm:px-0">
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
          <div className="relative min-w-0 flex-1 flex items-center justify-between xl:justify-end gap-2 w-full xl:w-auto">
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {filteredAndSortedActivities.map((activity) => {
            const isArchived = activity.is_archived;
            const submissionCount = activity.submissions?.length ?? 0;
            const completedCount =
              activity.submissions?.filter((s) => s.status === "completed")
                .length ?? 0;
            const processingCount =
              activity.submissions?.filter((s) => s.status === "processing")
                .length ?? 0;
            const rejectedCount =
              activity.submissions?.filter((s) => s.status === "rejected")
                .length ?? 0;

            const wordCount = getWordCount(activity.target_text);
            const isFullyCollected = totalStudents > 0 && submissionCount >= totalStudents;

            return (
              <div
                key={activity.id}
                onClick={
                  isSelectMode
                    ? (e) => handleToggleSelect(activity.id, e.shiftKey)
                    : undefined
                }
                className={`group relative flex flex-col justify-between bg-surface dark:bg-card border rounded-xl sm:rounded-2xl p-5 shadow-warm hover:shadow-md transition-all duration-200 ${
                  isSelectMode ? "cursor-pointer select-none" : ""
                } ${
                  isArchived
                    ? "border-dashed border-border/80 opacity-80 hover:opacity-100"
                    : "border-border hover:border-brand-300 dark:hover:border-brand-800"
                }`}
              >
                <div>
                  {/* Card Header: Checkbox, Badges & Actions Menu */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                      {/* Selection checkbox */}
                      <div
                        className={`transition-all duration-150 ease-out flex items-center justify-center shrink-0 ${
                          isSelectMode || selectedIds.has(activity.id)
                            ? "w-6 opacity-100"
                            : "w-6 opacity-100 sm:w-0 sm:opacity-0 sm:overflow-hidden sm:group-hover:w-6 sm:group-hover:opacity-100 sm:group-hover:overflow-visible sm:focus-within:w-6 sm:focus-within:opacity-100"
                        }`}
                      >
                        <label
                          className="flex size-7 sm:size-6 items-center justify-center rounded-md hover:bg-muted/70 cursor-pointer transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={selectedIds.has(activity.id)}
                            onChange={(e) => {
                              handleToggleSelect(
                                activity.id,
                                (e.nativeEvent as MouseEvent).shiftKey
                              );
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                            }}
                            aria-label={`Select activity: ${activity.target_text.slice(0, 40)}`}
                            className="size-4 rounded border-border accent-primary cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                          />
                        </label>
                      </div>

                      {isArchived ? (
                        <Badge
                          variant="outline"
                          className="text-xs font-semibold px-2.5 py-0.5 bg-muted/60 text-muted-foreground border-border/80"
                        >
                          <Archive className="w-3.5 h-3.5 mr-1" />
                          Archived
                        </Badge>
                      ) : activity.is_take_home ? (
                        <Badge
                          variant="outline"
                          className="text-xs font-semibold px-2.5 py-0.5 bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300 border-brand-200/80 dark:border-brand-900"
                        >
                          <Home className="w-3.5 h-3.5 mr-1 text-brand-600 dark:text-brand-400" />
                          Take-home
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-xs font-semibold px-2.5 py-0.5 bg-emerald-50/70 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200/70 dark:border-emerald-900/60"
                        >
                          <BookOpen className="w-3.5 h-3.5 mr-1 text-emerald-600 dark:text-emerald-400" />
                          In-Class
                        </Badge>
                      )}

                      <span className="inline-flex items-center text-[11px] font-medium text-muted-foreground bg-muted/40 dark:bg-muted/30 px-2 py-0.5 rounded-md border border-border/50 tabular-nums">
                        {wordCount} {wordCount === 1 ? "word" : "words"}
                      </span>
                    </div>

                    {/* Overflow Actions Menu with mobile-friendly hit target */}
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                        aria-label="Activity actions"
                      >
                        <MoreVertical className="size-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52">
                        <DropdownMenuItem
                          onClick={() =>
                            openUpload({ activityId: activity.id })
                          }
                          className="cursor-pointer gap-2 text-xs"
                        >
                          <Upload className="size-3.5" />
                          <span>Upload Worksheet</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setDuplicatingActivity(activity);
                            setIsCreateOpen(true);
                          }}
                          className="cursor-pointer gap-2 text-xs"
                        >
                          <Copy className="size-3.5" />
                          <span>Duplicate Activity</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setEditingActivity(activity)}
                          className="cursor-pointer gap-2 text-xs"
                        >
                          <Edit3 className="size-3.5" />
                          <span>Edit Target Text</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            router.push(`/activities/${activity.id}`)
                          }
                          className="cursor-pointer gap-2 text-xs"
                        >
                          <Inbox className="size-3.5" />
                          <span>View Submissions</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => {
                            toggleArchive(activity.id, {
                              onSuccess: (result) => {
                                toast.success(
                                  result.is_archived
                                    ? "Activity moved to archive."
                                    : "Activity restored from archive.",
                                  {
                                    action: {
                                      label: "Undo",
                                      onClick: () => toggleArchive(activity.id),
                                    },
                                  }
                                );
                              },
                              onError: () => {
                                toast.error("Failed to update archive state.");
                              },
                            });
                          }}
                          className="cursor-pointer gap-2 text-xs"
                        >
                          {isArchived ? (
                            <>
                              <ArchiveRestore className="size-3.5" />
                              <span>Unarchive Activity</span>
                            </>
                          ) : (
                            <>
                              <Archive className="size-3.5" />
                              <span>Archive Activity</span>
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setDeletingActivity(activity)}
                          className="cursor-pointer gap-2 text-xs text-destructive focus:text-destructive"
                        >
                          <Trash2 className="size-3.5" />
                          <span>Delete Activity</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Target Text Preview with Cursive Worksheet Accent & 3-line Ruling */}
                  <Link
                    href={`/activities/${activity.id}`}
                    title={`Open activity: ${activity.target_text}`}
                    aria-label={`Open activity: ${activity.target_text}`}
                    className="block group-hover:opacity-90 transition-opacity focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring rounded-xl"
                  >
                    <div className="relative p-3.5 sm:p-4 pb-5 sm:pb-6 rounded-xl bg-linear-to-b from-brand-50/20 via-surface to-brand-50/10 dark:from-card dark:to-card/80 border border-brand-200/50 dark:border-border/60 mb-3.5 overflow-hidden shadow-2xs">
                      {/* Authentic 3-line ruling aligned with Cedarville Cursive baseline */}
                      <div
                        className="absolute inset-3.5 sm:inset-4 pointer-events-none opacity-40 dark:opacity-20 cursive-guidelines overflow-hidden z-0"
                        aria-hidden="true"
                      />

                      <p className="relative z-10 font-cursive text-[34px] leading-[48px] text-foreground/90 font-normal line-clamp-3 tracking-wide break-words">
                        {activity.target_text}
                      </p>
                    </div>
                  </Link>
                </div>

                {/* Card Footer: Submission Progress Gauge & Actions */}
                <div className="space-y-2.5 pt-2.5 border-t border-border/60">
                  {/* Status header with count and timestamp */}
                  <div className="flex items-center justify-between gap-1.5 text-xs">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-semibold text-foreground text-xs flex items-center gap-1.5 truncate">
                        <Inbox className="size-3.5 text-muted-foreground shrink-0" />
                        {totalStudents > 0 ? (
                          <span className="truncate">
                            {submissionCount > totalStudents
                              ? `${submissionCount} collected`
                              : `${submissionCount} of ${totalStudents} collected`}
                          </span>
                        ) : (
                          <span className="truncate">
                            {submissionCount}{" "}
                            {submissionCount === 1
                              ? "submission"
                              : "submissions"}
                          </span>
                        )}
                      </span>

                      {isFullyCollected && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-950/60 px-1.5 py-0.5 rounded-md border border-brand-200/80 dark:border-brand-900 shrink-0">
                          <CheckCircle2 className="size-3" />
                          Complete
                        </span>
                      )}
                    </div>

                    <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0 tabular-nums">
                      <CalendarDays className="size-3.5" />
                      {getRelativeTime(activity.created_at)}
                    </span>
                  </div>

                  {/* Visual Progress Bar (when totalStudents > 0) */}
                  {totalStudents > 0 && (
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <div
                            tabIndex={0}
                            role="progressbar"
                            aria-valuenow={submissionCount}
                            aria-valuemin={0}
                            aria-valuemax={totalStudents}
                            aria-label={`Submission progress: ${completedCount} completed, ${processingCount} processing, ${rejectedCount} rejected out of ${totalStudents} students`}
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.stopPropagation();
                              }
                            }}
                            className="group/progress w-full py-1.5 -my-1.5 cursor-help focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring rounded-full"
                          >
                            <div className="w-full bg-muted/60 dark:bg-muted/40 h-2 rounded-full overflow-hidden flex shadow-2xs group-hover/progress:brightness-95 transition-all">
                              {completedCount > 0 && (
                                <div
                                  className="bg-brand-500 transition-all duration-300 motion-reduce:transition-none"
                                  style={{
                                    width: `${(completedCount / totalStudents) * 100}%`,
                                  }}
                                />
                              )}
                              {processingCount > 0 && (
                                <div
                                  className="bg-amber-500 transition-all duration-300 motion-reduce:transition-none"
                                  style={{
                                    width: `${(processingCount / totalStudents) * 100}%`,
                                  }}
                                />
                              )}
                              {rejectedCount > 0 && (
                                <div
                                  className="bg-destructive transition-all duration-300 motion-reduce:transition-none"
                                  style={{
                                    width: `${(rejectedCount / totalStudents) * 100}%`,
                                  }}
                                />
                              )}
                            </div>
                          </div>
                        }
                      />
                      <TooltipContent
                        side="top"
                        sideOffset={6}
                        arrowClassName="bg-popover fill-popover border-b border-r border-border"
                        className="flex flex-col items-stretch bg-popover text-popover-foreground border border-border shadow-warm-md text-xs p-3 space-y-2 min-w-[220px] rounded-xl"
                      >
                        <div className="font-semibold text-foreground pb-2 border-b border-border flex items-center justify-between">
                          <span className="text-[12px] font-heading font-medium">Class Submissions</span>
                          <span className="tabular-nums text-muted-foreground font-medium text-[11px] bg-muted/60 dark:bg-muted/40 px-1.5 py-0.5 rounded-md">
                            {submissionCount}/{totalStudents}
                          </span>
                        </div>
                        <div className="space-y-1.5 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5 text-foreground/90 font-medium">
                              <span className="size-2 rounded-full bg-brand-500 inline-block shrink-0 shadow-2xs" />
                              Completed
                            </span>
                            <span className="font-semibold tabular-nums text-foreground">{completedCount}</span>
                          </div>
                          {processingCount > 0 && (
                            <div className="flex items-center justify-between">
                              <span className="flex items-center gap-1.5 text-amber-700 dark:text-amber-300 font-medium">
                                <span className="size-2 rounded-full bg-amber-500 inline-block shrink-0 animate-pulse" />
                                Processing
                              </span>
                              <span className="font-semibold tabular-nums text-amber-700 dark:text-amber-300">{processingCount}</span>
                            </div>
                          )}
                          {rejectedCount > 0 && (
                            <div className="flex items-center justify-between">
                              <span className="flex items-center gap-1.5 text-destructive font-medium">
                                <span className="size-2 rounded-full bg-destructive inline-block shrink-0" />
                                Rejected (Needs Re-scan)
                              </span>
                              <span className="font-semibold tabular-nums text-destructive">{rejectedCount}</span>
                            </div>
                          )}
                          {totalStudents - submissionCount > 0 && (
                            <div className="flex items-center justify-between text-muted-foreground pt-1.5 border-t border-border/50">
                              <span className="flex items-center gap-1.5">
                                <span className="size-2 rounded-full bg-muted-foreground/30 inline-block shrink-0" />
                                Unsubmitted
                              </span>
                              <span className="font-medium tabular-nums">{totalStudents - submissionCount}</span>
                            </div>
                          )}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  )}

                  {/* Clean Assessment Status Subtext */}
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-0.5">
                    <span className="flex items-center gap-1.5 truncate">
                      <span
                        className={`size-1.5 rounded-full shrink-0 ${
                          processingCount > 0
                            ? "bg-amber-500 motion-safe:animate-pulse"
                            : completedCount > 0
                            ? "bg-brand-500"
                            : "bg-muted-foreground/50"
                        }`}
                      />
                      <span className="truncate">
                        {completedCount > 0
                          ? `${completedCount} ${completedCount === 1 ? "worksheet" : "worksheets"} scored`
                          : processingCount > 0
                          ? `${processingCount} ${processingCount === 1 ? "worksheet" : "worksheets"} processing analysis`
                          : submissionCount > 0
                          ? `${submissionCount} collected · Ready to evaluate`
                          : "Awaiting worksheet submissions"}
                      </span>
                    </span>
                  </div>

                  {/* Standardized 2-Action Button Row — Balanced 2-column grid */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openUpload({ activityId: activity.id })}
                      className="h-8 min-h-[36px] px-2 text-xs font-medium border-border/80 hover:bg-brand-50 hover:text-brand-700 dark:hover:bg-brand-950/60 dark:hover:text-brand-300 rounded-lg cursor-pointer transition-colors w-full justify-center"
                      title={isFullyCollected ? "Upload additional worksheet scans" : "Upload student worksheet scans"}
                    >
                      <Upload className="size-3.5 mr-1.5 text-primary shrink-0" />
                      <span className="truncate">{isFullyCollected ? "Upload More" : "Upload"}</span>
                    </Button>

                    <Link
                      href={`/activities/${activity.id}`}
                      className={cn(
                        buttonVariants({
                          variant: isFullyCollected ? "default" : "secondary",
                          size: "sm",
                        }),
                        "h-8 min-h-[36px] px-2 text-xs font-semibold rounded-lg shadow-2xs cursor-pointer group/btn w-full justify-center"
                      )}
                      title={isFullyCollected ? "Review completed submissions" : "View submissions for this activity"}
                    >
                      <Inbox className="size-3.5 mr-1.5 shrink-0" />
                      <span className="truncate">{isFullyCollected ? "Review" : "Submissions"}</span>
                      <span className="ml-1 text-xs transition-transform group-hover/btn:translate-x-0.5 shrink-0">
                        &rarr;
                      </span>
                    </Link>
                  </div>
                </div>
              </div>
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