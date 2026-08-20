"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type Activity, useActivities } from "@/lib/hooks/use-activities";
import { useStudents } from "@/lib/hooks/use-students";
import { useTeacherModals } from "@/components/teacher-modals-provider";
import { CreateActivityDialog } from "@/components/activities/create-activity-dialog";
import { EditActivityDialog } from "@/components/activities/edit-activity-dialog";
import { DeleteActivityDialog } from "@/components/activities/delete-activity-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { Skeleton } from "@/components/ui/skeleton";
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
  FileText,
  MoreVertical,
  Edit3,
  Trash2,
  Inbox,
  CheckCircle2,
  Clock,
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

const ARCHIVE_STORAGE_KEY = "writewise_archived_activities";

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

  // Local storage backed archived activities state
  const [archivedIds, setArchivedIds] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const stored = localStorage.getItem(ARCHIVE_STORAGE_KEY);
      if (stored) {
        return new Set(JSON.parse(stored));
      }
    } catch {
      // Ignore storage errors
    }
    return new Set();
  });

  const handleToggleArchive = useCallback((activityId: string) => {
    setArchivedIds((prev) => {
      const next = new Set(prev);
      const wasArchived = next.has(activityId);
      if (wasArchived) {
        next.delete(activityId);
        toast.success("Activity restored from archive.");
      } else {
        next.add(activityId);
        toast.success("Activity moved to archive.");
      }
      try {
        localStorage.setItem(
          ARCHIVE_STORAGE_KEY,
          JSON.stringify(Array.from(next))
        );
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  }, []);

  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const searchInputRef = useRef<HTMLInputElement>(null);

  const totalStudents = students?.length ?? 0;

  // Keyboard shortcut: "/" or Cmd/Ctrl+K to focus search
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
  }, [isCreateOpen, editingActivity, deletingActivity, duplicatingActivity]);

  // Counts for filter pills
  const counts = useMemo(() => {
    if (!activities) return { all: 0, in_class: 0, take_home: 0, archived: 0 };
    const archivedList = activities.filter((a) => archivedIds.has(a.id));
    const activeList = activities.filter((a) => !archivedIds.has(a.id));

    return {
      all: activeList.length,
      in_class: activeList.filter((a) => !a.is_take_home).length,
      take_home: activeList.filter((a) => a.is_take_home).length,
      archived: archivedList.length,
    };
  }, [activities, archivedIds]);

  const filteredAndSortedActivities = useMemo(() => {
    if (!activities) return [];

    // 1. Lifecycle filter (Active vs Archived)
    let result = activities;
    if (filterType === "archived") {
      result = result.filter((a) => archivedIds.has(a.id));
    } else {
      result = result.filter((a) => !archivedIds.has(a.id));
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
  }, [activities, archivedIds, searchQuery, filterType, sortBy]);

  if (error) {
    return (
      <div className="max-w-6xl mx-auto">
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
    <div className="max-w-6xl mx-auto space-y-5 sm:space-y-6 pb-20 sm:pb-16 px-1 sm:px-0">
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
              {/* Type & Archive Filter Buttons */}
              <div className="inline-flex p-0.5 rounded-lg bg-muted/60 border border-border/50 text-xs overflow-x-auto max-w-full">
                <button
                  type="button"
                  onClick={() => setFilterType("all")}
                  className={`px-2.5 py-1.5 sm:py-1 rounded-md font-medium transition-colors cursor-pointer shrink-0 ${
                    filterType === "all"
                      ? "bg-background text-foreground shadow-2xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  All ({counts.all})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType("in_class")}
                  className={`px-2.5 py-1.5 sm:py-1 rounded-md font-medium transition-colors cursor-pointer shrink-0 ${
                    filterType === "in_class"
                      ? "bg-background text-foreground shadow-2xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  In-Class ({counts.in_class})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType("take_home")}
                  className={`px-2.5 py-1.5 sm:py-1 rounded-md font-medium transition-colors cursor-pointer shrink-0 ${
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
                    onClick={() => setFilterType("archived")}
                    className={`px-2.5 py-1.5 sm:py-1 rounded-md font-medium transition-colors cursor-pointer shrink-0 ${
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
              <div className="relative inline-flex items-center">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/40 border border-border/50 rounded-lg px-2.5 py-1.5">
                  <ArrowUpDown className="size-3 text-muted-foreground shrink-0" />
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortOption)}
                    className="bg-transparent text-xs font-medium text-foreground outline-none cursor-pointer pr-1"
                    aria-label="Sort activities by"
                  >
                    <option value="newest">Newest First</option>
                    <option value="oldest">Oldest First</option>
                    <option value="most_submissions">Most Submissions</option>
                    <option value="least_submissions">Least Submissions</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filter results indicator */}
      {searchQuery && activities && activities.length > 0 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
          <span>
            Showing{" "}
            <strong className="text-foreground">
              {filteredAndSortedActivities.length}
            </strong>{" "}
            of {activities.length} activities matching &ldquo;
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAndSortedActivities.map((activity) => {
            const isArchived = archivedIds.has(activity.id);
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

            return (
              <div
                key={activity.id}
                className={`group relative flex flex-col justify-between bg-surface dark:bg-card border rounded-xl sm:rounded-2xl p-5 shadow-2xs hover:shadow-md transition-all duration-200 ${
                  isArchived
                    ? "border-dashed border-border/80 opacity-80 hover:opacity-100"
                    : "border-border hover:border-brand-300 dark:hover:border-brand-800"
                }`}
              >
                <div>
                  {/* Card Header: Icon, Type Badge & Actions Menu */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <div className="flex size-8 items-center justify-center rounded-lg bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300 shrink-0">
                        <FileText className="size-4" />
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
                    </div>

                    {/* Overflow Actions Menu & Quick Actions */}
                    <div className="flex items-center gap-1">
                      {/* Direct Upload Shortcut */}
                      <button
                        type="button"
                        onClick={() => openUpload({ activityId: activity.id })}
                        className="flex size-9 sm:size-8 items-center justify-center rounded-lg text-muted-foreground hover:text-brand-700 hover:bg-brand-50 dark:hover:bg-brand-950/60 transition-colors cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                        title="Upload student worksheet photo"
                        aria-label="Upload worksheet for this activity"
                      >
                        <Upload className="size-4" />
                      </button>

                      {/* Dropdown Menu */}
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          className="flex size-9 sm:size-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
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
                            onClick={() => handleToggleArchive(activity.id)}
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
                  </div>

                  {/* Target Text Preview with Cursive Worksheet Accent */}
                  <Link
                    href={`/activities/${activity.id}`}
                    className="block group-hover:text-brand-700 dark:group-hover:text-brand-300 transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring rounded-lg"
                  >
                    <div className="relative p-3 rounded-lg bg-muted/30 border border-border/40 mb-3 overflow-hidden">
                      {/* Subtle cursive ruling watermark lines */}
                      <div
                        className="absolute inset-0 opacity-15 pointer-events-none bg-[linear-gradient(to_bottom,transparent_0px,transparent_11px,var(--border)_12px)] bg-[size:100%_12px]"
                        aria-hidden="true"
                      />
                      <p className="relative text-sm font-medium text-foreground line-clamp-3 leading-relaxed">
                        &ldquo;{activity.target_text}&rdquo;
                      </p>
                    </div>
                  </Link>
                </div>

                {/* Card Footer: Word Count, Submissions Status & Date */}
                <div className="space-y-2.5 pt-1 border-t border-border/60">
                  {/* Submission Status Indicator */}
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold text-foreground text-[11px] flex items-center gap-1">
                        <Inbox className="size-3 text-muted-foreground" />
                        {submissionCount === 0 ? (
                          <span className="text-muted-foreground font-normal">
                            0 submissions
                          </span>
                        ) : totalStudents > 0 ? (
                          <span>
                            {submissionCount}/{totalStudents} submitted
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

                      {/* Status breakdown dots */}
                      {submissionCount > 0 && (
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          {completedCount > 0 && (
                            <span className="inline-flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400 font-medium">
                              <CheckCircle2 className="size-2.5" />
                              {completedCount}
                            </span>
                          )}
                          {processingCount > 0 && (
                            <span className="inline-flex items-center gap-0.5 text-amber-600 dark:text-amber-400 font-medium">
                              <Clock className="size-2.5" />
                              {processingCount}
                            </span>
                          )}
                          {rejectedCount > 0 && (
                            <span className="inline-flex items-center gap-0.5 text-destructive font-medium">
                              <AlertCircle className="size-2.5" />
                              {rejectedCount}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <Badge
                      variant="outline"
                      className="text-[10px] font-semibold px-2 py-0.5 bg-muted/40 text-muted-foreground border-border shrink-0"
                    >
                      {wordCount} {wordCount === 1 ? "wd" : "wds"}
                    </Badge>
                  </div>

                  {/* Relative Timestamp & View Link */}
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-0.5">
                    <span className="flex items-center gap-1">
                      <CalendarDays className="w-3 h-3" />
                      {getRelativeTime(activity.created_at)}
                    </span>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/activities/${activity.id}`}
                        className="text-primary hover:underline font-medium text-[11px] p-1 -m-1"
                      >
                        View &rarr;
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

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