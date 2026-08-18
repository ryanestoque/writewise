"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useStudents, useRemoveStudent, Student } from "@/lib/hooks/use-students";
import { runConcurrentPool } from "@/lib/utils/concurrent-pool";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import {
  MoreHorizontal,
  Plus,
  Loader2,
  Trash2,
  Edit2,
  Users,
  AlertCircle,
  RotateCcw,
  Search,
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  UserPlus,
  SearchX,
  Mail,
  Download,
} from "lucide-react";
import { StudentDialog } from "@/components/roster/student-dialog";
import { BulkStudentDialog } from "@/components/roster/bulk-student-dialog";
import { BatchMoveDialog } from "@/components/roster/batch-move-dialog";
import { FloatingBatchBar } from "@/components/roster/floating-batch-bar";
import { exportStudentsToCSV } from "@/lib/utils/csv-export";
import { createClient } from "@/lib/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

type SortField = "full_name" | "section" | "created_at";
type SortDirection = "asc" | "desc";

function getInitials(name: string) {
  if (!name) return "";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Consistent subtle avatar background based on student name
const AVATAR_PALETTES = [
  "bg-amber-100 text-amber-800 border-amber-200/60 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-900",
  "bg-emerald-100 text-emerald-800 border-emerald-200/60 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-900",
  "bg-blue-100 text-blue-800 border-blue-200/60 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-900",
  "bg-purple-100 text-purple-800 border-purple-200/60 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-900",
  "bg-brand-100 text-brand-800 border-brand-200/60 dark:bg-brand-950 dark:text-brand-300 dark:border-brand-900",
  "bg-rose-100 text-rose-800 border-rose-200/60 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-900",
];

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_PALETTES.length;
  return AVATAR_PALETTES[index];
}

export default function RosterPage() {
  const queryClient = useQueryClient();
  const { data: students, isLoading, error, refetch } = useStudents();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false);
  const [studentToEdit, setStudentToEdit] = useState<Student | null>(null);

  // Search, Filter, Sort state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSection, setSelectedSection] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("full_name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Multi-select & Batch Operations state
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [isBatchMoveOpen, setIsBatchMoveOpen] = useState(false);
  const [isBatchRemoveOpen, setIsBatchRemoveOpen] = useState(false);
  const [isBatchRemoving, setIsBatchRemoving] = useState(false);

  // Section horizontal scroll state for gradient overflow cues
  const sectionScrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = sectionScrollRef.current;
    if (!el) return;
    const hasOverflow = el.scrollWidth > el.clientWidth + 1;
    const nextLeft = hasOverflow && el.scrollLeft > 2;
    const nextRight = hasOverflow && el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
    setCanScrollLeft((prev) => (prev !== nextLeft ? nextLeft : prev));
    setCanScrollRight((prev) => (prev !== nextRight ? nextRight : prev));
  }, []);

  // Keyboard shortcut: Press "/" or "Cmd/Ctrl+K" to focus search; Escape to clear selection
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable ||
          target.getAttribute("role") === "combobox");

      if (isDialogOpen || isBulkDialogOpen || isBatchMoveOpen || isBatchRemoveOpen) return;

      if (e.key === "Escape" && selectedStudentIds.size > 0 && !isTyping) {
        e.preventDefault();
        setSelectedStudentIds(new Set());
        return;
      }

      if ((e.key === "/" || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k")) && !isTyping) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDialogOpen, isBulkDialogOpen, isBatchMoveOpen, isBatchRemoveOpen, selectedStudentIds]);

  const handleEdit = (student: Student) => {
    setStudentToEdit(student);
    setIsDialogOpen(true);
  };

  const handleOpenNew = () => {
    setStudentToEdit(null);
    setIsDialogOpen(true);
  };

  const handleOpenBulk = () => {
    setIsBulkDialogOpen(true);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Section list & counts
  const { sections, sectionCounts } = useMemo(() => {
    if (!students) return { sections: [], sectionCounts: new Map<string, number>() };
    const counts = new Map<string, number>();
    students.forEach((s) => {
      if (s.section) {
        counts.set(s.section, (counts.get(s.section) || 0) + 1);
      }
    });
    return {
      sections: Array.from(counts.keys()).sort(),
      sectionCounts: counts,
    };
  }, [students]);

  // Keep scroll overflow indicators in sync with content and viewport changes
  useEffect(() => {
    updateScrollState();
    const handleResize = () => updateScrollState();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [sections, students, updateScrollState]);

  // Filtered & Sorted student list
  const filteredStudents = useMemo(() => {
    if (!students) return [];

    const result = students.filter((student) => {
      const matchesSearch =
        searchQuery === "" ||
        student.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.section.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (student.parent_email && student.parent_email.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesSection =
        selectedSection === "all" || student.section === selectedSection;

      return matchesSearch && matchesSection;
    });

    result.sort((a, b) => {
      let comparison = 0;
      if (sortField === "full_name") {
        comparison = a.full_name.localeCompare(b.full_name);
      } else if (sortField === "section") {
        comparison = a.section.localeCompare(b.section);
      } else if (sortField === "created_at") {
        comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });

    return result;
  }, [students, searchQuery, selectedSection, sortField, sortDirection]);

  const hasActiveFilters = searchQuery !== "" || selectedSection !== "all";

  const handleResetFilters = () => {
    setSearchQuery("");
    setSelectedSection("all");
  };

  // Multi-select helpers
  const selectedStudentsList = useMemo(() => {
    if (!students) return [];
    return students.filter((s) => selectedStudentIds.has(s.id));
  }, [students, selectedStudentIds]);

  const allFilteredSelected = useMemo(() => {
    if (filteredStudents.length === 0) return false;
    return filteredStudents.every((s) => selectedStudentIds.has(s.id));
  }, [filteredStudents, selectedStudentIds]);

  const someFilteredSelected = useMemo(() => {
    return filteredStudents.some((s) => selectedStudentIds.has(s.id)) && !allFilteredSelected;
  }, [filteredStudents, selectedStudentIds, allFilteredSelected]);

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      const newSet = new Set(selectedStudentIds);
      filteredStudents.forEach((s) => newSet.delete(s.id));
      setSelectedStudentIds(newSet);
    } else {
      const newSet = new Set(selectedStudentIds);
      filteredStudents.forEach((s) => newSet.add(s.id));
      setSelectedStudentIds(newSet);
    }
  };

  const toggleSelectStudent = (id: string) => {
    const newSet = new Set(selectedStudentIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedStudentIds(newSet);
  };

  const clearSelection = () => {
    setSelectedStudentIds(new Set());
  };

  // CSV Export Handlers
  const handleExportRoster = () => {
    if (!students || students.length === 0) {
      toast.error("No students to export.");
      return;
    }
    const targetList = hasActiveFilters ? filteredStudents : students;
    const sectionTag = selectedSection !== "all" ? `-${selectedSection.replace(/[^a-zA-Z0-9_-]/g, "_")}` : "";
    const filename = `writewise-roster${sectionTag}-${new Date().toISOString().split("T")[0]}`;
    exportStudentsToCSV(targetList, filename);
    toast.success(`Exported ${targetList.length} ${targetList.length === 1 ? "student" : "students"} to CSV.`);
  };

  const handleExportSelected = () => {
    if (selectedStudentsList.length === 0) return;
    const filename = `writewise-selected-students-${new Date().toISOString().split("T")[0]}`;
    exportStudentsToCSV(selectedStudentsList, filename);
    toast.success(`Exported ${selectedStudentsList.length} selected ${selectedStudentsList.length === 1 ? "student" : "students"} to CSV.`);
  };

  const handleBatchRemoveConfirm = async () => {
    if (selectedStudentsList.length === 0) return;
    setIsBatchRemoving(true);

    const supabase = createClient();
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    if (!token) {
      toast.error("Authentication session expired. Please log in again.");
      setIsBatchRemoving(false);
      return;
    }

    const { successCount, failedItems } = await runConcurrentPool(
      Array.from(selectedStudentIds),
      async (id) => {
        const res = await fetch(`/api/students/${id}/teacher-link`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
        return res.ok;
      },
      { concurrency: 4 }
    );

    await queryClient.invalidateQueries({ queryKey: ["students"] });
    setIsBatchRemoving(false);
    setIsBatchRemoveOpen(false);
    clearSelection();

    if (failedItems.length === 0) {
      toast.success(`Removed ${successCount} ${successCount === 1 ? "student" : "students"} from roster.`);
    } else {
      toast.warning(`Removed ${successCount} students. ${failedItems.length} could not be removed.`);
    }
  };

  if (error) {
    return (
      <div className="max-w-6xl mx-auto">
        <div
          role="alert"
          className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl border border-destructive/20 bg-destructive/10 text-destructive"
        >
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span className="text-sm font-medium">Failed to load roster: {error.message}</span>
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
      {/* Header section with title and actions */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-heading font-semibold text-foreground tracking-tight">Class Roster</h1>
            {students && students.length > 0 && (
              <Badge variant="outline" className="text-xs font-semibold px-2.5 py-0.5 bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300 border-brand-200/80 dark:border-brand-900">
                {students.length} {students.length === 1 ? "Student" : "Students"}
              </Badge>
            )}
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-normal">
            Manage student enrollment and class sections for handwriting assessment activities.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap sm:flex-nowrap">
          {students && students.length > 0 && (
            <Button
              onClick={handleExportRoster}
              variant="outline"
              className="h-10 sm:h-9 flex-1 sm:flex-none border-border text-foreground hover:bg-muted text-xs sm:text-sm font-medium shadow-2xs rounded-lg sm:rounded-xl"
            >
              <Download className="w-4 h-4 mr-1.5 text-muted-foreground shrink-0" />
              Export CSV
            </Button>
          )}

          <Button
            onClick={handleOpenBulk}
            variant="outline"
            className="h-10 sm:h-9 flex-1 sm:flex-none border-border text-foreground hover:bg-muted text-xs sm:text-sm font-medium shadow-2xs rounded-lg sm:rounded-xl"
          >
            <UserPlus className="w-4 h-4 mr-1.5 text-muted-foreground shrink-0" />
            Bulk Add
          </Button>

          <Button
            onClick={handleOpenNew}
            className="h-10 sm:h-9 w-full sm:w-auto bg-primary hover:bg-brand-700 text-primary-foreground text-xs sm:text-sm font-medium shadow-xs rounded-lg sm:rounded-xl"
          >
            <Plus className="w-4 h-4 mr-1.5 shrink-0" />
            Add Student
          </Button>
        </div>
      </div>

      {/* Main Roster Container */}
      <div className="space-y-4">
        {/* Search and Section Filters Bar */}
        {students && students.length > 0 && (
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-surface dark:bg-card p-3 rounded-xl sm:rounded-2xl border border-border shadow-2xs">
            {/* Search Input */}
            <div className="relative w-full lg:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                ref={searchInputRef}
                placeholder="Search student or section..."
                aria-label="Search students by name, section, or parent email"
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
                  <Kbd className="text-[10px] h-5 px-1 bg-muted text-muted-foreground border-border">/</Kbd>
                </div>
              )}
            </div>

            {/* Section Filter Pills with overflow affordance */}
            <div className="relative min-w-0 flex-1 flex items-center">
              {/* Left scroll fade indicator */}
              {canScrollLeft && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-surface dark:from-card to-transparent z-10"
                />
              )}

              <div
                ref={sectionScrollRef}
                onScroll={updateScrollState}
                role="group"
                aria-label="Filter by class section"
                className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 scrollbar-none w-full touch-pan-x overscroll-x-contain"
              >
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mr-1 shrink-0">
                  Section:
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedSection("all")}
                  aria-pressed={selectedSection === "all"}
                  className={`relative inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[34px] sm:min-h-[32px] text-xs font-medium rounded-lg border transition-all shrink-0 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring after:absolute after:-inset-1 after:content-[''] ${selectedSection === "all"
                      ? "bg-brand-700 dark:bg-primary text-white dark:text-primary-foreground border-brand-700 dark:border-primary shadow-2xs"
                      : "bg-background text-muted-foreground border-border hover:bg-muted/60 hover:text-foreground"
                    }`}
                >
                  All
                  <span
                    className={`text-[10px] font-medium px-1.5 py-0.2 rounded-full ${selectedSection === "all" ? "bg-white/20 dark:bg-primary-foreground/20 text-white dark:text-primary-foreground" : "bg-muted text-foreground"
                      }`}
                  >
                    {students.length}
                  </span>
                </button>

                {sections.map((sec) => {
                  const count = sectionCounts.get(sec) || 0;
                  const isSelected = selectedSection === sec;
                  return (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => setSelectedSection(sec)}
                      aria-pressed={isSelected}
                      className={`relative inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[34px] sm:min-h-[32px] text-xs font-medium rounded-lg border transition-all shrink-0 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring after:absolute after:-inset-1 after:content-[''] ${isSelected
                          ? "bg-brand-700 dark:bg-primary text-white dark:text-primary-foreground border-brand-700 dark:border-primary shadow-2xs"
                          : "bg-background text-muted-foreground border-border hover:bg-muted/60 hover:text-foreground"
                        }`}
                    >
                      {sec}
                      <span
                        className={`text-[10px] font-medium px-1.5 py-0.2 rounded-full ${isSelected ? "bg-white/20 dark:bg-primary-foreground/20 text-white dark:text-primary-foreground" : "bg-muted text-foreground"
                          }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Right scroll fade indicator */}
              {canScrollRight && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-surface dark:from-card to-transparent z-10"
                />
              )}
            </div>
          </div>
        )}

        {/* Filter results status indicator if active */}
        {hasActiveFilters && students && students.length > 0 && (
          <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
            <span>
              Showing <strong className="text-foreground">{filteredStudents.length}</strong> of {students.length} students
              {selectedSection !== "all" && <span> in <strong className="text-foreground">{selectedSection}</strong></span>}
              {searchQuery && <span> matching &ldquo;<strong className="text-foreground">{searchQuery}</strong>&rdquo;</span>}
            </span>
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-primary hover:underline font-medium cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring rounded-sm px-1 py-0.5"
            >
              Clear filters
            </button>
          </div>
        )}

        {/* Loading state */}
        {isLoading ? (
          <div className="bg-surface dark:bg-card border border-border rounded-xl sm:rounded-2xl p-12 flex flex-col items-center justify-center gap-2 text-muted-foreground shadow-2xs">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <span className="text-sm font-medium">Loading class roster...</span>
          </div>
        ) : students?.length === 0 ? (
          /* Empty Roster State */
          <div className="bg-surface dark:bg-card border border-border rounded-xl sm:rounded-2xl shadow-2xs overflow-hidden">
            <Empty className="py-14 border-0">
              <EmptyMedia variant="icon" className="bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300">
                <Users className="w-6 h-6" />
              </EmptyMedia>
              <EmptyHeader>
                <EmptyTitle className="text-lg sm:text-xl">No students yet</EmptyTitle>
                <EmptyDescription className="text-xs sm:text-sm max-w-sm mx-auto">
                  Add your first student or bulk-paste an entire class list to start creating handwriting activities.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2.5 w-full sm:w-auto px-4 sm:px-0">
                <Button
                  onClick={handleOpenBulk}
                  variant="outline"
                  className="h-10 sm:h-9 w-full sm:w-auto font-medium text-xs sm:text-sm rounded-lg sm:rounded-xl"
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  Bulk Add
                </Button>
                <Button
                  onClick={handleOpenNew}
                  className="h-10 sm:h-9 w-full sm:w-auto bg-primary hover:bg-brand-700 text-primary-foreground font-medium text-xs sm:text-sm rounded-lg sm:rounded-xl"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Student
                </Button>
              </EmptyContent>
            </Empty>
          </div>
        ) : filteredStudents.length === 0 ? (
          /* Filter Empty State */
          <div className="bg-surface dark:bg-card border border-border rounded-xl sm:rounded-2xl shadow-2xs overflow-hidden">
            <Empty className="py-12 border-0">
              <EmptyMedia variant="icon" className="bg-muted text-muted-foreground">
                <SearchX className="w-6 h-6" />
              </EmptyMedia>
              <EmptyHeader>
                <EmptyTitle className="text-lg sm:text-xl">No matching students</EmptyTitle>
                <EmptyDescription className="text-xs sm:text-sm">
                  We couldn&apos;t find any students matching &ldquo;{searchQuery}&rdquo;
                  {selectedSection !== "all" ? ` in ${selectedSection}` : ""}.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button onClick={handleResetFilters} variant="outline" size="sm" className="rounded-lg sm:rounded-xl">
                  Clear filters
                </Button>
              </EmptyContent>
            </Empty>
          </div>
        ) : (
          <>
            {/* Desktop & Tablet Table View (md and up) */}
            <div className="hidden md:block bg-surface dark:bg-card border border-border rounded-xl sm:rounded-2xl shadow-2xs overflow-hidden">
              <div role="region" aria-label="Class roster table" className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow className="border-b border-border hover:bg-transparent">
                      {/* Select All Checkbox Column */}
                      <TableHead className="w-10 px-3">
                        <Checkbox
                          checked={allFilteredSelected}
                          indeterminate={someFilteredSelected}
                          onCheckedChange={toggleSelectAll}
                          aria-label="Select all students"
                        />
                      </TableHead>

                      {/* Name Sort Column */}
                      <TableHead
                        aria-sort={sortField === "full_name" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
                        className="p-0 font-heading"
                      >
                        <button
                          type="button"
                          onClick={() => handleSort("full_name")}
                          className="w-full h-full px-3 py-3 flex items-center gap-1.5 font-medium text-foreground hover:text-primary transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset select-none text-left cursor-pointer"
                          aria-label={`Sort by student name, currently ${sortField === "full_name" ? (sortDirection === "asc" ? "ascending" : "descending") : "unsorted"}`}
                        >
                          <span>Student Name</span>
                          {sortField === "full_name" ? (
                            sortDirection === "asc" ? (
                              <ArrowUp className="w-3.5 h-3.5 text-primary shrink-0" />
                            ) : (
                              <ArrowDown className="w-3.5 h-3.5 text-primary shrink-0" />
                            )
                          ) : (
                            <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
                          )}
                        </button>
                      </TableHead>

                      {/* Section Sort Column */}
                      <TableHead
                        aria-sort={sortField === "section" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
                        className="p-0 font-heading"
                      >
                        <button
                          type="button"
                          onClick={() => handleSort("section")}
                          className="w-full h-full px-3 py-3 flex items-center gap-1.5 font-medium text-foreground hover:text-primary transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset select-none text-left cursor-pointer"
                          aria-label={`Sort by class section, currently ${sortField === "section" ? (sortDirection === "asc" ? "ascending" : "descending") : "unsorted"}`}
                        >
                          <span>Class Section</span>
                          {sortField === "section" ? (
                            sortDirection === "asc" ? (
                              <ArrowUp className="w-3.5 h-3.5 text-primary shrink-0" />
                            ) : (
                              <ArrowDown className="w-3.5 h-3.5 text-primary shrink-0" />
                            )
                          ) : (
                            <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
                          )}
                        </button>
                      </TableHead>

                      {/* Date Enrolled Column */}
                      <TableHead
                        aria-sort={sortField === "created_at" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
                        className="p-0 font-heading"
                      >
                        <button
                          type="button"
                          onClick={() => handleSort("created_at")}
                          className="w-full h-full px-3 py-3 flex items-center gap-1.5 font-medium text-foreground hover:text-primary transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset select-none text-left cursor-pointer"
                          aria-label={`Sort by date enrolled, currently ${sortField === "created_at" ? (sortDirection === "asc" ? "ascending" : "descending") : "unsorted"}`}
                        >
                          <span>Date Enrolled</span>
                          {sortField === "created_at" ? (
                            sortDirection === "asc" ? (
                              <ArrowUp className="w-3.5 h-3.5 text-primary shrink-0" />
                            ) : (
                              <ArrowDown className="w-3.5 h-3.5 text-primary shrink-0" />
                            )
                          ) : (
                            <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
                          )}
                        </button>
                      </TableHead>

                      <TableHead className="text-right font-heading font-medium text-foreground">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStudents.map((student) => {
                      const isSelected = selectedStudentIds.has(student.id);
                      return (
                        <TableRow
                          key={student.id}
                          className={`border-b border-border/60 transition-colors group ${isSelected ? "bg-brand-50/70 dark:bg-brand-950/40" : "hover:bg-muted/30"
                            }`}
                        >
                          {/* Checkbox Column */}
                          <TableCell className="w-10 px-3 py-3">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleSelectStudent(student.id)}
                              aria-label={`Select ${student.full_name}`}
                            />
                          </TableCell>

                          {/* Name + Avatar + Parent Email */}
                          <TableCell className="text-foreground font-medium py-3">
                            <div className="flex items-center gap-3">
                              <Avatar size="sm" className={`border ${getAvatarColor(student.full_name)}`}>
                                <AvatarFallback className="text-[11px] font-semibold bg-transparent">
                                  {getInitials(student.full_name)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex flex-col min-w-0">
                                <span className="font-medium text-foreground tracking-tight truncate">{student.full_name}</span>
                                {student.parent_email ? (
                                  <span className="text-xs text-muted-foreground flex items-center gap-1 truncate font-normal">
                                    <Mail className="w-3 h-3 text-muted-foreground/70 shrink-0" />
                                    {student.parent_email}
                                  </span>
                                ) : (
                                  <span className="text-xs text-muted-foreground italic font-normal">
                                    No parent email linked
                                  </span>
                                )}
                              </div>
                            </div>
                          </TableCell>

                          {/* Section Badge */}
                          <TableCell className="text-muted-foreground py-3">
                            <Badge variant="secondary" className="font-normal text-xs bg-brand-100/80 text-brand-800 border-brand-200/70 dark:bg-brand-950 dark:text-brand-300 dark:border-brand-900">
                              {student.section}
                            </Badge>
                          </TableCell>

                          {/* Date Enrolled */}
                          <TableCell className="text-muted-foreground text-sm py-3">
                            <time dateTime={student.created_at}>
                              {new Date(student.created_at).toLocaleDateString(undefined, {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              })}
                            </time>
                          </TableCell>

                          {/* Row Actions */}
                          <TableCell className="text-right py-3">
                            <RowActions student={student} onEdit={() => handleEdit(student)} />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Mobile Card List View (< md) */}
            <div className="block md:hidden space-y-2.5">
              {/* Mobile Select All & Sort Bar */}
              <div className="flex items-center justify-between px-3 py-2 bg-surface dark:bg-card border border-border rounded-xl text-xs">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={allFilteredSelected}
                    indeterminate={someFilteredSelected}
                    onCheckedChange={toggleSelectAll}
                    aria-label="Select all students"
                  />
                  <span className="font-medium text-foreground">
                    {selectedStudentIds.size > 0
                      ? `${selectedStudentIds.size} of ${filteredStudents.length} Selected`
                      : "Select All"}
                  </span>
                </div>

                <div className="flex items-center gap-1 text-muted-foreground">
                  <button
                    type="button"
                    onClick={() => handleSort("full_name")}
                    aria-pressed={sortField === "full_name"}
                    aria-label={`Sort by student name, currently ${
                      sortField === "full_name"
                        ? sortDirection === "asc"
                          ? "ascending"
                          : "descending"
                        : "unsorted"
                    }`}
                    className={`relative px-2.5 py-1 min-h-[30px] rounded-md text-xs font-medium transition-colors cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring after:absolute after:-inset-1 after:content-[''] ${
                      sortField === "full_name"
                        ? "bg-brand-100 text-brand-800 dark:bg-brand-950 dark:text-brand-300 font-semibold shadow-2xs"
                        : "hover:bg-muted text-muted-foreground"
                    }`}
                  >
                    <span>Name</span>
                    {sortField === "full_name" && (
                      <span aria-hidden="true" className="ml-1 font-bold">
                        {sortDirection === "asc" ? "↑" : "↓"}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSort("section")}
                    aria-pressed={sortField === "section"}
                    aria-label={`Sort by class section, currently ${
                      sortField === "section"
                        ? sortDirection === "asc"
                          ? "ascending"
                          : "descending"
                        : "unsorted"
                    }`}
                    className={`relative px-2.5 py-1 min-h-[30px] rounded-md text-xs font-medium transition-colors cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring after:absolute after:-inset-1 after:content-[''] ${
                      sortField === "section"
                        ? "bg-brand-100 text-brand-800 dark:bg-brand-950 dark:text-brand-300 font-semibold shadow-2xs"
                        : "hover:bg-muted text-muted-foreground"
                    }`}
                  >
                    <span>Section</span>
                    {sortField === "section" && (
                      <span aria-hidden="true" className="ml-1 font-bold">
                        {sortDirection === "asc" ? "↑" : "↓"}
                      </span>
                    )}
                  </button>
                </div>
              </div>

              {/* Mobile Student Cards */}
              <div className="space-y-2">
                {filteredStudents.map((student) => {
                  const isSelected = selectedStudentIds.has(student.id);
                  return (
                    <div
                      key={student.id}
                      className={`p-3.5 rounded-xl border transition-all ${
                        isSelected
                          ? "bg-brand-50/80 dark:bg-brand-950/40 border-brand-300 dark:border-brand-700 shadow-2xs ring-1 ring-brand-500/30 dark:ring-brand-400/30"
                          : "bg-surface dark:bg-card border-border/80 hover:border-border shadow-2xs"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="p-2 -ml-2 -my-1.5 flex items-center justify-center">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleSelectStudent(student.id)}
                              aria-label={`Select ${student.full_name}`}
                            />
                          </div>

                          <Avatar size="sm" className={`border ${getAvatarColor(student.full_name)} shrink-0`}>
                            <AvatarFallback className="text-[11px] font-semibold bg-transparent">
                              {getInitials(student.full_name)}
                            </AvatarFallback>
                          </Avatar>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-foreground tracking-tight text-sm truncate">
                                {student.full_name}
                              </span>
                              <Badge
                                variant="secondary"
                                className="font-normal text-[11px] px-2 py-0.2 bg-brand-100/80 text-brand-800 border-brand-200/70 dark:bg-brand-950 dark:text-brand-300 dark:border-brand-900 shrink-0"
                              >
                                {student.section}
                              </Badge>
                            </div>

                            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                              {student.parent_email ? (
                                <span className="flex items-center gap-1 truncate font-normal">
                                  <Mail className="w-3 h-3 text-muted-foreground/70 shrink-0" />
                                  {student.parent_email}
                                </span>
                              ) : (
                                <span className="italic font-normal text-[11px]">No parent email linked</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="shrink-0 -mr-1">
                          <RowActions student={student} onEdit={() => handleEdit(student)} />
                        </div>
                      </div>

                      <div className="mt-2.5 pt-2 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>Enrolled</span>
                        <time dateTime={student.created_at} className="font-medium text-foreground/80">
                          {new Date(student.created_at).toLocaleDateString(undefined, {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </time>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Visually hidden persistent live region for selection announcements */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {selectedStudentIds.size > 0
          ? `${selectedStudentIds.size} of ${filteredStudents.length} students selected.`
          : ""}
      </div>

      {/* Floating Batch Actions Bar */}
      <FloatingBatchBar
        selectedCount={selectedStudentIds.size}
        totalCount={filteredStudents.length}
        allSelected={allFilteredSelected}
        onSelectAll={toggleSelectAll}
        onClearSelection={clearSelection}
        onMoveSection={() => setIsBatchMoveOpen(true)}
        onExportCSV={handleExportSelected}
        onRemove={() => setIsBatchRemoveOpen(true)}
        isRemoving={isBatchRemoving}
      />

      {/* Modals */}
      <StudentDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        student={studentToEdit}
        defaultSection={selectedSection !== "all" ? selectedSection : undefined}
      />

      <BulkStudentDialog
        open={isBulkDialogOpen}
        onOpenChange={setIsBulkDialogOpen}
        defaultSection={selectedSection !== "all" ? selectedSection : undefined}
      />

      <BatchMoveDialog
        open={isBatchMoveOpen}
        onOpenChange={setIsBatchMoveOpen}
        selectedStudents={selectedStudentsList}
        allStudents={students || []}
        onComplete={clearSelection}
      />

      {/* Batch Remove Confirmation Dialog */}
      <AlertDialog open={isBatchRemoveOpen} onOpenChange={setIsBatchRemoveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Remove {selectedStudentsList.length} {selectedStudentsList.length === 1 ? "Student" : "Students"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will unenroll the {selectedStudentsList.length} selected {selectedStudentsList.length === 1 ? "student" : "students"} from your roster. Their historical assessment data will not be deleted, but they will no longer appear in your active class list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBatchRemoving}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBatchRemoveConfirm}
              disabled={isBatchRemoving}
              variant="destructive"
              className="gap-2"
            >
              {isBatchRemoving ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  <span>Removing...</span>
                </>
              ) : (
                `Remove ${selectedStudentsList.length} ${selectedStudentsList.length === 1 ? "Student" : "Students"}`
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function RowActions({ student, onEdit }: { student: Student; onEdit: () => void }) {
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const { mutate: removeStudent, isPending } = useRemoveStudent();

  const handleRemove = () => {
    removeStudent(student.id, {
      onSuccess: () => {
        toast.success(`Removed ${student.full_name} from roster.`);
        setIsAlertOpen(false);
      },
      onError: (err: Error) => {
        toast.error(err.message || "Failed to remove student");
      }
    });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              className="relative h-9 w-9 sm:h-8 sm:w-8 text-muted-foreground hover:text-foreground after:absolute after:-inset-2 after:content-['']"
              aria-label={`Actions for ${student.full_name}`}
            />
          }
        >
          <span className="sr-only">Actions for {student.full_name}</span>
          <MoreHorizontal className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="rounded-xl min-w-36 p-1 shadow-lg">
          <DropdownMenuItem onClick={onEdit} className="cursor-pointer py-2 px-2.5 text-sm">
            <Edit2 className="w-4 h-4 mr-2 text-muted-foreground" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setIsAlertOpen(true)}
            className="cursor-pointer py-2 px-2.5 text-sm text-destructive focus:text-destructive"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Remove
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Student?</AlertDialogTitle>
            <AlertDialogDescription>
              This will unenroll <strong className="font-semibold text-foreground">{student.full_name}</strong> from your roster. Their historical data will not be deleted, but they will no longer appear in your active class list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending} onClick={() => setIsAlertOpen(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemove}
              disabled={isPending}
              variant="destructive"
              className="gap-2"
            >
              {isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  <span>Removing...</span>
                </>
              ) : (
                "Remove"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
