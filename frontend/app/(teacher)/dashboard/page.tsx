"use client";

import { useState, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { toast } from "@/components/ui/toast";
import {
  useDashboardScores,
  type StudentScoreSummary,
} from "@/lib/hooks/use-dashboard";
import { useSubmissions } from "@/lib/hooks/use-submissions";
import { SummaryCards } from "@/components/dashboard/summary-cards";
import {
  ClassTable,
  type SortField,
  type SortDirection,
  type BandFilter,
} from "@/components/dashboard/class-table";
import { StudentDrillDownDrawer } from "@/components/dashboard/student-drill-down";
import { useTeacherModals } from "@/components/teacher-modals-provider";

const SubmissionDetailDialog = dynamic(
  () =>
    import("@/components/submissions/submission-detail-dialog").then(
      (m) => m.SubmissionDetailDialog
    ),
  { ssr: false }
);
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { getBandFromScore } from "@/lib/utils/scoring";
import {
  RotateCcw,
  AlertCircle,
  Download,
  UploadCloud,
} from "lucide-react";

const EMPTY_STUDENTS: StudentScoreSummary[] = [];

export default function DashboardPage() {
  const { openUpload } = useTeacherModals();
  const { data, isLoading, error, refetch, isRefetching } = useDashboardScores();

  // Selected student for drill-down drawer
  const [selectedStudent, setSelectedStudent] = useState<StudentScoreSummary | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Selected submission for detail modal inspection
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const [isSubmissionModalOpen, setIsSubmissionModalOpen] = useState(false);

  // Query submissions for selected activity when submission detail is opened
  const { data: activitySubmissions } = useSubmissions(selectedActivityId || "");

  const activeSubmission =
    activitySubmissions?.find((s) => s.id === selectedSubmissionId) ?? null;

  const handleSelectStudent = (student: StudentScoreSummary) => {
    setSelectedStudent(student);
    setIsDrawerOpen(true);
  };

  const handleOpenSubmission = (submissionId: string, activityId: string) => {
    setSelectedSubmissionId(submissionId);
    setSelectedActivityId(activityId);
    setIsSubmissionModalOpen(true);
  };

  // Filter & Sort state owned at page level — avoids useEffect child-to-parent sync cycles
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSection, setSelectedSection] = useState("all");
  const [selectedBand, setSelectedBand] = useState<BandFilter>("all");
  const [sortField, setSortField] = useState<SortField>("composite");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const isTableFiltered =
    searchQuery.trim() !== "" || selectedSection !== "all" || selectedBand !== "all";

  const allStudents = data?.students ?? EMPTY_STUDENTS;

  const filteredAndSortedStudents = useMemo(() => {
    return allStudents
      .filter((student) => {
        const matchesSearch =
          searchQuery === "" ||
          student.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          student.section.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesSection =
          selectedSection === "all" || student.section === selectedSection;

        const score = student.scores.composite;
        let matchesBand = true;
        if (selectedBand === "unrated") {
          matchesBand = score === null || score === undefined;
        } else if (selectedBand !== "all") {
          const band = getBandFromScore(score);
          matchesBand = band === selectedBand;
        }

        return matchesSearch && matchesSection && matchesBand;
      })
      .sort((a, b) => {
        let valA: string | number | null = null;
        let valB: string | number | null = null;

        if (sortField === "fullName") {
          valA = a.fullName.toLowerCase();
          valB = b.fullName.toLowerCase();
        } else if (sortField === "section") {
          valA = a.section.toLowerCase();
          valB = b.section.toLowerCase();
        } else if (sortField === "composite") {
          valA = a.scores.composite;
          valB = b.scores.composite;
        } else {
          valA = a.scores[sortField];
          valB = b.scores[sortField];
        }

        if (valA === null && valB === null) return 0;
        if (valA === null) return 1;
        if (valB === null) return -1;

        if (typeof valA === "string" && typeof valB === "string") {
          return sortDirection === "asc"
            ? valA.localeCompare(valB)
            : valB.localeCompare(valA);
        }

        const numA = Number(valA);
        const numB = Number(valB);
        return sortDirection === "asc" ? numA - numB : numB - numA;
      });
  }, [allStudents, searchQuery, selectedSection, selectedBand, sortField, sortDirection]);

  const handleClearFilters = useCallback(() => {
    setSearchQuery("");
    setSelectedSection("all");
    setSelectedBand("all");
  }, []);

  const handleSortChange = useCallback(
    (field: SortField, direction?: SortDirection) => {
      setSortField(field);
      if (direction) {
        setSortDirection(direction);
      }
    },
    []
  );

  const exportableStudents = isTableFiltered ? filteredAndSortedStudents : allStudents;

  const selectedStudentIndex = selectedStudent
    ? filteredAndSortedStudents.findIndex((s) => s.studentId === selectedStudent.studentId)
    : -1;

  const handlePreviousStudent =
    selectedStudentIndex > 0
      ? () => setSelectedStudent(filteredAndSortedStudents[selectedStudentIndex - 1])
      : undefined;

  const handleNextStudent =
    selectedStudentIndex >= 0 && selectedStudentIndex < filteredAndSortedStudents.length - 1
      ? () => setSelectedStudent(filteredAndSortedStudents[selectedStudentIndex + 1])
      : undefined;

  const needsSupportCount =
    data?.students?.filter(
      (s) => s.scores.composite !== null && s.scores.composite < 25
    ).length ?? 0;

  const handleExportCSV = () => {
    if (exportableStudents.length === 0) return;

    const headers = [
      "Student Name",
      "Section",
      "Letter Formation (%)",
      "Size Consistency (%)",
      "Spacing Regularity (%)",
      "Slant Angle (%)",
      "Baseline Alignment (%)",
      "Overall Composite (%)",
      "Status",
    ];

    const rows = exportableStudents.map((s) => [
      `"${s.fullName.replace(/"/g, '""')}"`,
      `"${s.section.replace(/"/g, '""')}"`,
      s.scores.letter_formation !== null ? s.scores.letter_formation.toFixed(1) : "",
      s.scores.size_consistency !== null ? s.scores.size_consistency.toFixed(1) : "",
      s.scores.spacing !== null ? s.scores.spacing.toFixed(1) : "",
      s.scores.slant !== null ? s.scores.slant.toFixed(1) : "",
      s.scores.baseline_alignment !== null ? s.scores.baseline_alignment.toFixed(1) : "",
      s.scores.composite !== null ? s.scores.composite.toFixed(1) : "",
      s.scores.composite !== null ? "Scored" : "Unrated",
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const today = new Date().toISOString().split("T")[0];
    const suffix = isTableFiltered ? "_filtered" : "";
    link.setAttribute("href", url);
    link.setAttribute("download", `writewise_class_diagnostics${suffix}_${today}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    const count = exportableStudents.length;
    toast.add({
      type: "success",
      title: isTableFiltered
        ? `Exported ${count} filtered ${count === 1 ? "student" : "students"} to CSV`
        : `Exported ${count} ${count === 1 ? "student" : "students"} to CSV`,
    });
  };

  return (
    <div className="w-full min-w-0 flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-heading font-semibold text-foreground tracking-tight">
            Dashboard
          </h1>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap sm:flex-nowrap">
          <Button
            type="button"
            onClick={() => openUpload()}
            className="sm:hidden w-full min-h-11 text-sm font-semibold shadow-warm-sm cursor-pointer"
          >
            <UploadCloud data-icon="inline-start" aria-hidden="true" />
            <span>Upload Worksheet</span>
          </Button>

          <Button
            variant="outline"
            onClick={handleExportCSV}
            disabled={isLoading || exportableStudents.length === 0}
            className="min-h-11 sm:min-h-9 flex-1 sm:flex-none text-xs sm:text-sm font-medium cursor-pointer"
            title={
              isTableFiltered
                ? `Export ${exportableStudents.length} filtered student scores as CSV`
                : "Export all student scores as CSV"
            }
          >
            <Download data-icon="inline-start" aria-hidden="true" />
            <span>
              {isTableFiltered ? `Export Filtered (${exportableStudents.length})` : "Export CSV"}
            </span>
          </Button>

          <Button
            variant="outline"
            onClick={() => refetch()}
            disabled={isLoading || isRefetching}
            className="min-h-11 sm:min-h-9 flex-1 sm:flex-none text-xs sm:text-sm font-medium cursor-pointer"
          >
            {isRefetching ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <RotateCcw data-icon="inline-start" aria-hidden="true" />
            )}
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertTitle className="text-sm font-semibold">
            Couldn&apos;t load class analytics
          </AlertTitle>
          <AlertDescription className="text-xs opacity-90 leading-relaxed flex flex-col items-start gap-2">
            <span>
              We couldn&apos;t load your class scores right now. Check your internet connection and try again.
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isRefetching}
              className="min-h-10 sm:min-h-8 text-xs font-medium cursor-pointer"
            >
              {isRefetching && <Spinner data-icon="inline-start" />}
              <span>{isRefetching ? "Retrying…" : "Try again"}</span>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Section 1: Summary Cards Grid */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Class Averages
          </h2>
        </div>

        <SummaryCards
          averages={data?.classAverages}
          needsSupportCount={needsSupportCount}
          isLoading={isLoading}
        />
      </section>

      {/* Section 2: Student Performance Table */}
      <section className="flex flex-col gap-3 pt-2">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Students
          </h2>
        </div>

        <ClassTable
          students={allStudents}
          filteredStudents={filteredAndSortedStudents}
          isLoading={isLoading}
          onSelectStudent={handleSelectStudent}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedSection={selectedSection}
          onSectionChange={setSelectedSection}
          selectedBand={selectedBand}
          onBandChange={setSelectedBand}
          sortField={sortField}
          onSortChange={handleSortChange}
          sortDirection={sortDirection}
          onClearFilters={handleClearFilters}
        />
      </section>

      {/* Student Drill-Down Sheet Drawer */}
      <StudentDrillDownDrawer
        student={selectedStudent}
        open={isDrawerOpen}
        onOpenChange={setIsDrawerOpen}
        onOpenSubmission={handleOpenSubmission}
        onPreviousStudent={handlePreviousStudent}
        onNextStudent={handleNextStudent}
        studentPosition={
          selectedStudentIndex >= 0
            ? { current: selectedStudentIndex + 1, total: exportableStudents.length }
            : null
        }
      />

      {/* Submission Detail Dialog lazy-loaded on first inspection */}
      {selectedSubmissionId && (
        <SubmissionDetailDialog
          submission={activeSubmission}
          submissions={activitySubmissions}
          currentIndex={
            activeSubmission && activitySubmissions
              ? activitySubmissions.findIndex((s) => s.id === activeSubmission.id)
              : undefined
          }
          onNavigate={(s) => {
            setSelectedSubmissionId(s.id);
            if (s.activity_id && s.activity_id !== selectedActivityId) {
              setSelectedActivityId(s.activity_id);
            }
          }}
          open={isSubmissionModalOpen}
          onOpenChange={setIsSubmissionModalOpen}
          activityTargetText={activeSubmission?.activity?.target_text}
        />
      )}
    </div>
  );
}
