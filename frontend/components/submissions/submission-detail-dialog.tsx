"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  type Submission,
  useSubmissionImageUrl,
} from "@/lib/hooks/use-submissions";
import { useTeacherModals } from "@/components/teacher-modals-provider";
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Upload,
  CalendarDays,
  User,
  GraduationCap,
  Maximize2,
  Minimize2,
  FileText,
  Lightbulb,
  Camera,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Info,
} from "lucide-react";

interface SubmissionDetailDialogProps {
  submission: Submission | null;
  submissions?: Submission[];
  currentIndex?: number;
  onNavigate?: (submission: Submission) => void;
  activityTargetText?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const REJECTION_GUIDE: Record<
  string,
  { title: string; description: string; advice: string }
> = {
  QUALITY_GATE_BLUR: {
    title: "Blurry or Out-of-Focus Photo",
    description:
      "The OpenCV quality gate detected motion blur or soft focus that prevents accurate cursive stroke extraction.",
    advice:
      "Hold the camera steady, tap to focus on the handwriting, and ensure adequate lighting before snapping.",
  },
  QUALITY_GATE_LIGHTING: {
    title: "Poor or Uneven Lighting",
    description:
      "Heavy shadows or strong glare obscured the 3-line penmanship ruling.",
    advice:
      "Position the worksheet in bright, indirect natural or classroom light without direct overhead flash glare.",
  },
  QUALITY_GATE_SKEW: {
    title: "Excessive Worksheet Skew",
    description:
      "The page was captured at too steep an angle for automated perspective correction.",
    advice:
      "Hold the camera parallel directly above the paper to capture a flat, rectangular top-down view.",
  },
  QUALITY_GATE_OCCLUDED: {
    title: "Worksheet Corners or Text Occluded",
    description:
      "Fingers, shadows, or page curl covered the alignment ruling or student writing.",
    advice:
      "Ensure all four corners and the entire target prompt area are clearly visible within the camera frame.",
  },
  QUALITY_GATE_NO_TEXT: {
    title: "No Handwriting Detected",
    description:
      "The system could not detect student handwriting strokes on the ruling lines.",
    advice:
      "Verify the student has written with a high-contrast dark pencil or pen, and the writing area is in frame.",
  },
  SEGMENTATION_COUNT_MISMATCH: {
    title: "Word Count Mismatch",
    description:
      "The number of segmented words does not match the expected prompt text.",
    advice:
      "Check that the student wrote the complete prompt on the worksheet without skipping words or adding extra lines.",
  },
};

const CRITERIA_GUIDE: Record<
  string,
  { rubricGoal: string; coachingTip: string }
> = {
  "Letter Formation": {
    rubricGoal:
      "OpenCV stroke curvature analysis evaluates ascender loop closures (b, d, h, k, l) and descender loops (g, j, p, q, y, z).",
    coachingTip:
      "Guide the student to connect cursive loops smoothly without disjointed strokes or incomplete oval closures.",
  },
  "Size Consistency": {
    rubricGoal:
      "Evaluates letter proportion relative to 3-line penmanship guidelines (headline, midline, baseline).",
    coachingTip:
      "Ensure lowercase x-height letters (a, c, e, m, n, o, r, s, u, v, w, x) reach precisely up to the dotted midline.",
  },
  Spacing: {
    rubricGoal:
      "Measures inter-word gaps and consistent spacing between connected cursive characters.",
    coachingTip:
      "Standard handwriting spacing should equal approximately one lowercase 'o' between letters and a two-finger gap between words.",
  },
  "Slant Angle": {
    rubricGoal:
      "Measures cursive stroke tilt consistency against the standard 60°–68° forward slant angle.",
    coachingTip:
      "Encourage the student to keep paper angled at 30°–45° on their desk to maintain parallel, uniform forward slant.",
  },
  "Baseline Alignment": {
    rubricGoal:
      "Evaluates stroke drift along the bottom solid ruling line across every word.",
    coachingTip:
      "Check that letters rest stably on the baseline without floating upward or sinking beneath the bottom guideline.",
  },
};

function getScoreBand(score: number | null | undefined): {
  label: string;
  className: string;
  dotColor: string;
} {
  if (score === null || score === undefined) {
    return {
      label: "Pending",
      className: "bg-muted/60 text-muted-foreground border-border",
      dotColor: "bg-muted-foreground",
    };
  }

  if (score >= 80) {
    return {
      label: "Excellent",
      className:
        "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-900",
      dotColor: "bg-emerald-500",
    };
  }
  if (score >= 60) {
    return {
      label: "Satisfactory",
      className:
        "bg-[#eef4ec] text-[#3d6837] dark:bg-brand-950/80 dark:text-brand-300 border-[#7c9b6e]/30 dark:border-brand-900",
      dotColor: "bg-[#7c9b6e]",
    };
  }
  if (score >= 40) {
    return {
      label: "Developing",
      className:
        "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-200/80 dark:border-amber-900",
      dotColor: "bg-amber-500",
    };
  }
  return {
    label: "Needs Improvement",
    className:
      "bg-orange-50 text-orange-800 dark:bg-orange-950 dark:text-orange-300 border-orange-200/80 dark:border-orange-900",
    dotColor: "bg-orange-500",
  };
}

function formatDateFull(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function SubmissionDetailDialog({
  submission,
  submissions,
  currentIndex,
  onNavigate,
  activityTargetText,
  open,
  onOpenChange,
}: SubmissionDetailDialogProps) {
  const { openUpload } = useTeacherModals();
  const [isZoomed, setIsZoomed] = useState(false);
  const [selectedCriterion, setSelectedCriterion] = useState<string | null>(null);

  const { data: imageUrl, isLoading: isImageLoading } = useSubmissionImageUrl(
    submission?.image_path ?? null
  );

  // Keyboard navigation across submissions
  useEffect(() => {
    if (!open || !submissions || submissions.length <= 1 || !onNavigate) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (e.key === "ArrowLeft" || e.key === "j" || e.key === "J") {
        if (currentIndex !== undefined && currentIndex > 0) {
          e.preventDefault();
          onNavigate(submissions[currentIndex - 1]);
        }
      } else if (e.key === "ArrowRight" || e.key === "k" || e.key === "K") {
        if (
          currentIndex !== undefined &&
          currentIndex < submissions.length - 1
        ) {
          e.preventDefault();
          onNavigate(submissions[currentIndex + 1]);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, submissions, currentIndex, onNavigate]);

  if (!submission) return null;

  const hasMultipleSubmissions = Boolean(
    submissions && submissions.length > 1 && currentIndex !== undefined
  );
  const canGoPrev = hasMultipleSubmissions && (currentIndex ?? 0) > 0;
  const canGoNext =
    hasMultipleSubmissions && (currentIndex ?? 0) < (submissions?.length ?? 0) - 1;

  const rejectionInfo = submission.rejection_code
    ? REJECTION_GUIDE[submission.rejection_code] ?? {
        title: "Worksheet Assessment Issue",
        description: `Quality check returned code: ${submission.rejection_code}`,
        advice:
          "Please verify that the worksheet is well-lit, in focus, and written with a clear pen or pencil.",
      }
    : null;

  const compositeScore = submission.measurement?.composite_score;
  const compositeBand = getScoreBand(compositeScore);

  const criteria = [
    {
      name: "Letter Formation",
      score: submission.measurement?.letter_formation_score,
      description: "Proper cursive loop closures and proportion",
    },
    {
      name: "Size Consistency",
      score: submission.measurement?.size_consistency_score,
      description: "Uniform letter height within 3-line ruling",
    },
    {
      name: "Spacing",
      score: submission.measurement?.spacing_score,
      description: "Consistent word and inter-letter spacing",
    },
    {
      name: "Slant Angle",
      score: submission.measurement?.slant_score,
      description: "Consistent forward cursive slant angle",
    },
    {
      name: "Baseline Alignment",
      score: submission.measurement?.baseline_alignment_score,
      description: "Stable letter resting along the ruled baseline",
    },
  ];

  const handleReupload = () => {
    onOpenChange(false);
    openUpload({
      activityId: submission.activity_id,
      studentId: submission.student_id,
    });
  };

  const activeCriterionInfo = selectedCriterion
    ? CRITERIA_GUIDE[selectedCriterion]
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-1.5rem)] sm:max-w-4xl max-w-4xl max-h-[min(94dvh,calc(100vh-2rem))] flex flex-col p-4 sm:p-6 rounded-2xl sm:rounded-3xl gap-0 overflow-hidden shadow-xl border border-border/80 bg-surface dark:bg-card">
        {/* Header */}
        <DialogHeader className="pb-3 sm:pb-4 border-b border-border/70 shrink-0 text-left">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pr-8">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex size-10 items-center justify-center rounded-xl bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300 shrink-0">
                <GraduationCap className="size-5" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="font-heading text-lg sm:text-xl font-semibold tracking-tight text-foreground flex items-center gap-2 flex-wrap">
                  <span className="truncate max-w-[200px] sm:max-w-xs">
                    {submission.student?.full_name ?? "Student"}
                  </span>
                  <Badge
                    variant="outline"
                    className={`text-xs font-semibold px-2.5 py-0.5 inline-flex items-center gap-1.5 ${
                      submission.status === "completed"
                        ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200"
                        : submission.status === "processing"
                          ? "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-200"
                          : "bg-destructive/10 text-destructive border-destructive/20"
                    }`}
                  >
                    <span
                      className={`size-1.5 rounded-full ${
                        submission.status === "completed"
                          ? "bg-emerald-500"
                          : submission.status === "processing"
                            ? "bg-amber-500 animate-pulse"
                            : "bg-destructive"
                      }`}
                    />
                    {submission.status === "completed"
                      ? "Completed"
                      : submission.status === "processing"
                        ? "Processing"
                        : "Rejected"}
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5 flex items-center gap-3 flex-wrap">
                  <span className="inline-flex items-center gap-1">
                    <User className="size-3" />
                    Uploaded by{" "}
                    {submission.uploader_role === "parent" ? "Parent" : "Teacher"}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <CalendarDays className="size-3" />
                    {formatDateFull(submission.created_at)}
                  </span>
                </DialogDescription>
              </div>
            </div>

            {/* Quick Actions & Student-to-Student Navigation */}
            <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
              {/* Sequential Student Navigation */}
              {hasMultipleSubmissions && submissions && onNavigate && (
                <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-xl border border-border/70">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={!canGoPrev}
                    onClick={() => {
                      if (canGoPrev && currentIndex !== undefined) {
                        onNavigate(submissions[currentIndex - 1]);
                      }
                    }}
                    className="size-7 p-0 rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-30 cursor-pointer"
                    aria-label="Previous student (Key: J or ←)"
                    title="Previous student (← / J)"
                  >
                    <ChevronLeft className="size-4" />
                  </Button>
                  <span className="text-[11px] font-medium text-muted-foreground tabular-nums px-1.5">
                    {(currentIndex ?? 0) + 1} of {submissions.length}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={!canGoNext}
                    onClick={() => {
                      if (canGoNext && currentIndex !== undefined) {
                        onNavigate(submissions[currentIndex + 1]);
                      }
                    }}
                    className="size-7 p-0 rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-30 cursor-pointer"
                    aria-label="Next student (Key: K or →)"
                    title="Next student (→ / K)"
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              )}

              {/* Quick Re-upload for rejected */}
              {submission.status === "rejected" && (
                <Button
                  size="sm"
                  onClick={handleReupload}
                  className="h-8 min-h-[32px] bg-primary hover:bg-brand-700 text-primary-foreground text-xs font-medium rounded-lg sm:rounded-xl gap-1.5 shadow-xs shrink-0 cursor-pointer"
                >
                  <Upload className="size-3.5" />
                  Re-upload
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* Modal Body: Split view (Image + Diagnostic details) */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain py-4 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left: Worksheet Image Preview */}
            <div className="lg:col-span-6 flex flex-col space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Handwriting Worksheet
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsZoomed((prev) => !prev)}
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1 cursor-pointer"
                >
                  {isZoomed ? (
                    <>
                      <Minimize2 className="size-3.5" />
                      <span>Fit view</span>
                    </>
                  ) : (
                    <>
                      <Maximize2 className="size-3.5" />
                      <span>Expand</span>
                    </>
                  )}
                </Button>
              </div>

              <div
                className={`relative rounded-xl sm:rounded-2xl border border-border bg-muted/40 overflow-hidden transition-all ${
                  isZoomed ? "max-h-[520px]" : "aspect-4/3 sm:aspect-3/2"
                } flex items-center justify-center`}
              >
                {isImageLoading ? (
                  <Skeleton className="size-full rounded-none" />
                ) : imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imageUrl}
                    alt={`Handwriting worksheet submitted for ${submission.student?.full_name ?? "student"}`}
                    className={`size-full object-contain ${
                      isZoomed ? "cursor-zoom-out" : "cursor-zoom-in"
                    }`}
                    onClick={() => setIsZoomed((prev) => !prev)}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center p-6 text-center text-muted-foreground space-y-2">
                    <FileText className="size-10 text-muted-foreground/60" />
                    <p className="text-xs font-medium">Worksheet image unavailable</p>
                  </div>
                )}

                {/* Selected criterion overlay badge */}
                {selectedCriterion && (
                  <div className="absolute top-2.5 left-2.5 bg-background/90 dark:bg-card/90 backdrop-blur-xs px-2.5 py-1 rounded-lg border border-brand-200 dark:border-brand-900 shadow-xs text-xs font-medium text-brand-700 dark:text-brand-300 flex items-center gap-1.5">
                    <Sparkles className="size-3.5 text-brand-600" />
                    <span>Viewing: {selectedCriterion}</span>
                  </div>
                )}
              </div>

              {activityTargetText && (
                <div className="p-2.5 rounded-xl bg-muted/40 border border-border/60 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground mr-1">
                    Target prompt:
                  </span>
                  &ldquo;{activityTargetText}&rdquo;
                </div>
              )}
            </div>

            {/* Right: Assessment Feedback & Diagnostics */}
            <div className="lg:col-span-6 flex flex-col space-y-4">
              {/* REJECTED STATE */}
              {submission.status === "rejected" && rejectionInfo && (
                <div className="p-4 rounded-xl sm:rounded-2xl bg-destructive/10 border border-destructive/20 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="flex size-9 items-center justify-center rounded-lg bg-destructive/20 text-destructive shrink-0 mt-0.5">
                      <AlertCircle className="size-5" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-sm font-heading font-semibold text-destructive">
                        {rejectionInfo.title}
                      </h4>
                      <p className="text-xs text-foreground/80 leading-relaxed">
                        {rejectionInfo.description}
                      </p>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-surface dark:bg-card border border-destructive/20 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                      <Lightbulb className="size-3.5 text-amber-600 dark:text-amber-400" />
                      <span>Recommended action for re-upload</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {rejectionInfo.advice}
                    </p>
                  </div>

                  <Button
                    onClick={handleReupload}
                    className="w-full h-10 min-h-[40px] bg-primary hover:bg-brand-700 text-primary-foreground text-xs sm:text-sm font-medium rounded-lg sm:rounded-xl gap-2 shadow-xs cursor-pointer"
                  >
                    <Camera className="size-4" />
                    Take & Re-upload New Photo
                  </Button>
                </div>
              )}

              {/* PROCESSING STATE */}
              {submission.status === "processing" && (
                <div className="p-5 rounded-xl sm:rounded-2xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900 space-y-3 text-center">
                  <div className="flex size-12 items-center justify-center rounded-2xl bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-300 mx-auto animate-pulse">
                    <Clock className="size-6" />
                  </div>
                  <div className="space-y-1 max-w-sm mx-auto">
                    <h4 className="text-sm font-heading font-semibold text-amber-900 dark:text-amber-200">
                      Analyzing Handwriting Worksheet
                    </h4>
                    <p className="text-xs text-amber-800/80 dark:text-amber-300/80 leading-relaxed">
                      OpenCV quality verification passed. The CNN model is evaluating letter formation, spacing, and baseline stability.
                    </p>
                  </div>
                </div>
              )}

              {/* COMPLETED STATE: 5 Criteria Diagnostics */}
              {submission.status === "completed" && (
                <div className="space-y-3.5">
                  {/* Overall Composite Score Pill */}
                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-surface dark:bg-card border border-border shadow-xs">
                    <div className="space-y-0.5">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Composite Assessment
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-heading font-bold text-foreground tabular-nums">
                          {compositeScore !== null && compositeScore !== undefined
                            ? `${Math.round(compositeScore)}%`
                            : "Scored"}
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-xs font-semibold px-2.5 py-0.5 inline-flex items-center gap-1.5 ${compositeBand.className}`}
                        >
                          <span
                            className={`size-1.5 rounded-full ${compositeBand.dotColor}`}
                          />
                          {compositeBand.label}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                      <CheckCircle2 className="size-5" />
                    </div>
                  </div>

                  {/* 5 Criteria breakdown */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        5-Criterion Breakdown
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        Tap a criterion for diagnostic tips
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      {criteria.map((c) => {
                        const band = getScoreBand(c.score);
                        const isSelected = selectedCriterion === c.name;
                        return (
                          <button
                            key={c.name}
                            type="button"
                            onClick={() =>
                              setSelectedCriterion((prev) =>
                                prev === c.name ? null : c.name
                              )
                            }
                            className={`w-full flex items-center justify-between p-2.5 rounded-xl border transition-all text-xs text-left cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring ${
                              isSelected
                                ? "bg-brand-50/80 dark:bg-brand-950/60 border-brand-300 dark:border-brand-800 shadow-xs"
                                : "bg-surface dark:bg-card border-border/70 hover:border-border hover:bg-muted/30"
                            }`}
                          >
                            <div className="min-w-0 pr-2">
                              <div className="flex items-center gap-1.5">
                                <p className="font-semibold text-foreground truncate">
                                  {c.name}
                                </p>
                                {isSelected && (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] px-1.5 py-0 bg-brand-100 text-brand-800 dark:bg-brand-900 dark:text-brand-200 border-brand-300"
                                  >
                                    Focused
                                  </Badge>
                                )}
                              </div>
                              <p className="text-[11px] text-muted-foreground truncate">
                                {c.description}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {c.score !== null && c.score !== undefined && (
                                <span className="font-semibold text-foreground tabular-nums">
                                  {Math.round(c.score)}%
                                </span>
                              )}
                              <Badge
                                variant="outline"
                                className={`text-[11px] font-semibold px-2 py-0.5 ${band.className}`}
                              >
                                <span
                                  className={`size-1.5 rounded-full mr-1 ${band.dotColor}`}
                                />
                                {band.label}
                              </Badge>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Focused Criterion Diagnostic Insight Card */}
                  {selectedCriterion && activeCriterionInfo && (
                    <div className="p-3.5 rounded-xl bg-brand-50/60 dark:bg-brand-950/40 border border-brand-200/80 dark:border-brand-900 space-y-2 animate-in fade-in-50 duration-200">
                      <div className="flex items-center justify-between text-xs font-semibold text-brand-900 dark:text-brand-200">
                        <span className="flex items-center gap-1.5">
                          <Info className="size-3.5 text-brand-600 dark:text-brand-400" />
                          <span>{selectedCriterion} Diagnostic Guide</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelectedCriterion(null)}
                          className="text-[11px] text-brand-700 hover:text-brand-900 dark:text-brand-300 hover:underline cursor-pointer"
                        >
                          Dismiss
                        </button>
                      </div>
                      <p className="text-xs text-foreground/80 leading-relaxed">
                        {activeCriterionInfo.rubricGoal}
                      </p>
                      <div className="pt-1.5 border-t border-brand-200/60 dark:border-brand-900/60 flex items-start gap-1.5 text-xs text-brand-800 dark:text-brand-300">
                        <Sparkles className="size-3.5 text-brand-600 dark:text-brand-400 shrink-0 mt-0.5" />
                        <span className="leading-normal">
                          <strong>Coaching tip:</strong> {activeCriterionInfo.coachingTip}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-border/70 shrink-0">
          <div className="text-xs text-muted-foreground hidden sm:block">
            {hasMultipleSubmissions && (
              <span>Use <strong>← / →</strong> or <strong>J / K</strong> to cycle through student worksheets</span>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="h-9 text-xs sm:text-sm font-medium rounded-lg sm:rounded-xl text-muted-foreground hover:text-foreground cursor-pointer"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
