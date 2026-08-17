"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useStudents, useRemoveStudent, Student } from "@/lib/hooks/use-students";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
} from "lucide-react";
import { StudentDialog } from "@/components/roster/student-dialog";
import { BulkStudentDialog } from "@/components/roster/bulk-student-dialog";
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

  // Keyboard shortcut: Press "/" or "Cmd/Ctrl+K" to focus search input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable ||
          target.getAttribute("role") === "combobox");

      if (isDialogOpen || isBulkDialogOpen) return;

      if ((e.key === "/" || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k")) && !isTyping) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDialogOpen, isBulkDialogOpen]);

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
    <div className="max-w-6xl mx-auto space-y-6">
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

        <div className="flex items-center gap-2.5 self-start md:self-auto">
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
                  <Kbd className="text-[10px] h-5 px-1 bg-muted/60 text-muted-foreground/80 border border-border/50">/</Kbd>
                </div>
              )}
            </div>

            {/* Section Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mr-1 shrink-0">
                Section:
              </span>
              <button
                type="button"
                onClick={() => setSelectedSection("all")}
                className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-lg border transition-all shrink-0 ${
                  selectedSection === "all"
                    ? "bg-brand-700 text-white border-brand-700 shadow-2xs"
                    : "bg-background text-muted-foreground border-border hover:bg-muted/60 hover:text-foreground"
                }`}
              >
                All
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  selectedSection === "all" ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
                }`}>
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
                    className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-lg border transition-all shrink-0 ${
                      isSelected
                        ? "bg-brand-700 text-white border-brand-700 shadow-2xs"
                        : "bg-background text-muted-foreground border-border hover:bg-muted/60 hover:text-foreground"
                    }`}
                  >
                    {sec}
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      isSelected ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
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
        <div className="bg-surface border border-border rounded-sm shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow className="border-b border-border hover:bg-transparent">
                  {/* Name Sort Column */}
                  <TableHead 
                    className="font-heading font-medium text-foreground cursor-pointer select-none"
                    onClick={() => handleSort("full_name")}
                    aria-sort={sortField === "full_name" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Student Name</span>
                      {sortField === "full_name" ? (
                        sortDirection === "asc" ? (
                          <ArrowUp className="w-3.5 h-3.5 text-primary" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-primary" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground/60" />
                      )}
                    </div>
                  </TableHead>

                  {/* Section Sort Column */}
                  <TableHead 
                    className="font-heading font-medium text-foreground cursor-pointer select-none"
                    onClick={() => handleSort("section")}
                    aria-sort={sortField === "section" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Class Section</span>
                      {sortField === "section" ? (
                        sortDirection === "asc" ? (
                          <ArrowUp className="w-3.5 h-3.5 text-primary" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-primary" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground/60" />
                      )}
                    </div>
                  </TableHead>

                  {/* Date Enrolled Column */}
                  <TableHead 
                    className="font-heading font-medium text-foreground cursor-pointer select-none"
                    onClick={() => handleSort("created_at")}
                    aria-sort={sortField === "created_at" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Date Enrolled</span>
                      {sortField === "created_at" ? (
                        sortDirection === "asc" ? (
                          <ArrowUp className="w-3.5 h-3.5 text-primary" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-primary" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground/60" />
                      )}
                    </div>
                  </TableHead>

                  <TableHead className="text-right font-heading font-medium text-foreground">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-44 text-center">
                      <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                        <span className="text-sm">Loading class roster...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : students?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="p-0">
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
                    <TableCell colSpan={4} className="p-0">
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
                  filteredStudents.map((student) => (
                    <TableRow 
                      key={student.id} 
                      className="border-b border-border/60 hover:bg-muted/30 transition-colors group"
                    >
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
                              <span className="text-[11px] text-muted-foreground/60 italic font-normal">
                                No parent email linked
                              </span>
                            )}
                          </div>
                        </div>
                      </TableCell>

                      {/* Section Badge */}
                      <TableCell className="text-muted-foreground py-3">
                        <Badge variant="secondary" className="font-normal text-xs bg-brand-100/70 text-brand-700 border border-brand-200/50">
                          {student.section}
                        </Badge>
                      </TableCell>

                      {/* Date Enrolled */}
                      <TableCell className="text-muted-foreground text-sm py-3">
                        {new Date(student.created_at).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </TableCell>

                      {/* Row Actions */}
                      <TableCell className="text-right py-3">
                        <RowActions student={student} onEdit={() => handleEdit(student)} />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

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
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
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
