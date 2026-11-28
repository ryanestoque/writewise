"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useStudents, useRemoveStudent, useResendParentInvite, Student } from "@/lib/hooks/use-students";
import { runConcurrentPool } from "@/lib/utils/concurrent-pool";
import { handleApiResponse } from "@/lib/utils/api-error";
import { isBlockingOverlayOpen } from "@/lib/utils/keyboard";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { SearchInput } from "@/components/shared/search-input";
import { FilterPills, type FilterPillItem } from "@/components/shared/filter-pills";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { cn } from "@/lib/utils";
import {
  MoreHorizontal,
  Plus,
  Trash2,
  Edit2,
  Users,
  AlertCircle,
  RotateCcw,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  UserPlus,
  SearchX,
  Send,
  Download,
  FolderKanban } from "lucide-react";
import { StudentDialog } from "@/components/roster/student-dialog";
import { BulkStudentDialog } from "@/components/roster/bulk-student-dialog";
import { BatchMoveDialog } from "@/components/roster/batch-move-dialog";
import { ManageSectionsDialog } from "@/components/roster/manage-sections-dialog";
import { FloatingBatchBar } from "@/components/roster/floating-batch-bar";
import { exportStudentsToCSV } from "@/lib/utils/csv-export";
import { createClient } from "@/lib/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "@/components/ui/toast";

type SortField = "full_name" | "section" | "created_at";
type SortDirection = "asc" | "desc";



export default function RosterPage() {
  const queryClient = useQueryClient();
  const { data: students, isLoading, error, refetch } = useStudents();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false);
  const [isManageSectionsOpen, setIsManageSectionsOpen] = useState(false);
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

  // Resend Parent Invite state & mutation
  const { mutate: resendInvite } = useResendParentInvite();
  const [resendingStudentId, setResendingStudentId] = useState<string | null>(null);

  const handleResendInvite = (student: Student) => {
    if (!student.parent_email) return;
    setResendingStudentId(student.id);
    resendInvite(student.id, {
      onSuccess: () => {
        toast.add({ type: "success", title: `Invitation resent to ${student.parent_email}.` });
        setResendingStudentId(null);
      },
      onError: (err: unknown) => {
        let message = err instanceof Error ? err.message : "Failed to resend invitation.";
        if (message.toLowerCase().includes("rate limit")) {
          message = "Email rate limit reached. Please wait a few minutes before resending.";
        }
        toast.add({ type: "error", title: message });
        setResendingStudentId(null);
      } });
  };


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

      if (isDialogOpen || isBulkDialogOpen || isBatchMoveOpen || isBatchRemoveOpen || isBlockingOverlayOpen()) return;

      if (e.key === "Escape" && selectedStudentIds.size > 0 && !isTyping) {
        e.preventDefault();
        setSelectedStudentIds(new Set());
        return;
      }

      if (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey && !isTyping) {
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
      sectionCounts: counts };
  }, [students]);

  const sectionFilterItems = useMemo<FilterPillItem[]>(() => {
    const allItem: FilterPillItem = {
      id: "all",
      label: "All",
      count: students?.length ?? 0 };
    const dynamicItems: FilterPillItem[] = sections.map((sec) => ({
      id: sec,
      label: sec,
      count: sectionCounts.get(sec) || 0 }));
    return [allItem, ...dynamicItems];
  }, [students, sections, sectionCounts]);


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
      toast.add({ type: "error", title: "No students to export." });
      return;
    }
    const targetList = hasActiveFilters ? filteredStudents : students;
    const sectionTag = selectedSection !== "all" ? `-${selectedSection.replace(/[^a-zA-Z0-9_-]/g, "_")}` : "";
    const filename = `writewise-roster${sectionTag}-${new Date().toISOString().split("T")[0]}`;
    exportStudentsToCSV(targetList, filename);
    toast.add({
      type: "success",
      title: `Exported ${targetList.length} ${targetList.length === 1 ? "student" : "students"} to CSV.`,
    });
  };

  const handleExportSelected = () => {
    if (selectedStudentsList.length === 0) return;
    const filename = `writewise-selected-students-${new Date().toISOString().split("T")[0]}`;
    exportStudentsToCSV(selectedStudentsList, filename);
    toast.add({
      type: "success",
      title: `Exported ${selectedStudentsList.length} selected ${selectedStudentsList.length === 1 ? "student" : "students"} to CSV.`,
    });
  };

  const handleBatchRemoveConfirm = async () => {
    if (selectedStudentsList.length === 0) return;
    setIsBatchRemoving(true);

    const supabase = createClient();
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    if (!token) {
      toast.add({ type: "error", title: "Authentication session expired. Please log in again." });
      setIsBatchRemoving(false);
      return;
    }

    const { successCount, failedItems } = await runConcurrentPool(
      Array.from(selectedStudentIds),
      async (id) => {
        const res = await fetch(`/api/students/${id}/teacher-link`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` } });
        try {
          await handleApiResponse(res);
          return true;
        } catch {
          return false;
        }
      },
      { concurrency: 4 }
    );

    await queryClient.invalidateQueries({ queryKey: ["students"] });
    setIsBatchRemoving(false);
    setIsBatchRemoveOpen(false);
    clearSelection();

    if (failedItems.length === 0) {
      toast.add({
        type: "success",
        title: `Removed ${successCount} ${successCount === 1 ? "student" : "students"} from roster.`,
      });
    } else {
      toast.add({
        type: "warning",
        title: `Removed ${successCount} students. ${failedItems.length} could not be removed.`,
      });
    }
  };

  if (error) {
    return (
      <div className="w-full">
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertTitle>Failed to load roster</AlertTitle>
          <AlertDescription className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between [&>p]:mb-0">
            <p>{error.message}</p>
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
    <div className="w-full min-w-0 flex flex-col gap-5 sm:gap-6 pb-20 sm:pb-16">
      {/* Header section with title and actions */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-heading font-semibold text-foreground tracking-tight">
            Class Roster
          </h1>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap sm:flex-nowrap">
          {students && students.length > 0 && (
            <Button
              onClick={handleExportRoster}
              variant="outline"
              className="h-10 sm:h-9 min-h-[44px] sm:min-h-[36px] flex-1 sm:flex-none text-xs sm:text-sm font-medium shadow-xs rounded-lg sm:rounded-xl"
            >
              <Download data-icon="inline-start" className="text-muted-foreground" aria-hidden="true" />
              Export CSV
            </Button>
          )}

          <Button
            onClick={() => setIsManageSectionsOpen(true)}
            variant="outline"
            className="h-10 sm:h-9 min-h-[44px] sm:min-h-[36px] flex-1 sm:flex-none text-xs sm:text-sm font-medium shadow-xs rounded-lg sm:rounded-xl"
          >
            <FolderKanban data-icon="inline-start" className="text-muted-foreground" aria-hidden="true" />
            Manage Sections
          </Button>

          <Button
            onClick={handleOpenBulk}
            variant="outline"
            className="h-10 sm:h-9 min-h-[44px] sm:min-h-[36px] flex-1 sm:flex-none text-xs sm:text-sm font-medium shadow-xs rounded-lg sm:rounded-xl"
          >
            <UserPlus data-icon="inline-start" className="text-muted-foreground" aria-hidden="true" />
            Bulk Add
          </Button>

          <Button
            onClick={handleOpenNew}
            className="h-10 sm:h-9 min-h-[44px] sm:min-h-[36px] w-full sm:w-auto text-xs sm:text-sm font-medium shadow-xs rounded-lg sm:rounded-xl"
          >
            <Plus data-icon="inline-start" aria-hidden="true" />
            Add Student
          </Button>
        </div>
      </div>

      {/* Main Roster Container */}
      <div className="flex flex-col gap-4">
        {/* Search and Section Filters Bar */}
        {students && students.length > 0 && (
          <Card size="sm" className="py-3 shadow-warm">
            <CardContent className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 px-3">
              {/* Search Input */}
              <SearchInput
                ref={searchInputRef}
                placeholder="Search student or section..."
                aria-label="Search students by name, section, or parent email"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onClear={() => setSearchQuery("")}
                containerClassName="w-full lg:w-72 shrink-0"
              />

              {/* Section Filter Pills */}
              <FilterPills
                items={sectionFilterItems}
                value={selectedSection}
                onChange={setSelectedSection}
                label="Section:"
                ariaLabel="Filter by class section"
                className="lg:w-auto lg:max-w-full"
                containerClassName="min-w-0 flex-1 lg:justify-end"
              />
            </CardContent>
          </Card>
        )}

        {/* Filter results status indicator if active */}
        {hasActiveFilters && students && students.length > 0 && (
          <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
            <span>
              Showing <strong className="text-foreground">{filteredStudents.length}</strong> of {students.length} students
              {selectedSection !== "all" && <span> in <strong className="text-foreground">{selectedSection}</strong></span>}
              {searchQuery && <span> matching &ldquo;<strong className="text-foreground">{searchQuery}</strong>&rdquo;</span>}
            </span>
            <Button
              type="button"
              variant="link"
              size="xs"
              onClick={handleResetFilters}
              className="relative h-auto px-1 py-0.5 font-medium cursor-pointer after:absolute after:-inset-2 sm:after:hidden"
            >
              Clear filters
            </Button>
          </div>
        )}

        {/* Loading state */}
        {isLoading ? (
          <Card className="py-0">
            <CardContent className="p-12 flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <Spinner className="size-6 text-primary" />
              <span className="text-sm font-medium">Loading class roster...</span>
            </CardContent>
          </Card>
        ) : students?.length === 0 ? (
          /* Empty Roster State */
          <Card className="py-0 overflow-hidden">
            <CardContent className="px-0">
              <Empty className="py-14 border-0">
                <EmptyMedia variant="icon" className="bg-secondary text-secondary-foreground">
                  <Users aria-hidden="true" />
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
                    <UserPlus data-icon="inline-start" aria-hidden="true" />
                    Bulk Add
                  </Button>
                  <Button
                    onClick={handleOpenNew}
                    className="h-10 sm:h-9 w-full sm:w-auto font-medium text-xs sm:text-sm rounded-lg sm:rounded-xl"
                  >
                    <Plus data-icon="inline-start" aria-hidden="true" />
                    Add Student
                  </Button>
                </EmptyContent>
              </Empty>
            </CardContent>
          </Card>
        ) : filteredStudents.length === 0 ? (
          /* Filter Empty State */
          <Card className="py-0 overflow-hidden">
            <CardContent className="px-0">
              <Empty className="py-12 border-0">
                <EmptyMedia variant="icon" className="bg-muted text-muted-foreground">
                  <SearchX aria-hidden="true" />
                </EmptyMedia>
                <EmptyHeader>
                  <EmptyTitle className="text-lg sm:text-xl">No matching students</EmptyTitle>
                  <EmptyDescription className="text-xs sm:text-sm">
                    We couldn&apos;t find any students matching &ldquo;{searchQuery}&rdquo;
                    {selectedSection !== "all" ? ` in ${selectedSection}` : ""}.
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button onClick={handleResetFilters} variant="outline" size="sm" className="min-h-10 sm:min-h-9 rounded-lg sm:rounded-xl">
                    Clear filters
                  </Button>
                </EmptyContent>
              </Empty>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Desktop & Tablet Table View (md and up) */}
            <Card className="hidden md:block py-0 overflow-hidden">
              <CardContent className="p-0">
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
                        className="p-0"
                      >
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => handleSort("full_name")}
                          className="w-full h-full px-3 py-3 justify-start gap-1.5 rounded-none font-medium text-foreground hover:text-primary hover:bg-transparent focus-visible:ring-inset select-none cursor-pointer"
                          aria-label={`Sort by student name, currently ${sortField === "full_name" ? (sortDirection === "asc" ? "ascending" : "descending") : "unsorted"}`}
                        >
                          <span>Student Name</span>
                          {sortField === "full_name" ? (
                            sortDirection === "asc" ? (
                              <ArrowUp data-icon="inline-end" className="text-primary" aria-hidden="true" />
                            ) : (
                              <ArrowDown data-icon="inline-end" className="text-primary" aria-hidden="true" />
                            )
                          ) : (
                            <ArrowUpDown data-icon="inline-end" className="text-muted-foreground/60" aria-hidden="true" />
                          )}
                        </Button>
                      </TableHead>

                      {/* Section Sort Column */}
                      <TableHead
                        aria-sort={sortField === "section" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
                        className="p-0"
                      >
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => handleSort("section")}
                          className="w-full h-full px-3 py-3 justify-start gap-1.5 rounded-none font-medium text-foreground hover:text-primary hover:bg-transparent focus-visible:ring-inset select-none cursor-pointer"
                          aria-label={`Sort by class section, currently ${sortField === "section" ? (sortDirection === "asc" ? "ascending" : "descending") : "unsorted"}`}
                        >
                          <span>Class Section</span>
                          {sortField === "section" ? (
                            sortDirection === "asc" ? (
                              <ArrowUp data-icon="inline-end" className="text-primary" aria-hidden="true" />
                            ) : (
                              <ArrowDown data-icon="inline-end" className="text-primary" aria-hidden="true" />
                            )
                          ) : (
                            <ArrowUpDown data-icon="inline-end" className="text-muted-foreground/60" aria-hidden="true" />
                          )}
                        </Button>
                      </TableHead>

                      {/* Date Enrolled Column */}
                      <TableHead
                        aria-sort={sortField === "created_at" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
                        className="p-0"
                      >
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => handleSort("created_at")}
                          className="w-full h-full px-3 py-3 justify-start gap-1.5 rounded-none font-medium text-foreground hover:text-primary hover:bg-transparent focus-visible:ring-inset select-none cursor-pointer"
                          aria-label={`Sort by date enrolled, currently ${sortField === "created_at" ? (sortDirection === "asc" ? "ascending" : "descending") : "unsorted"}`}
                        >
                          <span>Date Enrolled</span>
                          {sortField === "created_at" ? (
                            sortDirection === "asc" ? (
                              <ArrowUp data-icon="inline-end" className="text-primary" aria-hidden="true" />
                            ) : (
                              <ArrowDown data-icon="inline-end" className="text-primary" aria-hidden="true" />
                            )
                          ) : (
                            <ArrowUpDown data-icon="inline-end" className="text-muted-foreground/60" aria-hidden="true" />
                          )}
                        </Button>
                      </TableHead>

                      <TableHead className="text-right font-medium text-foreground">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStudents.map((student) => {
                      const isSelected = selectedStudentIds.has(student.id);
                      return (
                        <TableRow
                          key={student.id}
                          className={cn(
                            "border-b border-border/60 transition-colors group",
                            isSelected ? "bg-primary/5" : "hover:bg-muted/30"
                          )}
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
                            <div className="flex flex-col min-w-0">
                                <span className="font-medium text-foreground tracking-tight truncate">{student.full_name}</span>
                                {student.parent_email ? (
                                  <div className="flex min-h-5 items-center gap-1.5 flex-wrap mt-0.5">
                                    <span className="text-xs text-muted-foreground truncate font-normal">
                                      {student.parent_email}
                                    </span>
                                    {student.parent_status === "active" ? (
                                      <Badge variant="outline" className="text-xs px-1.5 py-0 font-medium bg-band-4/15 text-band-4-text border-band-4/30">
                                        Active
                                      </Badge>
                                    ) : (
                                      <div className="inline-flex items-center gap-1">
                                        <Badge variant="outline" className="text-xs px-1.5 py-0 font-medium bg-band-2/15 text-band-2-text border-band-2/30">
                                          Pending
                                        </Badge>
                                        <Button
                                          type="button"
                                          variant="link"
                                          size="xs"
                                          onClick={() => handleResendInvite(student)}
                                          disabled={resendingStudentId === student.id}
                                          title="Resend invitation email"
                                          className="relative h-auto p-0 gap-1 text-xs font-medium cursor-pointer after:absolute after:-inset-2 sm:after:hidden"
                                        >
                                          {resendingStudentId === student.id ? (
                                            <Spinner data-icon="inline-start" />
                                          ) : (
                                            <Send data-icon="inline-start" aria-hidden="true" />
                                          )}
                                          <span>Resend</span>
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div className="flex min-h-5 items-center mt-0.5">
                                    <span className="text-xs text-muted-foreground italic font-normal">
                                      No parent email linked
                                    </span>
                                  </div>
                                )}
                              </div>
                          </TableCell>

                          {/* Section Badge */}
                          <TableCell className="text-muted-foreground py-3">
                            <Badge variant="secondary" className="font-semibold text-xs">
                              {student.section}
                            </Badge>
                          </TableCell>

                          {/* Date Enrolled */}
                          <TableCell className="text-muted-foreground text-sm py-3">
                            <time dateTime={student.created_at}>
                              {new Date(student.created_at).toLocaleDateString(undefined, {
                                year: "numeric",
                                month: "short",
                                day: "numeric" })}
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
              </CardContent>
            </Card>

            {/* Mobile Card List View (< md) */}
            <div className="flex flex-col gap-2.5 md:hidden">
              {/* Mobile Select All & Sort Bar */}
              <Card size="sm" className="py-2 rounded-xl">
                <CardContent className="flex items-center justify-between gap-2 px-3 text-xs">
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

                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <ToggleGroup
                      multiple={false}
                      value={[sortField]}
                      onValueChange={(vals) => {
                        if (vals.length > 0) handleSort(vals[0] as SortField);
                      }}
                      variant="outline"
                      size="sm"
                      spacing={0}
                      aria-label="Sort students by"
                    >
                      <ToggleGroupItem
                        value="full_name"
                        className="min-h-11 px-3 text-xs data-pressed:bg-secondary data-pressed:text-secondary-foreground data-pressed:font-semibold"
                      >
                        Name
                      </ToggleGroupItem>
                      <ToggleGroupItem
                        value="section"
                        className="min-h-11 px-3 text-xs data-pressed:bg-secondary data-pressed:text-secondary-foreground data-pressed:font-semibold"
                      >
                        Section
                      </ToggleGroupItem>
                    </ToggleGroup>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="size-11"
                      onClick={() => setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))}
                      aria-label={`Sort direction: ${sortDirection === "asc" ? "ascending" : "descending"}`}
                      title={sortDirection === "asc" ? "Ascending" : "Descending"}
                    >
                      {sortDirection === "asc" ? (
                        <ArrowUp aria-hidden="true" />
                      ) : (
                        <ArrowDown aria-hidden="true" />
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Mobile Student Cards */}
              <div className="flex flex-col gap-2">
                {filteredStudents.map((student) => {
                  const isSelected = selectedStudentIds.has(student.id);
                  return (
                    <Card
                      key={student.id}
                      size="sm"
                      className={cn(
                        "gap-2 py-3 transition-[border-color,box-shadow,background-color]",
                        isSelected
                          ? "bg-primary/5 border-primary/50 ring-1 ring-primary/30"
                          : "hover:border-border"
                      )}
                    >
                      <CardHeader className="items-center">
                        <div className="flex items-center gap-3 min-w-0">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSelectStudent(student.id)}
                            aria-label={`Select ${student.full_name}`}
                            className="after:-inset-3.5"
                          />
                          <CardTitle className="text-sm font-semibold tracking-tight truncate">
                            {student.full_name}
                          </CardTitle>
                        </div>
                        <CardAction className="row-span-1 self-center -mr-1.5 -my-2">
                          <RowActions student={student} onEdit={() => handleEdit(student)} />
                        </CardAction>
                      </CardHeader>

                      <CardContent className="flex flex-col gap-2 text-xs text-muted-foreground">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="secondary" className="font-normal text-[11px] shrink-0">
                            {student.section}
                          </Badge>
                          {student.parent_email && (
                            student.parent_status === "active" ? (
                              <Badge
                                variant="outline"
                                className="text-[10px] px-1.5 py-0 font-medium bg-band-4/15 text-band-4-text border-band-4/30"
                              >
                                Active
                              </Badge>
                            ) : (
                              <div className="inline-flex items-center gap-1">
                                <Badge
                                  variant="outline"
                                  className="text-[10px] px-1.5 py-0 font-medium bg-band-2/15 text-band-2-text border-band-2/30"
                                >
                                  Pending
                                </Badge>
                                <Button
                                  type="button"
                                  variant="link"
                                  size="xs"
                                  onClick={() => handleResendInvite(student)}
                                  disabled={resendingStudentId === student.id}
                                  title="Resend invitation email"
                                  className="relative h-auto p-0 gap-1 text-xs font-medium cursor-pointer after:absolute after:-inset-2 sm:after:hidden"
                                >
                                  {resendingStudentId === student.id ? (
                                    <Spinner data-icon="inline-start" />
                                  ) : (
                                    <Send data-icon="inline-start" aria-hidden="true" />
                                  )}
                                  <span>Resend</span>
                                </Button>
                              </div>
                            )
                          )}
                        </div>
                        {student.parent_email ? (
                          <span className="truncate font-normal">
                            {student.parent_email}
                          </span>
                        ) : (
                          <span className="italic font-normal text-[11px]">No parent email linked</span>
                        )}
                      </CardContent>

                      <CardFooter className="mt-1 justify-between border-t border-border/60 pt-3 text-[11px] text-muted-foreground">
                        <span>Enrolled</span>
                        <time dateTime={student.created_at} className="font-medium text-foreground/80">
                          {new Date(student.created_at).toLocaleDateString(undefined, {
                            year: "numeric",
                            month: "short",
                            day: "numeric" })}
                        </time>
                      </CardFooter>
                    </Card>
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
            >
              {isBatchRemoving ? (
                <>
                  <Spinner data-icon="inline-start" />
                  <span>Removing...</span>
                </>
              ) : (
                `Remove ${selectedStudentsList.length} ${selectedStudentsList.length === 1 ? "Student" : "Students"}`
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Manage Sections Dialog */}
      <ManageSectionsDialog
        open={isManageSectionsOpen}
        onOpenChange={setIsManageSectionsOpen}
      />
    </div>
  );
}

function RowActions({ student, onEdit }: { student: Student; onEdit: () => void }) {
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const { mutate: removeStudent, isPending } = useRemoveStudent();

  const handleRemove = () => {
    removeStudent(student.id, {
      onSuccess: () => {
        toast.add({ type: "success", title: `Removed ${student.full_name} from roster.` });
        setIsAlertOpen(false);
      },
      onError: (err: Error) => {
        toast.add({ type: "error", title: err.message || "Failed to remove student" });
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
              className="relative size-9 sm:size-8 text-muted-foreground hover:text-foreground after:absolute after:-inset-2 after:content-['']"
              aria-label={`Actions for ${student.full_name}`}
            />
          }
        >
          <span className="sr-only">Actions for {student.full_name}</span>
          <MoreHorizontal aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="rounded-xl min-w-36 p-1 shadow-lg">
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={onEdit} className="cursor-pointer py-2 px-2.5 text-sm">
              <Edit2 data-icon="inline-start" className="text-muted-foreground" aria-hidden="true" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onClick={() => setIsAlertOpen(true)}
              className="cursor-pointer py-2 px-2.5 text-sm"
            >
              <Trash2 data-icon="inline-start" aria-hidden="true" />
              Remove
            </DropdownMenuItem>
          </DropdownMenuGroup>
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
            >
              {isPending ? (
                <>
                  <Spinner data-icon="inline-start" />
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
