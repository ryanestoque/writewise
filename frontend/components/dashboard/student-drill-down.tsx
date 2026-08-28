"use client";

import { useMemo } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  type StudentScoreSummary,
  useStudentScoreHistory,
} from "@/lib/hooks/use-dashboard";
import {
  RUBRIC_CRITERIA,
  DIAGNOSTIC_NOTES,
  getBandFromScore,
} from "@/lib/utils/scoring";
import { BandBadge } from "@/components/shared/band-badge";
import { BandPositionBar } from "@/components/shared/band-position-bar";
import { CriterionTrendChart } from "./criterion-trend-chart";
import {
  Calendar,
  History,
  TrendingUp,
  Award,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface StudentDrillDownProps {
  student: StudentScoreSummary | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenSubmission: (submissionId: string, activityId: string) => void;
}

function getInitials(name: string) {
  if (!name) return "";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const AVATAR_PALETTES = [
  "bg-amber-100 text-amber-900 border-amber-300/70 dark:bg-amber-950/80 dark:text-amber-200 dark:border-amber-800",
  "bg-emerald-100 text-emerald-900 border-emerald-300/70 dark:bg-emerald-950/80 dark:text-emerald-200 dark:border-emerald-800",
  "bg-blue-100 text-blue-900 border-blue-300/70 dark:bg-blue-950/80 dark:text-blue-200 dark:border-blue-800",
  "bg-purple-100 text-purple-900 border-purple-300/70 dark:bg-purple-950/80 dark:text-purple-200 dark:border-purple-800",
  "bg-brand-100 text-brand-900 border-brand-300/70 dark:bg-brand-950/80 dark:text-brand-200 dark:border-brand-800",
  "bg-rose-100 text-rose-900 border-rose-300/70 dark:bg-rose-950/80 dark:text-rose-200 dark:border-rose-800",
];

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_PALETTES.length;
  return AVATAR_PALETTES[index];
}

export function StudentDrillDownDrawer({
  student,
  open,
  onOpenChange,
  onOpenSubmission,
}: StudentDrillDownProps) {
  const studentId = student?.studentId ?? null;
  const { data: history = [], isLoading } = useStudentScoreHistory(studentId);

  // Latest submission info
  const latestSubmission = useMemo(() => {
    if (!history || history.length === 0) return null;
    return history[history.length - 1];
  }, [history]);

  if (!student) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl p-0 flex flex-col h-full bg-background border-l border-border shadow-2xl overflow-hidden"
      >
        {/* Drawer Header */}
        <SheetHeader className="p-5 sm:p-6 bg-card border-b border-border/80 shrink-0 space-y-3">
          <div className="flex items-start gap-3.5 pr-8">
            <Avatar
              className={cn(
                "size-12 border text-sm font-semibold shrink-0 shadow-xs mt-0.5",
                getAvatarColor(student.fullName)
              )}
            >
              <AvatarFallback>{getInitials(student.fullName)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0 space-y-1">
              <SheetTitle className="font-heading text-lg sm:text-xl font-bold text-foreground leading-snug break-words">
                {student.fullName}
              </SheetTitle>
              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                <SheetDescription className="text-xs font-medium text-muted-foreground">
                  Section: <span className="font-semibold text-foreground">{student.section}</span>
                </SheetDescription>
              </div>
            </div>
          </div>
        </SheetHeader>

        {/* Scrollable Drawer Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-40 w-full rounded-xl" />
              <Skeleton className="h-64 w-full rounded-xl" />
              <Skeleton className="h-32 w-full rounded-xl" />
            </div>
          ) : (
            <>
              {/* Section 1: Latest Criterion Breakdown & Diagnostic Feedback */}
              <section className="space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Award className="size-4 text-brand-600 dark:text-brand-400" />
                    <h3 className="font-heading text-sm font-semibold text-foreground">
                      Latest Diagnostic Assessment
                    </h3>
                  </div>
                  {latestSubmission && (
                    <span className="text-[11px] text-muted-foreground">
                      {new Date(latestSubmission.submissionDate).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  )}
                </div>

                {/* Overall Composite Banner */}
                {student.scores.composite !== null ? (
                  <div className="p-4 rounded-xl border border-brand-200/80 dark:border-brand-900 bg-brand-50/40 dark:bg-brand-950/20 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-foreground">
                        Overall Score (Composite)
                      </span>
                      <BandBadge score={student.scores.composite} size="default" />
                    </div>
                    <BandPositionBar score={student.scores.composite} showLabel height="default" />
                  </div>
                ) : (
                  <div className="p-4 rounded-xl border border-dashed border-border bg-muted/20 text-center py-6">
                    <p className="text-xs font-medium text-muted-foreground">
                      No graded submissions recorded yet for this student.
                    </p>
                  </div>
                )}

                {/* 5 Criteria Rows */}
                {student.scores.composite !== null && (
                  <div className="space-y-3 pt-1">
                    {RUBRIC_CRITERIA.map((criterion) => {
                      const score = student.scores[criterion.criterionKey];
                      const band =
                        student.bands[criterion.criterionKey] ??
                        (score !== null ? getBandFromScore(score) : null);
                      const diagnosticNote =
                        band && DIAGNOSTIC_NOTES[criterion.criterionKey]?.[band];

                      return (
                        <div
                          key={criterion.key}
                          className="p-3.5 rounded-xl border border-border/80 bg-card shadow-xs space-y-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-foreground">
                              {criterion.shortName}
                            </span>
                            <BandBadge band={band} score={score} size="sm" />
                          </div>

                          <BandPositionBar score={score} showLabel height="sm" />

                          {diagnosticNote && (
                            <p className="text-[11px] text-muted-foreground leading-relaxed pt-1 border-t border-border/40">
                              {diagnosticNote}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* Section 2: Historical Progress Trend */}
              <section className="space-y-3 pt-2">
                <div className="flex items-center gap-2">
                  <TrendingUp className="size-4 text-brand-600 dark:text-brand-400" />
                  <h3 className="font-heading text-sm font-semibold text-foreground">
                    Progress Trajectory Trend
                  </h3>
                </div>

                <div className="p-4 rounded-xl border border-border bg-card shadow-warm">
                  <CriterionTrendChart history={history} />
                </div>
              </section>

              {/* Section 3: Graded Submissions History List */}
              <section className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <History className="size-4 text-brand-600 dark:text-brand-400" />
                    <h3 className="font-heading text-sm font-semibold text-foreground">
                      Submission History ({history.length})
                    </h3>
                  </div>
                  <span className="text-[11px] text-muted-foreground">Click to inspect</span>
                </div>

                {history.length === 0 ? (
                  <div className="p-6 rounded-xl border border-dashed border-border text-center text-xs text-muted-foreground">
                    No submissions recorded yet.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {[...history].reverse().map((item) => (
                      <div
                        key={item.submissionId}
                        onClick={() => onOpenSubmission(item.submissionId, item.activityId)}
                        tabIndex={0}
                        role="button"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onOpenSubmission(item.submissionId, item.activityId);
                          }
                        }}
                        className="group p-3 rounded-xl border border-border bg-card hover:bg-muted/40 transition-all flex items-center justify-between gap-3 cursor-pointer shadow-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-foreground group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors truncate">
                              &quot;{item.targetText}&quot;
                            </span>
                            {item.isTakeHome && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-brand-100 text-brand-800 dark:bg-brand-950 dark:text-brand-300 font-medium">
                                Take-Home
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="size-3" />
                              {new Date(item.submissionDate).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5 shrink-0">
                          <div className="text-right">
                            <span className="font-heading text-xs font-bold tabular-nums text-foreground block">
                              {item.compositeScore?.toFixed(1)}%
                            </span>
                            <BandBadge score={item.compositeScore} size="sm" showDot={false} />
                          </div>
                          <ChevronRight className="size-4 text-muted-foreground/50 group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
