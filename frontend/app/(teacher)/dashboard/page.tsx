"use client";

import { useState } from "react";
import {
  useDashboardScores,
  type StudentScoreSummary,
} from "@/lib/hooks/use-dashboard";
import { useSubmissions } from "@/lib/hooks/use-submissions";
import { SummaryCards } from "@/components/dashboard/summary-cards";
import { ClassTable } from "@/components/dashboard/class-table";
import { StudentDrillDownDrawer } from "@/components/dashboard/student-drill-down";
import { SubmissionDetailDialog } from "@/components/submissions/submission-detail-dialog";
import { Button } from "@/components/ui/button";
import {
  RotateCcw,
  BarChart3,
  AlertCircle,
  Download,
} from "lucide-react";

export default function DashboardPage() {
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

  const handleExportCSV = () => {
    if (!data?.students || data.students.length === 0) return;

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

    const rows = data.students.map((s) => [
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
    link.setAttribute("href", url);
    link.setAttribute("download", `writewise_class_diagnostics_${today}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/80">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <BarChart3 className="size-6 text-brand-600 dark:text-brand-400" />
            <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
              Class Diagnostics & Analytics
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Class-wide handwriting progress and diagnostic performance across all 5 assessment criteria.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            disabled={isLoading || !data?.students?.length}
            className="h-9 px-3 rounded-xl text-xs font-semibold gap-1.5 shadow-xs cursor-pointer border-border hover:bg-muted"
            title="Export class diagnostic assessment matrix as CSV"
          >
            <Download className="size-3.5" />
            <span>Export CSV</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading || isRefetching}
            className="h-9 px-3 rounded-xl text-xs font-semibold gap-1.5 shadow-xs cursor-pointer border-border hover:bg-muted"
          >
            <RotateCcw className={`size-3.5 ${isRefetching ? "animate-spin" : ""}`} />
            <span>Refresh Data</span>
          </Button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-start gap-3">
          <AlertCircle className="size-5 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-semibold text-xs">Failed to load class analytics</h4>
            <p className="text-xs opacity-90">{error.message}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="mt-2 h-7 text-xs rounded-lg border-destructive/30 hover:bg-destructive/10 text-destructive"
            >
              Try again
            </Button>
          </div>
        </div>
      )}

      {/* Section 1: Summary Cards Grid */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-sm font-semibold text-foreground uppercase tracking-wider text-muted-foreground/90">
            Class Performance Averages
          </h2>
          {data?.classAverages.scoreSource === "manual" && (
            <span className="text-[11px] text-muted-foreground hidden sm:inline">
              Derived from teacher rubric assessments (Phase 1 calibration)
            </span>
          )}
        </div>

        <SummaryCards
          averages={data?.classAverages}
          isLoading={isLoading}
        />
      </section>

      {/* Section 2: Student Performance Table */}
      <section className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-sm font-semibold text-foreground uppercase tracking-wider text-muted-foreground/90">
            Student Assessment Matrix
          </h2>
          <span className="text-[11px] text-muted-foreground hidden sm:inline">
            Sort by any criterion to identify areas needing guided intervention
          </span>
        </div>

        <ClassTable
          students={data?.students}
          isLoading={isLoading}
          onSelectStudent={handleSelectStudent}
        />
      </section>

      {/* Student Drill-Down Sheet Drawer */}
      <StudentDrillDownDrawer
        student={selectedStudent}
        open={isDrawerOpen}
        onOpenChange={setIsDrawerOpen}
        onOpenSubmission={handleOpenSubmission}
      />

      {/* Submission Detail Dialog */}
      <SubmissionDetailDialog
        submission={activeSubmission}
        open={isSubmissionModalOpen}
        onOpenChange={setIsSubmissionModalOpen}
        activityTargetText={activeSubmission?.activity_id}
      />
    </div>
  );
}
