"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useActivities } from "@/lib/hooks/use-activities";
import { CreateActivityDialog } from "@/components/activities/create-activity-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { Skeleton } from "@/components/ui/skeleton";
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
} from "lucide-react";

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
      year:
        date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  }
  if (diffDays > 0)
    return `${diffDays}d ago`;
  if (diffHours > 0)
    return `${diffHours}h ago`;
  if (diffMins > 0)
    return `${diffMins}m ago`;
  return "Just now";
}

export default function ActivitiesPage() {
  const router = useRouter();
  const { data: activities, isLoading, error, refetch } = useActivities();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut: "/" to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      if (isDialogOpen) return;

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
  }, [isDialogOpen]);

  const filteredActivities = useMemo(() => {
    if (!activities) return [];
    if (!searchQuery) return activities;

    const query = searchQuery.toLowerCase();
    return activities.filter((activity) =>
      activity.target_text.toLowerCase().includes(query)
    );
  }, [activities, searchQuery]);

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
                {activities.length}{" "}
                {activities.length === 1 ? "Activity" : "Activities"}
              </Badge>
            )}
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-normal">
            Create and manage handwriting activities for your students.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            onClick={() => setIsDialogOpen(true)}
            className="h-10 sm:h-9 w-full sm:w-auto bg-primary hover:bg-brand-700 text-primary-foreground text-xs sm:text-sm font-medium shadow-xs rounded-lg sm:rounded-xl"
          >
            <Plus className="w-4 h-4 mr-1.5 shrink-0" />
            Create Activity
          </Button>
        </div>
      </div>

      {/* Search Bar — only when activities exist */}
      {activities && activities.length > 0 && (
        <div className="bg-surface dark:bg-card p-3 rounded-xl sm:rounded-2xl border border-border shadow-2xs">
          <div className="relative w-full lg:w-72">
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
              className="pl-9 pr-8 h-10 sm:h-9 text-base sm:text-sm rounded-lg sm:rounded-xl"
              aria-keyshortcuts="/"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  searchInputRef.current?.focus();
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 rounded-full transition-colors cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring after:absolute after:-inset-2 after:content-['']"
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
        </div>
      )}

      {/* Filter results indicator */}
      {searchQuery && activities && activities.length > 0 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
          <span>
            Showing{" "}
            <strong className="text-foreground">
              {filteredActivities.length}
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
                Create your first handwriting activity to start assessing
                student submissions.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent className="flex items-center justify-center w-full sm:w-auto px-4 sm:px-0">
              <Button
                onClick={() => setIsDialogOpen(true)}
                className="h-10 sm:h-9 w-full sm:w-auto bg-primary hover:bg-brand-700 text-primary-foreground font-medium text-xs sm:text-sm rounded-lg sm:rounded-xl"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Activity
              </Button>
            </EmptyContent>
          </Empty>
        </div>
      ) : filteredActivities.length === 0 ? (
        /* Empty State — No search results */
        <div className="bg-surface dark:bg-card border border-border rounded-xl sm:rounded-2xl shadow-2xs overflow-hidden">
          <Empty className="py-12 border-0">
            <EmptyMedia
              variant="icon"
              className="bg-muted text-muted-foreground"
            >
              <SearchX className="w-6 h-6" />
            </EmptyMedia>
            <EmptyHeader>
              <EmptyTitle className="text-lg sm:text-xl">
                No matching activities
              </EmptyTitle>
              <EmptyDescription className="text-xs sm:text-sm">
                We couldn&apos;t find any activities matching &ldquo;
                {searchQuery}&rdquo;.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button
                variant="outline"
                onClick={() => setSearchQuery("")}
                className="h-10 sm:h-9 font-medium text-xs sm:text-sm rounded-lg sm:rounded-xl"
              >
                Clear Search
              </Button>
            </EmptyContent>
          </Empty>
        </div>
      ) : (
        /* Activity Card Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredActivities.map((activity) => (
            <button
              key={activity.id}
              type="button"
              onClick={() => router.push(`/activities/${activity.id}`)}
              className="group text-left bg-surface dark:bg-card border border-border rounded-xl sm:rounded-2xl p-5 shadow-2xs hover:shadow-md hover:border-brand-200 dark:hover:border-brand-900 transition-all duration-200 cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {/* Target Text Preview */}
              <div className="flex items-start gap-3 mb-3">
                <div className="flex size-9 items-center justify-center rounded-lg bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300 shrink-0 mt-0.5">
                  <FileText className="size-4" />
                </div>
                <p className="text-sm font-medium text-foreground line-clamp-2 leading-relaxed group-hover:text-brand-700 dark:group-hover:text-brand-300 transition-colors">
                  &ldquo;{activity.target_text}&rdquo;
                </p>
              </div>

              {/* Metadata Row */}
              <div className="flex items-center gap-2 flex-wrap">
                <Badge
                  variant="outline"
                  className="text-[10px] font-semibold px-2 py-0.5 bg-muted/50 text-muted-foreground border-border"
                >
                  {getWordCount(activity.target_text)}{" "}
                  {getWordCount(activity.target_text) === 1
                    ? "word"
                    : "words"}
                </Badge>

                {activity.is_take_home && (
                  <Badge
                    variant="outline"
                    className="text-[10px] font-semibold px-2 py-0.5 bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300 border-brand-200/80 dark:border-brand-900"
                  >
                    <Home className="w-3 h-3 mr-1" />
                    Take-home
                  </Badge>
                )}

                <span className="text-[10px] text-muted-foreground ml-auto flex items-center gap-1">
                  <CalendarDays className="w-3 h-3" />
                  {getRelativeTime(activity.created_at)}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Create Activity Dialog */}
      <CreateActivityDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
      />
    </div>
  );
}