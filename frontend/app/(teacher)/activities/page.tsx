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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
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
  Search,
  X,
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

  // Keyboard navigation for WAI-ARIA tablist
  const handleTabKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const availableTabs: FilterType[] = ["all", "in_class", "take_home"];
    if (counts.archived > 0) availableTabs.push("archived");
    const currentIndex = availableTabs.indexOf(filterType);
    if (currentIndex === -1) return;

    let nextIndex = currentIndex;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      nextIndex = (currentIndex + 1) % availableTabs.length;
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      nextIndex = (currentIndex - 1 + availableTabs.length) % availableTabs.length;
    } else if (e.key === "Home") {
      e.preventDefault();
      nextIndex = 0;
    } else if (e.key === "End") {
      e.preventDefault();
      nextIndex = availableTabs.length - 1;
    } else {
      return;
    }

    const nextTab = availableTabs[nextIndex];
    setFilterType(nextTab);
    setSelectedIds(new Set());
    const targetEl = document.getElementById(`filter-tab-${nextTab}`);
    targetEl?.focus();
  };

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
    <div className="w-full space-y-5 sm:space-y-6 pb-20 sm:pb-16 px-1 sm:px-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-heading font-semibold text-foreground tracking-tight">
              Activities
            </h1>
            {activities && activities.length > 0 && (
              <Badge
                variant="outline"
                className="text-xs font-semibold px-2.5 py-0.5 bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300 border-brand-200/80 dark:border-brand-900"
              >
                {counts.all} Active
                {counts.archived > 0 ? ` · ${counts.archived} Archived` : ""}
              </Badge>
            )}
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-normal">
            Create and manage cursive handwriting exercises, track student
            submissions, and archive completed prompts.
          </p>
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
            Create Activity
          </Button>
        </div>
      </div>

      {/* Filter & Search Bar — only when activities exist */}
      {activities && activities.length > 0 && (
        <div className="bg-surface dark:bg-card p-3 rounded-xl sm:rounded-2xl border border-border shadow-2xs space-y-3">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                ref={searchInputRef}
                placeholder="Search activities..."
                aria-label="Search activities by target text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    if (searchQuery) {
                      setSearchQuery("");
                    } else {
                      searchInputRef.current?.blur();
                    }
                  }
                }}
                className="pl-9 pr-8 h-10 sm:h-9 min-h-[44px] sm:min-h-[36px] text-base sm:text-sm rounded-lg sm:rounded-xl"
                aria-keyshortcuts="/"
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    searchInputRef.current?.focus();
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1.5 rounded-full transition-colors cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring after:absolute after:-inset-2 after:content-['']"
                  aria-label="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : (
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 hidden sm:flex items-center pointer-events-none">
                  <Kbd className="text-[10px] h-5 px-1 bg-muted text-muted-foreground border-border">
                    /
                  </Kbd>
                </div>
              )}
            </div>

            {/* Filter Tabs & Sort */}
            <div className="flex items-center justify-between md:justify-end gap-2 flex-wrap">
              {/* Type & Archive Filter Buttons (WAI-ARIA compliant tablist with roving arrow navigation) */}
              <div
                role="tablist"
                aria-label="Activity lifecycle filters"
                onKeyDown={handleTabKeyDown}
                className="inline-flex p-0.5 rounded-lg bg-muted/60 border border-border/50 text-xs overflow-x-auto max-w-full"
              >
                <button
                  type="button"
                  id="filter-tab-all"
                  role="tab"
                  aria-selected={filterType === "all"}
                  aria-controls="activities-grid"
                  tabIndex={filterType === "all" ? 0 : -1}
                  onClick={() => {
                    setFilterType("all");
                    setSelectedIds(new Set());
                  }}
                  className={`px-3 py-2 sm:px-2.5 sm:py-1 min-h-[38px] sm:min-h-0 rounded-md font-medium transition-colors cursor-pointer shrink-0 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring ${
                    filterType === "all"
                      ? "bg-background text-foreground shadow-2xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  All ({counts.all})
                </button>
                <button
                  type="button"
                  id="filter-tab-in_class"
                  role="tab"
                  aria-selected={filterType === "in_class"}
                  aria-controls="activities-grid"
                  tabIndex={filterType === "in_class" ? 0 : -1}
                  onClick={() => {
                    setFilterType("in_class");
                    setSelectedIds(new Set());
                  }}
                  className={`px-3 py-2 sm:px-2.5 sm:py-1 min-h-[38px] sm:min-h-0 rounded-md font-medium transition-colors cursor-pointer shrink-0 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring ${
                    filterType === "in_class"
                      ? "bg-background text-foreground shadow-2xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  In-Class ({counts.in_class})
                </button>
                <button
                  type="button"
                  id="filter-tab-take_home"
                  role="tab"
                  aria-selected={filterType === "take_home"}
                  aria-controls="activities-grid"
                  tabIndex={filterType === "take_home" ? 0 : -1}
                  onClick={() => {
                    setFilterType("take_home");
                    setSelectedIds(new Set());
                  }}
                  className={`px-3 py-2 sm:px-2.5 sm:py-1 min-h-[38px] sm:min-h-0 rounded-md font-medium transition-colors cursor-pointer shrink-0 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring ${
                    filterType === "take_home"
                      ? "bg-background text-foreground shadow-2xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Take-Home ({counts.take_home})
                </button>
                {counts.archived > 0 && (
                  <button
                    type="button"
                    id="filter-tab-archived"
                    role="tab"
                    aria-selected={filterType === "archived"}
                    aria-controls="activities-grid"
                    tabIndex={filterType === "archived" ? 0 : -1}
                    onClick={() => {
                      setFilterType("archived");
                      setSelectedIds(new Set());
                    }}
                    className={`px-3 py-2 sm:px-2.5 sm:py-1 min-h-[38px] sm:min-h-0 rounded-md font-medium transition-colors cursor-pointer shrink-0 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring ${
                      filterType === "archived"
                        ? "bg-background text-foreground shadow-2xs font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Archived ({counts.archived})
                  </button>
                )}
              </div>

              {/* Sort Selector */}
              <DropdownMenu>
                <DropdownMenuTrigger className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground bg-muted/40 hover:bg-muted/70 border border-border/50 rounded-lg px-2.5 py-1.5 min-h-[38px] sm:min-h-0 transition-colors cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring">
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
              className="bg-surface dark:bg-card border border-border rounded-xl sm:rounded-2xl p-5 space-y-3 shadow-2xs"
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
        <div className="bg-surface dark:bg-card border border-border rounded-xl sm:rounded-2xl shadow-2xs overflow-hidden">
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
        <div className="bg-surface dark:bg-card border border-border rounded-xl sm:rounded-2xl shadow-2xs overflow-hidden">
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
                className={`group relative flex flex-col justify-between bg-surface dark:bg-card border rounded-xl sm:rounded-2xl p-5 shadow-2xs hover:shadow-md transition-all duration-200 ${
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
                          className="flex size-7 sm:size-6 items-center justify-center rounded-md hover:bg-muted/70 cursor-pointer transition-colors relative after:absolute after:-inset-2 after:content-['']"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={selectedIds.has(activity.id)}
                            onChange={() => {}}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleSelect(activity.id, e.shiftKey);
                            }}
                            aria-label={`Select activity: ${activity.target_text.slice(0, 40)}`}
                            className="size-4 rounded border-border accent-primary cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                          />
                        </label>
                      </div>

                      {isArchived ? (
                        <Badge
                          variant="outline"
                          className="text-[10px] font-semibold px-2 py-0.5 bg-muted/60 text-muted-foreground border-border"
                        >
                          <Archive className="w-3 h-3 mr-1" />
                          Archived
                        </Badge>
                      ) : activity.is_take_home ? (
                        <Badge
                          variant="outline"
                          className="text-[10px] font-semibold px-2 py-0.5 bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300 border-brand-200/80 dark:border-brand-900"
                        >
                          <Home className="w-3 h-3 mr-1" />
                          Take-home
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-[10px] font-semibold px-2 py-0.5 bg-muted/40 text-muted-foreground border-border"
                        >
                          In-Class
                        </Badge>
                      )}

                      <Badge
                        variant="outline"
                        className="text-[10px] font-medium px-2 py-0.5 bg-muted/50 text-muted-foreground border-border/70"
                      >
                        {wordCount} {wordCount === 1 ? "word" : "words"}
                      </Badge>
                    </div>

                    {/* Overflow Actions Menu with mobile-friendly hit target */}
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        className="relative flex size-8 sm:size-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring after:absolute after:-inset-1.5 after:content-['']"
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
                    className="block group-hover:opacity-90 transition-opacity focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring rounded-xl"
                  >
                    <div className="relative p-3.5 sm:p-4 rounded-xl bg-linear-to-b from-brand-50/20 via-surface to-brand-50/10 dark:from-card dark:to-card/80 border border-brand-200/50 dark:border-border/60 mb-3.5 overflow-hidden shadow-2xs">
                      {/* Authentic 3-line ruling aligned with Cedarville Cursive baseline */}
                      <div
                        className="absolute inset-x-3.5 inset-y-3.5 sm:inset-x-4 sm:inset-y-4 pointer-events-none opacity-40 dark:opacity-20 cursive-guidelines overflow-hidden"
                        aria-hidden="true"
                      />
                      <p className="relative font-cursive text-[32px] leading-[48px] text-foreground/90 font-normal line-clamp-3 tracking-wide">
                        {activity.target_text}
                      </p>
                    </div>
                  </Link>
                </div>

                {/* Card Footer: Submission Progress Gauge & Actions */}
                <div className="space-y-2.5 pt-2 border-t border-border/60">
                  {/* Status header with count and timestamp */}
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold text-foreground text-[11px] flex items-center gap-1">
                        <Inbox className="size-3 text-muted-foreground" />
                        {totalStudents > 0 ? (
                          <span>
                            {submissionCount} of {totalStudents} collected
                          </span>
                        ) : (
                          <span>
                            {submissionCount}{" "}
                            {submissionCount === 1
                              ? "submission"
                              : "submissions"}
                          </span>
                        )}
                      </span>

                      {isFullyCollected && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-900">
                          <CheckCircle2 className="size-2.5" />
                          Complete
                        </span>
                      )}
                    </div>

                    <span className="text-[10px] text-muted-foreground flex items-center gap-1 shrink-0">
                      <CalendarDays className="size-3" />
                      {getRelativeTime(activity.created_at)}
                    </span>
                  </div>

                  {/* Visual Progress Bar (when totalStudents > 0) */}
                  {totalStudents > 0 && (
                    <TooltipProvider>
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
                              className="w-full bg-muted/60 dark:bg-muted/40 h-2 rounded-full overflow-hidden flex shadow-2xs cursor-help focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              {completedCount > 0 && (
                                <div
                                  className="bg-emerald-500 transition-all duration-300 motion-reduce:transition-none"
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
                                  className="bg-destructive/80 transition-all duration-300 motion-reduce:transition-none"
                                  style={{
                                    width: `${(rejectedCount / totalStudents) * 100}%`,
                                  }}
                                />
                              )}
                            </div>
                          }
                        />
                        <TooltipContent side="top" className="text-xs p-2.5 space-y-1.5 min-w-[210px]">
                          <div className="font-semibold text-background pb-1 border-b border-background/20 flex items-center justify-between">
                            <span>Class Submissions</span>
                            <span>{submissionCount}/{totalStudents}</span>
                          </div>
                          <div className="space-y-1 text-[11px] text-background">
                            <div className="flex items-center justify-between">
                              <span className="flex items-center gap-1.5 text-background/90">
                                <span className="size-2 rounded-full bg-emerald-400 inline-block shrink-0" />
                                Completed
                              </span>
                              <span className="font-semibold tabular-nums text-background">{completedCount}</span>
                            </div>
                            {processingCount > 0 && (
                              <div className="flex items-center justify-between">
                                <span className="flex items-center gap-1.5 text-background/90">
                                  <span className="size-2 rounded-full bg-amber-400 inline-block shrink-0" />
                                  Processing
                                </span>
                                <span className="font-semibold tabular-nums text-background">{processingCount}</span>
                              </div>
                            )}
                            {rejectedCount > 0 && (
                              <div className="flex items-center justify-between">
                                <span className="flex items-center gap-1.5 text-background/90">
                                  <span className="size-2 rounded-full bg-destructive inline-block shrink-0" />
                                  Rejected (Needs Resubmission)
                                </span>
                                <span className="font-semibold tabular-nums text-background">{rejectedCount}</span>
                              </div>
                            )}
                            {totalStudents - submissionCount > 0 && (
                              <div className="flex items-center justify-between text-background/70 pt-0.5 border-t border-background/15">
                                <span className="flex items-center gap-1.5">
                                  <span className="size-2 rounded-full bg-background/40 inline-block shrink-0" />
                                  Unsubmitted
                                </span>
                                <span className="font-medium tabular-nums">{totalStudents - submissionCount}</span>
                              </div>
                            )}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}

                  {/* Action Buttons Row */}
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openUpload({ activityId: activity.id })}
                      className="h-8 min-h-[36px] px-2.5 text-xs font-medium border-border/80 hover:bg-brand-50 hover:text-brand-700 dark:hover:bg-brand-950/60 dark:hover:text-brand-300 rounded-lg cursor-pointer transition-colors"
                    >
                      <Upload className="size-3.5 mr-1 text-primary" />
                      Upload
                    </Button>

                    <Link
                      href={`/activities/${activity.id}`}
                      className="inline-flex items-center text-xs font-semibold text-primary hover:text-brand-700 dark:hover:text-brand-300 py-1.5 px-2 -mr-1 rounded-md transition-colors group/link min-h-[36px]"
                    >
                      <span>View Submissions</span>
                      <span className="ml-1 text-xs transition-transform group-hover/link:translate-x-0.5">
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
  );
}