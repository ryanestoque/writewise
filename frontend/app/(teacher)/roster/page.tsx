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
  ArrowRightLeft,
} from "lucide-react";
import { StudentDialog } from "@/components/roster/student-dialog";
import { BulkStudentDialog } from "@/components/roster/bulk-student-dialog";
import { BatchMoveDialog } from "@/components/roster/batch-move-dialog";
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
  AlertDialogTrigger,
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
    setCanScrollLeft(hasOverflow && el.scrollLeft > 2);
    setCanScrollRight(hasOverflow && el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
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
    const sectionTag = selectedSection !== "all" ? `-${selectedSection.replace(/\s+/g, "_")}` : "";
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
    <div className="max-w-6xl mx-auto space-y-6 pb-16">
      {/* Header section with title and actions */}
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-heading font-semibold text-foreground tracking-tight">Class Roster</h1>
            {students && students.length > 0 && (
              <Badge variant="outline" className="text-xs font-semibold px-2.5 py-0.5 bg-brand-50 text-brand-700 border-brand-200/80">
                {students.length} {students.length === 1 ? "Student" : "Students"}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Manage student enrollment and class sections for handwriting assessment activities.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start md:self-auto flex-wrap">
          {students && students.length > 0 && (
            <Button 
              onClick={handleExportRoster}
              variant="outline"
              className="border-border text-foreground hover:bg-muted font-medium shadow-2xs"
            >
              <Download className="w-4 h-4 mr-2 text-muted-foreground" />
              Export CSV
            </Button>
          )}

          <Button 
            onClick={handleOpenBulk}
            variant="outline"
            className="border-border text-foreground hover:bg-muted font-medium shadow-2xs"
          >
            <UserPlus className="w-4 h-4 mr-2 text-muted-foreground" />
            Bulk Add
          </Button>

          <Button 
            onClick={handleOpenNew} 
            className="bg-primary hover:bg-brand-700 text-primary-foreground font-medium shadow-xs"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Student
          </Button>
        </div>
      </div>

      {/* Main Roster Container */}
      <div className="space-y-4">
        {/* Search and Section Filters Bar */}
        {students && students.length > 0 && (
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-surface p-3 rounded-xl border border-border shadow-2xs">
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
                className="pl-9 pr-8 h-9 text-sm rounded-lg"
                aria-keyshortcuts="/"
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    searchInputRef.current?.focus();
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded-full transition-colors"
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
                  className="pointer-events-none absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-surface to-transparent z-10"
                />
              )}

              <div
                ref={sectionScrollRef}
                onScroll={updateScrollState}
                role="group"
                aria-label="Filter by class section"
                className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 scrollbar-none w-full"
              >
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mr-1 shrink-0">
                  Section:
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedSection("all")}
                  aria-pressed={selectedSection === "all"}
                  className={`relative inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all shrink-0 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring after:absolute after:-inset-2 after:content-[''] ${
                    selectedSection === "all"
                      ? "bg-brand-700 dark:bg-primary text-white dark:text-primary-foreground border-brand-700 dark:border-primary shadow-2xs"
                      : "bg-background text-muted-foreground border-border hover:bg-muted/60 hover:text-foreground"
                  }`}
                >
                  All
                  <span
                    className={`text-[10px] font-medium px-1.5 py-0.2 rounded-full ${
                      selectedSection === "all" ? "bg-white/20 dark:bg-primary-foreground/20 text-white dark:text-primary-foreground" : "bg-muted text-foreground"
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
                      className={`relative inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all shrink-0 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring after:absolute after:-inset-2 after:content-[''] ${
                        isSelected
                          ? "bg-brand-700 dark:bg-primary text-white dark:text-primary-foreground border-brand-700 dark:border-primary shadow-2xs"
                          : "bg-background text-muted-foreground border-border hover:bg-muted/60 hover:text-foreground"
                      }`}
                    >
                      {sec}
                      <span
                        className={`text-[10px] font-medium px-1.5 py-0.2 rounded-full ${
                          isSelected ? "bg-white/20 dark:bg-primary-foreground/20 text-white dark:text-primary-foreground" : "bg-muted text-foreground"
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
                  className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-surface to-transparent z-10"
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
              className="text-primary hover:underline font-medium"
            >
              Clear filters
            </button>
          </div>
        )}

        {/* Table Card */}
        <div className="bg-surface border border-border rounded-xl shadow-2xs overflow-hidden">
          <div
            role="region"
            aria-label="Class roster table"
          >
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
                      className="w-full h-full px-3 py-3 flex items-center gap-1.5 font-medium text-foreground hover:text-primary transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset select-none text-left"
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
                      className="w-full h-full px-3 py-3 flex items-center gap-1.5 font-medium text-foreground hover:text-primary transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset select-none text-left"
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
                      className="w-full h-full px-3 py-3 flex items-center gap-1.5 font-medium text-foreground hover:text-primary transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset select-none text-left"
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
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-44 text-center">
                      <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                        <span className="text-sm">Loading class roster...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : students?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="p-0">
                      <Empty className="py-14 border-0">
                        <EmptyMedia variant="icon" className="bg-brand-100 text-brand-700">
                          <Users className="w-6 h-6" />
                        </EmptyMedia>
                        <EmptyHeader>
                          <EmptyTitle>No students yet</EmptyTitle>
                          <EmptyDescription>
                            Add your first student or bulk-paste an entire class list to start creating handwriting activities.
                          </EmptyDescription>
                        </EmptyHeader>
                        <EmptyContent className="flex flex-row items-center justify-center gap-3">
                          <Button 
                            onClick={handleOpenBulk} 
                            variant="outline"
                            size="sm"
                            className="font-medium"
                          >
                            <UserPlus className="w-4 h-4 mr-2" />
                            Bulk Add
                          </Button>
                          <Button 
                            onClick={handleOpenNew} 
                            size="sm" 
                            className="bg-primary hover:bg-brand-700 text-primary-foreground font-medium"
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            Add Student
                          </Button>
                        </EmptyContent>
                      </Empty>
                    </TableCell>
                  </TableRow>
                ) : filteredStudents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="p-0">
                      <Empty className="py-12 border-0">
                        <EmptyMedia variant="icon" className="bg-muted text-muted-foreground">
                          <SearchX className="w-6 h-6" />
                        </EmptyMedia>
                        <EmptyHeader>
                          <EmptyTitle>No matching students</EmptyTitle>
                          <EmptyDescription>
                            We couldn&apos;t find any students matching &ldquo;{searchQuery}&rdquo;
                            {selectedSection !== "all" ? ` in ${selectedSection}` : ""}.
                          </EmptyDescription>
                        </EmptyHeader>
                        <EmptyContent>
                          <Button onClick={handleResetFilters} variant="outline" size="sm">
                            Clear filters
                          </Button>
                        </EmptyContent>
                      </Empty>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredStudents.map((student) => {
                    const isSelected = selectedStudentIds.has(student.id);
                    return (
                      <TableRow 
                        key={student.id} 
                        className={`border-b border-border/60 transition-colors group ${
                          isSelected ? "bg-brand-50/70 dark:bg-brand-950/40" : "hover:bg-muted/30"
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
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {/* Floating Batch Actions Bar */}
      {selectedStudentIds.size > 0 && (
        <div 
          role="region" 
          aria-label="Batch student actions" 
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] max-w-xl animate-in fade-in slide-in-from-bottom-4 motion-reduce:animate-none motion-reduce:transition-none duration-200"
        >
          <span className="sr-only" aria-live="polite">
            {selectedStudentIds.size} {selectedStudentIds.size === 1 ? "student" : "students"} selected. Batch action toolbar is available.
          </span>
          <div className="bg-surface/95 backdrop-blur-md border border-border shadow-warm rounded-2xl p-2 sm:px-4 sm:py-2.5 flex items-center justify-between gap-2 sm:gap-3 text-foreground">
            <div className="flex items-center gap-2 shrink-0">
              <Badge className="bg-brand-700 dark:bg-primary text-white dark:text-primary-foreground font-semibold text-xs px-2 sm:px-2.5 py-0.5 shadow-2xs shrink-0">
                {selectedStudentIds.size} Selected
              </Badge>
              <span className="text-xs text-muted-foreground hidden sm:inline">
                of {students?.length || 0}
              </span>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsBatchMoveOpen(true)}
                className="h-8 px-2 sm:px-3 text-xs font-medium border-border hover:bg-muted shrink-0"
              >
                <ArrowRightLeft className="w-3.5 h-3.5 sm:mr-1.5 text-muted-foreground shrink-0" />
                <span className="hidden sm:inline">Move Section</span>
                <span className="sm:hidden">Move</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleExportSelected}
                className="h-8 px-2 sm:px-3 text-xs font-medium border-border hover:bg-muted shrink-0"
              >
                <Download className="w-3.5 h-3.5 sm:mr-1.5 text-muted-foreground shrink-0" />
                <span>Export</span>
              </Button>

              <Button
                variant="destructive"
                size="sm"
                onClick={() => setIsBatchRemoveOpen(true)}
                className="h-8 px-2 sm:px-3 text-xs font-medium bg-destructive/10 text-destructive hover:bg-destructive hover:text-white border border-destructive/30 shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5 sm:mr-1.5 shrink-0" />
                <span>Remove</span>
              </Button>

              <button
                type="button"
                onClick={clearSelection}
                className="relative text-muted-foreground hover:text-foreground p-1 rounded-full hover:bg-muted transition-colors ml-0.5 after:absolute after:-inset-2 after:content-[''] shrink-0"
                aria-label="Clear selection"
                title="Clear selection (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

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
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-heading">
              Remove {selectedStudentsList.length} Students?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will unenroll the {selectedStudentsList.length} selected students from your roster. Their historical assessment data will not be deleted, but they will no longer appear in your active class list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg" disabled={isBatchRemoving}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleBatchRemoveConfirm} 
              disabled={isBatchRemoving}
              variant="destructive"
              className="rounded-lg bg-destructive hover:bg-destructive/90 text-white"
            >
              {isBatchRemoving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Remove {selectedStudentsList.length} Students
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function RowActions({ student, onEdit }: { student: Student; onEdit: () => void }) {
  const { mutate: removeStudent, isPending } = useRemoveStudent();

  const handleRemove = () => {
    removeStudent(student.id, {
      onSuccess: () => {
        toast.success(`Removed ${student.full_name} from roster.`);
      },
      onError: (err: Error) => {
        toast.error(err.message || "Failed to remove student");
      }
    });
  };

  return (
    <AlertDialog>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              className="relative h-8 w-8 text-muted-foreground hover:text-foreground after:absolute after:-inset-1.5 after:content-['']"
              aria-label={`Actions for ${student.full_name}`}
            />
          }
        >
          <span className="sr-only">Actions for {student.full_name}</span>
          <MoreHorizontal className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="rounded-xl min-w-36">
          <DropdownMenuItem onClick={onEdit} className="cursor-pointer">
            <Edit2 className="w-4 h-4 mr-2 text-muted-foreground" />
            Edit
          </DropdownMenuItem>
          <AlertDialogTrigger
            nativeButton={false}
            render={
              <DropdownMenuItem variant="destructive" className="cursor-pointer text-destructive focus:text-destructive">
                <Trash2 className="w-4 h-4 mr-2" />
                Remove
              </DropdownMenuItem>
            }
          />
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialogContent className="rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-heading">Remove Student?</AlertDialogTitle>
          <AlertDialogDescription>
            This will unenroll <strong className="text-foreground">{student.full_name}</strong> from your roster. Their historical data will not be deleted, but they will no longer appear in your active class list.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-lg">Cancel</AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleRemove} 
            disabled={isPending}
            variant="destructive"
            className="rounded-lg bg-destructive hover:bg-destructive/90 text-white"
          >
            {isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Remove
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
