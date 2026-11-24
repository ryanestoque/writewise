"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { QueryRecovery } from "@/components/shared/query-recovery";
import {
  useTakeHomeActivities,
  useChildSubmissionForActivity,
} from "@/lib/hooks/use-parent-data";
import { useUploadSubmission } from "@/lib/hooks/use-submissions";
import { rotateImageFile } from "@/lib/utils/image";
import {
  QualityErrorCard,
  type QualityError,
} from "@/components/submissions/quality-error-card";
import { useActivityNow } from "@/components/activities/activity-work-status";
import {
  activitySubmissionsClosed,
  formatActivityDate,
  formatActivityDueAt,
} from "@/lib/utils/activity-deadlines";
import {
  compareParentActivityUrgency,
  getParentActivityStatus,
} from "@/lib/utils/parent-activity-status";
import { ApiError } from "@/lib/utils/api-error";
import { toast } from "sonner";
import {
  UploadCloudIcon,
  CameraIcon,
  FileImageIcon,
  CheckCircle2Icon,
  Loader2Icon,
  RotateCwIcon,
  ChevronDownIcon,
  LightbulbIcon,
  BookOpen,
  CheckIcon,
  XIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
  ZoomInIcon,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

interface ParentUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  childId: string;
  childName: string;
  prefilledActivityId?: string;
}

type Step = 1 | 2 | 3 | 4 | 5;

type UploadError = QualityError;

const ACCEPTED_MIME_TYPES = ["image/jpeg", "image/png"];
const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15 MB

const STEPS = [
  { step: 1, label: "Worksheet" },
  { step: 2, label: "Capture" },
  { step: 3, label: "Review" },
] as const;

const UPLOAD_STAGES = [
  {
    title: "Checking photo clarity…",
    detail: "Making sure the page is bright, flat, and easy to read.",
  },
  {
    title: "Reading handwriting lines…",
    detail: "Finding your child's writing lines and cursive strokes.",
  },
  {
    title: "Sending to teacher…",
    detail: "Almost done—saving this worksheet for teacher review.",
  },
] as const;




function subscribeTouch(callback: () => void) {
  if (typeof window === "undefined") return () => { };
  const mql = window.matchMedia("(pointer: coarse)");
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

function getTouchSnapshot() {
  if (typeof window === "undefined") return false;
  // Primary pointer only: touch-capable laptops (primary pointer = mouse/trackpad)
  // should get the desktop "Browse Files" flow, not the phone camera flow.
  return window.matchMedia("(pointer: coarse)").matches;
}

export function ParentUploadDialog({
  open,
  onOpenChange,
  childId,
  childName,
  prefilledActivityId,
}: ParentUploadDialogProps) {
  const [isUploading, setIsUploading] = useState(false);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && isUploading) return;
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent
        showCloseButton={!isUploading}
        className="w-[calc(100%-1.5rem)] max-w-xl max-h-[min(92dvh,calc(100vh-2rem))] p-0 gap-0 overflow-hidden flex flex-col shadow-warm"
      >
        <ParentUploadFlow
          key={open ? "open" : "closed"}
          onClose={() => onOpenChange(false)}
          childId={childId}
          childName={childName}
          prefilledActivityId={prefilledActivityId}
          onUploadingChange={setIsUploading}
        />
      </DialogContent>
    </Dialog>
  );
}

function ParentUploadFlow({
  onClose,
  childId,
  childName,
  prefilledActivityId,
  onUploadingChange,
}: {
  onClose: () => void;
  childId: string;
  childName: string;
  prefilledActivityId?: string;
  onUploadingChange?: (uploading: boolean) => void;
}) {
  const photoTipsId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);
  const originalFileRef = useRef<File | null>(null);
  const choosePhotoButtonRef = useRef<HTMLButtonElement>(null);
  const submitButtonRef = useRef<HTMLButtonElement>(null);
  const retryButtonRef = useRef<HTMLButtonElement>(null);
  const doneButtonRef = useRef<HTMLButtonElement>(null);
  const unavailableActionRef = useRef<HTMLButtonElement>(null);
  const lastFocusedStateRef = useRef<string | null>(null);

  const [allowActivitySwitch, setAllowActivitySwitch] = useState(!prefilledActivityId);
  const [step, setStep] = useState<Step>(prefilledActivityId ? 2 : 1);
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(
    prefilledActivityId ?? null
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [rotationDegrees, setRotationDegrees] = useState(0);
  const [isPortrait, setIsPortrait] = useState(true);
  const [isRotating, setIsRotating] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showTips, setShowTips] = useState(false);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [uploadError, setUploadError] = useState<UploadError | null>(null);
  const [dropError, setDropError] = useState<string | null>(null);
  const [uploadStage, setUploadStage] = useState(0);
  const [lastRetakeTip, setLastRetakeTip] = useState<{ tip: string; badgeLabel?: string } | null>(
    null
  );

  const {
    data: assignedActivities,
    isLoading: activitiesLoading,
    isError: activitiesError,
    isFetching: activitiesFetching,
    refetch: refetchActivities,
  } =
    useTakeHomeActivities(childId);
  const { data: priorSubmission } = useChildSubmissionForActivity(
    childId,
    selectedActivityId ?? ""
  );
  const now = useActivityNow();
  const activities = useMemo(() => {
    if (!assignedActivities) return undefined;
    return assignedActivities
      .filter(
        (a) =>
          a.isTakeHome &&
          !activitySubmissionsClosed(
            { due_at: a.dueAt, close_after_due: a.closeAfterDue },
            now
          )
      )
      .sort((a, b) => compareParentActivityUrgency(a, b, now));
  }, [assignedActivities, now]);
  const uploadMutation = useUploadSubmission();
  const queryClient = useQueryClient();

  const isMobile = useSyncExternalStore(
    subscribeTouch,
    getTouchSnapshot,
    () => false
  );

  const isUploading = step === 4 && !uploadError && uploadMutation.isPending;

  useEffect(() => {
    onUploadingChange?.(isUploading);
  }, [isUploading, onUploadingChange]);

  useEffect(() => {
    if (!isUploading) return;
    const t1 = window.setTimeout(() => setUploadStage(1), 1500);
    const t2 = window.setTimeout(() => setUploadStage(2), 3500);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [isUploading]);

  const selectedActivity = useMemo(() => {
    return activities?.find((a) => a.id === selectedActivityId) ?? null;
  }, [activities, selectedActivityId]);
  const hasSelectedActivity = Boolean(selectedActivity);
  const isWaitingForSelectedActivity =
    activitiesLoading && Boolean(selectedActivityId) && !hasSelectedActivity && (step === 2 || step === 3);
  const isUnavailableSelection =
    !activitiesLoading &&
    !activitiesError &&
    Boolean(selectedActivityId) &&
    !hasSelectedActivity &&
    (step === 2 || step === 3);

  // Programmatic focus steering upon genuine step/recovery transitions
  useEffect(() => {
    const focusKey = isUnavailableSelection
      ? `unavailable:${activities?.length ? "switch" : "close"}`
      : isWaitingForSelectedActivity
        ? null
        : step === 2 && hasSelectedActivity
          ? `step2:${isMobile ? "mobile" : "desktop"}`
          : step === 3 && hasSelectedActivity
            ? "step3"
            : step === 4 && uploadError
              ? "step4:error"
              : step === 5
                ? "step5"
                : null;

    if (!focusKey) {
      lastFocusedStateRef.current = null;
      return;
    }
    if (lastFocusedStateRef.current === focusKey) return;
    lastFocusedStateRef.current = focusKey;

    if (isUnavailableSelection) {
      unavailableActionRef.current?.focus();
    } else if (step === 2 && hasSelectedActivity) {
      choosePhotoButtonRef.current?.focus();
    } else if (step === 3 && hasSelectedActivity) {
      submitButtonRef.current?.focus();
    } else if (step === 4 && uploadError) {
      retryButtonRef.current?.focus();
    } else if (step === 5) {
      doneButtonRef.current?.focus();
    }
  }, [
    step,
    uploadError,
    isMobile,
    hasSelectedActivity,
    isUnavailableSelection,
    isWaitingForSelectedActivity,
    activities?.length,
  ]);

  // Revoke object URL on unmount
  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
    };
  }, []);

  const handleClearFile = () => {
    setDropError(null);
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    originalFileRef.current = null;
    setRotationDegrees(0);
    setIsPortrait(true);
    setSelectedFile(null);
    setPreviewUrl(null);
    setUploadError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    if (step === 3 || step === 4) {
      setStep(2);
    }
  };

  const handleRetakePhoto = (tipInfo?: { tip: string; badgeLabel?: string }) => {
    handleClearFile();
    setUploadError(null);
    if (tipInfo) {
      setLastRetakeTip(tipInfo);
    }
    setStep(2);
    if (isMobile) {
      cameraInputRef.current?.click();
    }
  };

  const handleFileChange = (file: File | undefined) => {
    if (!file) return;
    setLastRetakeTip(null);

    if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
      const msg = "Please select a JPEG or PNG photo. If you are using an iPhone/iPad, photos in HEIC format should be exported as JPEG.";
      setDropError(msg);
      toast.error(msg);
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      const msg = "Image file size must be less than 15MB.";
      setDropError(msg);
      toast.error(msg);
      return;
    }

    setDropError(null);

    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
    }

    originalFileRef.current = file;
    setRotationDegrees(0);
    setIsPortrait(true);
    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    previewUrlRef.current = url;
    setPreviewUrl(url);
    setUploadError(null);
    setStep(3);
  };

  const handleRotateClockwise = async () => {
    const baseFile = originalFileRef.current ?? selectedFile;
    if (!baseFile || isRotating) return;

    const nextDegrees = (rotationDegrees + 90) % 360;
    setIsRotating(true);
    try {
      const rotatedFile = await rotateImageFile(baseFile, nextDegrees);
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
      const newUrl = URL.createObjectURL(rotatedFile);
      previewUrlRef.current = newUrl;
      setPreviewUrl(newUrl);
      setSelectedFile(rotatedFile);
      setRotationDegrees(nextDegrees);
      setIsPortrait((prev) => !prev);
    } catch (err) {
      console.error("Failed to rotate photo:", err);
      toast.error("Failed to rotate photo. Please try again.");
    } finally {
      setIsRotating(false);
    }
  };

  const handleSubmit = (bypassTextCheck = false) => {
    if (!selectedFile || !selectedActivityId || !childId) return;
    if (!selectedActivity) { toast.error("This worksheet is no longer open for uploads."); onClose(); return; }

    setUploadStage(0);
    setStep(4);
    setUploadError(null);

    uploadMutation.mutate(
      {
        image: selectedFile,
        activityId: selectedActivityId,
        studentId: childId,
        bypassTextCheck,
      },
      {
        onSuccess: () => {
          toast.success("Photo received — your teacher reviews every result before you see it.");
          // Invalidate parent queries so progress page immediately updates
          queryClient.invalidateQueries({
            queryKey: ["parent-child-latest-scores"],
          });
          queryClient.invalidateQueries({
            queryKey: ["parent-child-score-history"],
          });
          queryClient.invalidateQueries({
            queryKey: ["parent-child-submission"],
          });
          queryClient.invalidateQueries({
            queryKey: ["parent-take-home-activities"],
          });
          setStep(5);
        },
        onError: (err) => {
          if (err instanceof ApiError && (err.code === "ACTIVITY_NOT_ASSIGNED" || err.code === "SUBMISSIONS_CLOSED")) {
            queryClient.invalidateQueries({ queryKey: ["parent-take-home-activities", childId] });
            toast.error(err.code === "SUBMISSIONS_CLOSED" ? "Uploads have closed for this worksheet." : "This worksheet is no longer assigned to your child.");
            onClose();
            return;
          }
          console.error("Submission upload failed:", err);
          let error: UploadError;
          if (err && typeof err === "object" && "code" in err) {
            error = err as UploadError;
          } else if (err instanceof Error) {
            error = {
              code: "INTERNAL_ERROR",
              message: err.message || "Upload failed. Please try again.",
            };
          } else {
            error = { code: "INTERNAL_ERROR", message: "Upload failed. Please try again." };
          }
          setUploadError(error);
        },
      }
    );
  };

  const handleRetryUpload = () => {
    handleSubmit(false);
  };

  const isStepNavigable = (targetStep: Step): boolean => {
    if (isUploading || isUnavailableSelection) return false;
    if (targetStep === 1) return allowActivitySwitch;
    if (targetStep === 2) return Boolean(selectedActivity);
    if (targetStep === 3) return Boolean(selectedActivity && selectedFile);
    return false;
  };

  const handleChooseAnotherWorksheet = () => {
    handleClearFile();
    setSelectedActivityId(null);
    setAllowActivitySwitch(true);
    setStep(1);
  };

  const stepAnnouncement = useMemo(() => {
    if (isUnavailableSelection) {
      return "This worksheet is no longer open for uploads.";
    }
    if (!allowActivitySwitch) {
      if (step === 2) return "Step 1 of 2: Capture or Choose Photo";
      if (step === 3) return "Step 2 of 2: Review and Confirm Submission";
    }
    switch (step) {
      case 1:
        return "Step 1 of 3: Select Practice Worksheet";
      case 2:
        return "Step 2 of 3: Capture or Choose Photo";
      case 3:
        return "Step 3 of 3: Review and Confirm Submission";
      case 4:
        return uploadError
          ? "Photo needs attention. Review the feedback before trying again."
          : "Sending and checking your worksheet photo";
      case 5:
        return "Photo sent—waiting for teacher review";
      default:
        return "";
    }
  }, [step, uploadError, allowActivitySwitch, isUnavailableSelection]);

  return (
    <>
      {/* Persistent Hidden File Inputs so one-tap mobile retake launches the camera synchronously from Step 4 */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/jpeg,image/png"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => handleFileChange(e.target.files?.[0])}
      />
      <input
        type="file"
        ref={cameraInputRef}
        accept="image/jpeg,image/png"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => handleFileChange(e.target.files?.[0])}
      />

      <DialogHeader className="shrink-0 px-4 sm:px-6 pt-4 sm:pt-5 pb-3 sm:pb-4 border-b border-border/80">
        <div className="min-w-0 pr-10 sm:pr-8">
          <DialogTitle className="text-base sm:text-lg font-semibold text-foreground truncate">
            Send worksheet photo
          </DialogTitle>
          <DialogDescription className="sr-only">
            Submitting for {childName}
          </DialogDescription>
        </div>

        {/* 3-Step Interactive Progress Stepper */}
        <nav aria-label="Upload progress" className="mt-3 sm:mt-3.5 w-full">
          <p className="sr-only" aria-live="polite" aria-atomic="true">
            {stepAnnouncement}
          </p>
          {(() => {
            const activeSteps = !allowActivitySwitch
              ? STEPS.filter((s) => s.step !== 1)
              : STEPS;
            return (
              <ol className="flex items-center justify-between gap-1.5 sm:gap-2 w-full">
                {activeSteps.map((s, idx) => {
                  const isCurrent = step === s.step;
                  const isCompleted = step > s.step || step === 5;
                  const canJump = isStepNavigable(s.step as Step) && !isUploading && step !== 5;
                  const stepNumber = !allowActivitySwitch ? idx + 1 : s.step;

                  return (
                    <li
                      key={s.step}
                      className={`flex items-center gap-1.5 sm:gap-2 min-w-0 ${idx < activeSteps.length - 1 ? "flex-1" : ""
                        }`}
                      aria-current={isCurrent ? "step" : undefined}
                    >
                      {canJump && !isCurrent ? (
                        <button
                          type="button"
                          onClick={() => setStep(s.step as Step)}
                          aria-label={`${s.label} — Step ${stepNumber}${isCompleted ? ", completed" : ""}`}
                          className="group flex items-center gap-1.5 sm:gap-2 min-w-0 min-h-11 sm:min-h-9 p-1 -m-1 rounded-lg transition-colors hover:bg-muted/80 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary text-left cursor-pointer touch-manipulation"
                        >
                          <span
                            className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-transform ${isCompleted
                              ? "bg-primary text-primary-foreground group-hover:bg-primary/90 group-hover:scale-105"
                              : "bg-muted text-muted-foreground group-hover:bg-primary/20 group-hover:text-primary"
                              }`}
                          >
                            {isCompleted ? (
                              <CheckIcon className="size-3.5" aria-hidden="true" />
                            ) : (
                              stepNumber
                            )}
                          </span>
                          <span className="text-xs sm:text-sm truncate font-medium text-foreground group-hover:text-primary transition-colors">
                            {s.label}
                          </span>
                        </button>
                      ) : (
                        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                          <div
                            className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors ${isCompleted
                              ? "bg-primary text-primary-foreground"
                              : isCurrent
                                ? "bg-primary/15 text-primary ring-2 ring-primary ring-offset-2 ring-offset-background"
                                : "bg-muted text-muted-foreground"
                              }`}
                          >
                            {isCompleted ? (
                              <CheckIcon className="size-3.5" aria-hidden="true" />
                            ) : (
                              stepNumber
                            )}
                          </div>
                          <span
                            className={`text-xs sm:text-sm truncate font-medium ${isCurrent
                              ? "text-foreground font-semibold"
                              : isCompleted
                                ? "text-foreground"
                                : "text-muted-foreground"
                              }`}
                          >
                            {s.label}
                          </span>
                        </div>
                      )}

                      {idx < activeSteps.length - 1 && (
                        <div
                          className={`h-0.5 flex-1 rounded-full transition-colors ${step > s.step || step === 5 ? "bg-primary" : "bg-muted"
                            }`}
                          aria-hidden="true"
                        />
                      )}
                    </li>
                  );
                })}
              </ol>
            );
          })()}
        </nav>
      </DialogHeader>

      <div className="flex-1 min-h-0 px-4 sm:px-6 py-4 overflow-y-auto overscroll-contain">
        {activitiesError && step !== 5 && (
          <QueryRecovery
            title="Could not load practice worksheets"
            description={assignedActivities
              ? "Your saved worksheets are still shown. Try again to check for assignment updates."
              : "Check your connection and try again to choose a worksheet for this photo."}
            onRetry={() => { void refetchActivities(); }}
            isRetrying={activitiesFetching}
          />
        )}
        {/* Step 4 — Uploading / Analyzing state */}
        {isUploading ? (
          <div
            aria-busy="true"
            aria-live="polite"
            aria-atomic="true"
            className="flex flex-col items-center justify-center py-10 space-y-3.5 text-center min-h-[160px]"
          >
            <Loader2Icon
              className="size-8 animate-spin text-primary"
              aria-hidden="true"
            />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground tracking-tight">
                {UPLOAD_STAGES[uploadStage]?.title ?? UPLOAD_STAGES[0].title}
              </p>
              <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                {UPLOAD_STAGES[uploadStage]?.detail ?? UPLOAD_STAGES[0].detail}
              </p>
            </div>
          </div>
        ) : isWaitingForSelectedActivity ? (
          <div
            role="status"
            aria-live="polite"
            className="flex flex-col items-center justify-center py-10 gap-3 text-center min-h-[180px]"
          >
            <Loader2Icon
              className="size-6 animate-spin text-primary"
              aria-hidden="true"
            />
            <p className="text-sm text-muted-foreground">
              Checking worksheet availability…
            </p>
          </div>
        ) : isUnavailableSelection ? (
          <div
            role="alert"
            className="rounded-xl border border-warning/35 bg-warning/10 p-4 sm:p-5 space-y-2 text-sm"
          >
            <p className="font-semibold text-foreground">
              This worksheet is no longer open for uploads
            </p>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Its deadline may have passed, or it may no longer be assigned to {childName}.
              {activities && activities.length > 0
                ? " You can pick another open worksheet below."
                : " Closed worksheets remain visible on your child's progress page."}
            </p>
          </div>
        ) : activitiesError && !assignedActivities && step !== 5 ? null : (
          <div className="space-y-4">
            {/* Step 1 — Select Take-Home Activity */}
            {step === 1 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-heading font-semibold text-foreground">
                    Select a practice worksheet
                  </span>
                </div>

                {activitiesLoading ? (
                  <div role="status" aria-live="polite" className="flex items-center justify-center gap-2 py-8">
                    <Loader2Icon
                      className="size-5 animate-spin text-muted-foreground"
                      aria-hidden="true"
                    />
                    <span className="sr-only">Loading practice worksheets…</span>
                  </div>
                ) : !activities || activities.length === 0 ? (
                  <div className="p-6 rounded-xl border border-dashed text-center space-y-2">
                    <BookOpen
                      className="size-8 text-muted-foreground mx-auto"
                      aria-hidden="true"
                    />
                    <p className="text-sm font-medium text-foreground">
                      No practice worksheets open
                    </p>
                    <p className="text-xs text-muted-foreground">
                      There are no open practice worksheets right now. Past worksheets remain on your child&apos;s Practice tab.
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-2.5">
                    {activities.map((act) => {
                      const isSelected = selectedActivityId === act.id;
                      const status = getParentActivityStatus(act, now);
                      const statusBadge = status.urgency === "teacher_returned"
                        ? { label: "New photo requested", className: "text-primary font-semibold" }
                        : status.urgency === "retake_needed"
                          ? { label: "Clearer photo needed", className: "text-warning-foreground font-semibold" }
                          : status.urgency === "overdue"
                            ? { label: "Past due", className: "text-band-1-text font-semibold" }
                            : status.urgency === "due_soon"
                              ? { label: "Due soon", className: "text-band-2-text font-semibold" }
                            : status.processing
                              ? { label: "Checking photo…", className: "text-muted-foreground font-medium" }
                              : status.category === "submitted" && !status.excused
                                ? { label: "Photo sent · Replace if needed", className: "text-brand-700 dark:text-brand-300 font-medium" }
                                : status.excused
                                  ? { label: "Excused · Optional", className: "text-muted-foreground font-medium" }
                                  : null;

                      return (
                        <button
                          key={act.id}
                          type="button"
                          onClick={() => {
                            setSelectedActivityId(act.id);
                            setStep(2);
                          }}
                          className={`flex flex-col text-left p-3.5 rounded-xl border transition-colors text-xs sm:text-sm cursor-pointer shadow-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary ${isSelected
                            ? "border-primary bg-primary/5 ring-1 ring-primary"
                            : "border-border/80 bg-card hover:border-primary/60 hover:bg-muted/30"
                            }`}
                        >
                          <span className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-foreground line-clamp-2">
                              {act.title}
                            </span>
                            {isSelected && (
                              <CheckCircle2Icon
                                className="size-4 text-primary shrink-0"
                                aria-hidden="true"
                              />
                            )}
                          </span>
                          {act.targetText && (
                            <span className="mt-0.5 text-xs text-muted-foreground italic line-clamp-1">
                              &ldquo;{act.targetText}&rdquo;
                            </span>
                          )}
                          <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground font-sans tabular-nums">
                            {statusBadge && (
                              <>
                                <span className={statusBadge.className}>
                                  {statusBadge.label}
                                </span>
                                <span aria-hidden="true" className="text-muted-foreground/40">·</span>
                              </>
                            )}
                            <span>
                              {act.dueAt
                                ? `Due ${formatActivityDueAt(act.dueAt)}`
                                : `Assigned ${formatActivityDate(act.createdAt)}`}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Step 2 — Capture or Select Photo */}
            {step === 2 && (
              <>
                {/* Context Header: Active Child & Worksheet */}
                <div className="p-3 rounded-xl bg-muted/40 border border-border/80 text-xs">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 space-y-0.5">
                      <div className="font-semibold text-foreground break-words">
                        <span>{childName}</span>
                        <span className="text-muted-foreground font-normal"> · </span>
                        <span>{selectedActivity?.title ?? "Practice worksheet"}</span>
                      </div>
                      {selectedActivity?.targetText && (
                        <p className="text-muted-foreground italic font-sans break-words leading-relaxed">
                          &ldquo;{selectedActivity.targetText}&rdquo;
                        </p>
                      )}
                    </div>
                    {activities && activities.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          setAllowActivitySwitch(true);
                          setStep(1);
                        }}
                        className="inline-flex min-h-10 sm:min-h-9 items-center px-2 -my-1 text-xs text-primary font-medium hover:underline shrink-0 cursor-pointer rounded-md focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        Change worksheet
                      </button>
                    )}
                  </div>
                </div>

                {/* Reassurance banner for re-attempts */}
                {priorSubmission?.status === "completed" && (
                  <div className="flex items-center gap-2 p-2.5 px-3 rounded-xl bg-brand-50/80 dark:bg-brand-950/40 border border-brand-200/70 dark:border-brand-800/50 text-xs text-brand-900 dark:text-brand-200">
                    <CheckCircle2Icon
                      className="size-4 shrink-0 text-brand-600 dark:text-brand-400"
                      aria-hidden="true"
                    />
                    <span>
                      <strong>New attempt</strong> — earlier photos stay saved in history.
                    </span>
                  </div>
                )}

                {/* Persistent Retake Guidance Banner */}
                {lastRetakeTip && (
                  <div className="flex items-start gap-2.5 p-3 rounded-xl bg-warning/10 border border-warning/25 text-foreground text-xs animate-in fade-in-50 duration-200">
                    <LightbulbIcon className="size-4 text-warning shrink-0 mt-0.5" aria-hidden="true" />
                    <div className="flex-1 space-y-0.5">
                      <p className="font-semibold text-foreground">
                        Tip for this retake{lastRetakeTip.badgeLabel ? ` (${lastRetakeTip.badgeLabel})` : ""}:
                      </p>
                      <p className="text-muted-foreground leading-relaxed">{lastRetakeTip.tip}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setLastRetakeTip(null)}
                      className="inline-flex size-11 sm:size-9 items-center justify-center text-muted-foreground hover:text-foreground shrink-0 rounded cursor-pointer touch-manipulation focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      aria-label="Dismiss tip"
                    >
                      <XIcon className="size-3.5" aria-hidden="true" />
                    </button>
                  </div>
                )}

                {/* Dropzone Container */}
                <div
                  role="region"
                  aria-label="Worksheet photo upload dropzone"
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    handleFileChange(e.dataTransfer.files?.[0]);
                  }}
                  className={`flex flex-col items-center justify-center p-6 sm:p-8 rounded-2xl border-2 border-dashed transition-[border-color,background-color,transform] text-center shadow-warm ${isDragging
                    ? "border-primary bg-primary/5 scale-[0.99]"
                    : "border-border bg-card hover:border-primary/60 hover:bg-muted/10"
                    }`}
                >
                  <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-2.5">
                    {isMobile ? (
                      <CameraIcon className="size-6" aria-hidden="true" />
                    ) : (
                      <UploadCloudIcon className="size-6" aria-hidden="true" />
                    )}
                  </div>
                  <p className="text-sm sm:text-base font-semibold text-foreground">
                    {isMobile
                      ? "Capture or upload worksheet photo"
                      : "Upload worksheet photo"}
                  </p>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                    {isMobile
                      ? "JPEG or PNG, up to 15 MB"
                      : "JPEG or PNG, up to 15 MB · Drag & drop or browse"}
                  </p>

                  {/* Action Triggers */}
                  {isMobile ? (
                    <div className="grid grid-cols-1 min-[480px]:grid-cols-2 gap-2 w-full max-w-xs mt-4">
                      <Button
                        ref={choosePhotoButtonRef}
                        type="button"
                        variant="default"
                        className="h-10 sm:h-9 text-xs sm:text-sm font-medium gap-1.5 w-full shadow-warm cursor-pointer"
                        onClick={() => cameraInputRef.current?.click()}
                      >
                        <CameraIcon className="size-3.5" aria-hidden="true" />
                        Take photo
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-10 sm:h-9 text-xs sm:text-sm font-medium gap-1.5 w-full bg-background hover:bg-muted cursor-pointer"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <FileImageIcon
                          className="size-3.5 text-muted-foreground"
                          aria-hidden="true"
                        />
                        Photo library
                      </Button>
                    </div>
                  ) : (
                    <div className="w-full max-w-xs mt-4">
                      <Button
                        ref={choosePhotoButtonRef}
                        type="button"
                        variant="default"
                        className="h-10 sm:h-9 text-xs sm:text-sm font-medium gap-1.5 w-full shadow-warm cursor-pointer"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <FileImageIcon className="size-3.5" aria-hidden="true" />
                        Browse Files
                      </Button>
                    </div>
                  )}
                </div>

                {/* Inline Dropzone Error Alert */}
                {dropError && (
                  <div
                    role="alert"
                    className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-xs text-destructive flex items-center justify-between gap-2"
                  >
                    <span>{dropError}</span>
                    <button
                      type="button"
                      onClick={() => setDropError(null)}
                      className="inline-flex items-center justify-center min-h-10 sm:min-h-9 px-2 -my-1 rounded-md font-semibold underline shrink-0 cursor-pointer touch-manipulation focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-destructive"
                    >
                      Dismiss
                    </button>
                  </div>
                )}

                {/* Subtle Privacy Notice Footnote (Clean Typography, No Decorative Icon) */}
                <p className="text-center text-xs text-muted-foreground pt-1">
                  Location &amp; device metadata stripped automatically for student privacy
                </p>

                {/* Streamlined Photo Quality Guide (2x2 Micro-card Grid) */}
                <div className="rounded-xl bg-muted/30 overflow-hidden text-xs">
                  <button
                    type="button"
                    onClick={() => setShowTips((prev) => !prev)}
                    className="w-full min-h-10 sm:min-h-9 flex items-center justify-between px-4 py-2 hover:bg-muted/50 transition-colors text-left font-medium text-foreground cursor-pointer touch-manipulation focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
                    aria-expanded={showTips}
                    aria-controls={photoTipsId}
                  >
                    <span className="text-xs sm:text-sm font-semibold">
                      Photo quality tips
                    </span>
                    <span className="flex items-center gap-1 text-muted-foreground text-xs font-medium">
                      <span>{showTips ? "Hide tips" : "Show tips"}</span>
                      <ChevronDownIcon
                        className={`size-3.5 transition-transform duration-200 ${showTips ? "rotate-180" : ""
                          }`}
                        aria-hidden="true"
                      />
                    </span>
                  </button>
                  {showTips && (
                    <div
                      id={photoTipsId}
                      className="px-3.5 pb-3.5 pt-1.5 border-t border-border/40 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs animate-in fade-in-50 duration-150 motion-reduce:animate-none"
                    >
                      <div className="p-2.5 rounded-lg bg-background/60 dark:bg-muted/30 space-y-0.5">
                        <p className="font-semibold text-foreground text-xs sm:text-sm">
                          1. 3-line penmanship paper
                        </p>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Use standard 3-line paper with top line, midline, and baseline clearly visible.
                        </p>
                      </div>
                      <div className="p-2.5 rounded-lg bg-background/60 dark:bg-muted/30 space-y-0.5">
                        <p className="font-semibold text-foreground text-xs sm:text-sm">
                          2. Connected cursive
                        </p>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Words must be written in connected cursive strokes, not separated print letters.
                        </p>
                      </div>
                      <div className="p-2.5 rounded-lg bg-background/60 dark:bg-muted/30 space-y-0.5">
                        <p className="font-semibold text-foreground text-xs sm:text-sm">
                          3. Flat paper &amp; even light
                        </p>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Hold your phone straight above the page. Avoid strong glare, shadows, or camera angles.
                        </p>
                      </div>
                      <div className="p-2.5 rounded-lg bg-background/60 dark:bg-muted/30 space-y-0.5">
                        <p className="font-semibold text-foreground text-xs sm:text-sm">
                          4. Sharp focus
                        </p>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Tap your phone screen on the ink before snapping so writing lines stay crisp.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Step 3 — Review & Confirm */}
            {step === 3 && selectedFile && (
              <>
                {/* Context Header: Active Child & Worksheet */}
                <div className="p-3 rounded-xl bg-muted/40 border border-border/80 text-xs">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 space-y-0.5">
                      <div className="font-semibold text-foreground break-words">
                        <span>{childName}</span>
                        <span className="text-muted-foreground font-normal"> · </span>
                        <span>{selectedActivity?.title ?? "Practice worksheet"}</span>
                      </div>
                      {selectedActivity?.targetText && (
                        <p className="text-muted-foreground italic font-sans break-words leading-relaxed">
                          &ldquo;{selectedActivity.targetText}&rdquo;
                        </p>
                      )}
                    </div>
                    {activities && activities.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          setAllowActivitySwitch(true);
                          setStep(1);
                        }}
                        className="inline-flex min-h-10 sm:min-h-9 items-center px-2 -my-1 text-xs text-primary font-medium hover:underline shrink-0 cursor-pointer rounded-md focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        Change worksheet
                      </button>
                    )}
                  </div>
                </div>

                {/* Reassurance banner for re-attempts */}
                {priorSubmission?.status === "completed" && (
                  <div className="flex items-center gap-2 p-2.5 px-3 rounded-xl bg-brand-50/80 dark:bg-brand-950/40 border border-brand-200/70 dark:border-brand-800/50 text-xs text-brand-900 dark:text-brand-200">
                    <CheckCircle2Icon
                      className="size-4 shrink-0 text-brand-600 dark:text-brand-400"
                      aria-hidden="true"
                    />
                    <span>
                      <strong>New attempt</strong> — earlier photos stay saved in history.
                    </span>
                  </div>
                )}

                {/* File Inspection Card */}
                <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="truncate min-w-0">
                      <p className="text-sm font-semibold truncate text-foreground">
                        Worksheet photo ready
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <p className="text-xs text-muted-foreground font-sans tabular-nums">
                          {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                        </p>
                        {rotationDegrees > 0 && (
                          <Badge
                            variant="outline"
                            className="text-xs h-5 px-1.5 font-medium font-sans tabular-nums border-primary/30 text-primary bg-primary/5"
                          >
                            Rotated {rotationDegrees}°
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-10 sm:h-9 text-xs font-medium cursor-pointer gap-1.5 px-3"
                        onClick={handleRotateClockwise}
                        disabled={isRotating}
                        aria-label="Rotate photo 90 degrees clockwise"
                      >
                        <RotateCwIcon
                          className={`size-3.5 ${isRotating ? "animate-spin" : ""}`}
                          aria-hidden="true"
                        />
                        <span>Rotate</span>
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-10 sm:h-9 text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer gap-1.5 px-2.5"
                        onClick={handleClearFile}
                        aria-label="Remove photo and take another"
                      >
                        <XIcon className="size-3.5" aria-hidden="true" />
                        <span>Retake</span>
                      </Button>
                    </div>
                  </div>

                  {previewUrl && (
                    <button
                      type="button"
                      onClick={() => setZoomOpen(true)}
                      aria-label="Inspect worksheet photo full size before sending"
                      className={`group relative w-full rounded-xl overflow-hidden bg-muted/40 border border-border flex items-center justify-center touch-pan-y cursor-zoom-in focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary ${isPortrait
                        ? "aspect-3/4 max-h-[240px] sm:max-h-[400px]"
                        : "aspect-4/3 max-h-[220px] sm:max-h-[340px]"
                        }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={previewUrl}
                        alt={`Handwriting worksheet preview for ${childName}`}
                        draggable={false}
                        onLoad={(e) => {
                          const img = e.currentTarget;
                          setIsPortrait(img.naturalHeight >= img.naturalWidth);
                        }}
                        className="size-full object-contain pointer-events-none select-none"
                      />
                      <span className="absolute bottom-2.5 right-2.5 inline-flex items-center gap-1 rounded-full bg-background/90 backdrop-blur-xs border border-border/80 px-2.5 py-1 text-xs font-medium text-foreground shadow-warm-sm group-hover:bg-background">
                        <ZoomInIcon className="size-3.5 text-primary" aria-hidden="true" />
                        <span>Tap to zoom</span>
                      </span>
                    </button>
                  )}
                </div>

                {previewUrl && (
                  <Dialog open={zoomOpen} onOpenChange={setZoomOpen}>
                    <DialogContent className="max-w-3xl max-h-[92dvh] p-0 overflow-hidden flex flex-col">
                      <DialogHeader className="p-4 border-b border-border/70 pr-12">
                        <DialogTitle className="text-base font-semibold text-foreground">
                          Check photo sharpness
                        </DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground">
                          Make sure 3-line rulings, cursive strokes, and all 4 corners are crisp before sending.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="flex-1 overflow-auto p-4 bg-muted/20 flex items-center justify-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={previewUrl}
                          alt={`Full-size handwriting preview for ${childName}`}
                          className="w-full h-auto max-h-[72dvh] object-contain rounded-lg border border-border"
                        />
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </>
            )}

            {/* Inline error card with rich quality feedback (step 4 failure) */}
            {step === 4 && uploadError && (
              <QualityErrorCard
                variant="parent"
                error={uploadError}
                previewUrl={previewUrl}
                retryRef={retryButtonRef}
                onRetake={handleRetakePhoto}
                onRetry={handleRetryUpload}
              />
            )}

            {/* Step 5 — Success State */}
            {step === 5 && (
              <div className="flex flex-col items-center justify-center py-6 text-center space-y-4 animate-in fade-in-50 zoom-in-95 duration-200 motion-reduce:animate-none">
                <div className="flex size-14 sm:size-16 items-center justify-center rounded-2xl bg-success/10 text-success border border-success/20 shadow-warm">
                  <CheckCircle2Icon className="size-8 sm:size-9" aria-hidden="true" />
                </div>

                <div className="space-y-1.5 max-w-sm">
                  <h3 className="text-base sm:text-lg font-semibold text-foreground tracking-tight font-heading">
                    Photo received—waiting for teacher review
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    The cursive sample for{" "}
                    <strong className="text-foreground font-medium">{childName}</strong>{" "}
                    has been received. Your teacher reviews every result before you see it, so feedback appears here once it&apos;s released.
                  </p>
                </div>

                <div className="pt-2 w-full max-w-xs">
                  <Button
                    ref={doneButtonRef}
                    type="button"
                    variant="default"
                    onClick={onClose}
                    className="h-11 sm:h-9 text-xs sm:text-sm font-medium w-full shadow-warm-sm cursor-pointer touch-manipulation"
                  >
                    Done
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Standardized Sticky Footer for Steps 1–3, Unavailable State, and Step 4 Error */}
      {!isUploading && (isUnavailableSelection || step <= 3 || (step === 4 && uploadError)) && (
        <div className="shrink-0 flex items-center justify-between p-3 sm:p-3.5 px-4 sm:px-6 border-t border-border bg-muted/20">
          {isUnavailableSelection ? (
            <>
              <Button
                ref={activities && activities.length > 0 ? undefined : unavailableActionRef}
                variant="outline"
                onClick={onClose}
                className="h-10 sm:h-9 px-4 text-xs sm:text-sm font-medium cursor-pointer"
              >
                Close
              </Button>
              {activities && activities.length > 0 && (
                <Button
                  ref={unavailableActionRef}
                  type="button"
                  onClick={handleChooseAnotherWorksheet}
                  className="h-10 sm:h-9 px-4 text-xs sm:text-sm font-medium cursor-pointer"
                >
                  Choose another worksheet
                </Button>
              )}
            </>
          ) : (
            <>
              {step === 4 && uploadError && (
                <Button
                  variant="outline"
                  onClick={onClose}
                  className="h-10 sm:h-9 px-4 text-xs sm:text-sm font-medium cursor-pointer"
                >
                  Cancel
                </Button>
              )}
              {step === 1 && (
                <Button
                  variant="outline"
                  onClick={onClose}
                  className="h-10 sm:h-9 px-4 text-xs sm:text-sm font-medium cursor-pointer"
                >
                  Cancel
                </Button>
              )}
              {step === 2 && (
                <Button
                  variant="outline"
                  onClick={() => {
                    if (!allowActivitySwitch) {
                      onClose();
                    } else {
                      setStep(1);
                    }
                  }}
                  className="gap-1.5 h-10 sm:h-9 px-4 text-xs sm:text-sm font-medium cursor-pointer"
                >
                  {!allowActivitySwitch ? (
                    "Cancel"
                  ) : (
                    <>
                      <ArrowLeftIcon className="size-3.5" aria-hidden="true" />
                      Back
                    </>
                  )}
                </Button>
              )}
              {step === 3 && (
                <Button
                  variant="outline"
                  onClick={() => setStep(2)}
                  className="gap-1.5 h-10 sm:h-9 px-4 text-xs sm:text-sm font-medium cursor-pointer"
                >
                  <ArrowLeftIcon className="size-3.5" aria-hidden="true" />
                  Back
                </Button>
              )}

              {step === 1 && (
                <Button
                  disabled={!selectedActivity}
                  onClick={() => setStep(2)}
                  className="gap-2 h-10 sm:h-9 px-4 text-xs sm:text-sm font-medium cursor-pointer"
                >
                  <span>Next</span>
                  <ArrowRightIcon className="size-3.5" aria-hidden="true" />
                </Button>
              )}
              {step === 3 && (
                <Button
                  ref={submitButtonRef}
                  disabled={uploadMutation.isPending || !selectedActivity}
                  onClick={handleRetryUpload}
                  className="gap-2 h-10 sm:h-9 px-5 text-xs sm:text-sm font-semibold shadow-warm-sm cursor-pointer"
                >
                  <CheckCircle2Icon className="size-4" aria-hidden="true" />
                  Send worksheet photo
                </Button>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}
