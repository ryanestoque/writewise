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
import {
  useTakeHomeActivities,
  useChildSubmissionForActivity,
} from "@/lib/hooks/use-parent-data";
import { useUploadSubmission } from "@/lib/hooks/use-submissions";
import { toast } from "sonner";
import {
  UploadCloudIcon,
  CameraIcon,
  FileImageIcon,
  CheckCircle2Icon,
  Loader2Icon,
  AlertCircleIcon,
  RotateCcwIcon,
  ShieldCheckIcon,
  ChevronDownIcon,
  LightbulbIcon,
  BookOpen,
  CheckIcon,
  Scan,
  SunMedium,
  AlignJustify,
  Focus,
  XIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
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

interface UploadError {
  code: string;
  message: string;
}

const ACCEPTED_MIME_TYPES = ["image/jpeg", "image/png"];
const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15 MB

const STEPS = [
  { step: 1, label: "Activity" },
  { step: 2, label: "Capture" },
  { step: 3, label: "Review" },
] as const;

const PROCESSING_STAGES = [
  {
    title: "Checking image quality…",
    detail: "Verifying lighting, focus, and guideline alignment.",
  },
  {
    title: "Analyzing cursive handwriting…",
    detail: "Segmenting words and measuring letter stroke geometry.",
  },
  {
    title: "Calculating diagnostic scores…",
    detail: "Evaluating consistency, slant, spacing, and baseline.",
  },
] as const;

function isQualityGateError(code: string): boolean {
  return [
    "QUALITY_GATE_RESOLUTION",
    "QUALITY_GATE_BLUR",
    "QUALITY_GATE_BRIGHTNESS",
    "QUALITY_GATE_CONTRAST",
    "QUALITY_GATE_LIGHTING",
    "QUALITY_GATE_SKEW",
    "SEGMENTATION_COUNT_MISMATCH",
    "UNSUPPORTED_FILE_TYPE",
    "FILE_TOO_LARGE",
  ].includes(code);
}

function errorMessageFor(error: UploadError): string {
  switch (error.code) {
    case "UNSUPPORTED_FILE_TYPE":
      return "That file isn't a supported image. Please choose a JPEG or PNG photo.";
    case "FILE_TOO_LARGE":
      return "The photo is too large. Please use an image file 15 MB or smaller.";
    case "NOT_FOUND":
      return "The selected activity or child record was not found. Please refresh and try again.";
    case "QUALITY_GATE_RESOLUTION":
      return "The photo needs more detail to assess cursive strokes clearly. Move a little closer and retake it.";
    case "QUALITY_GATE_BLUR":
      return "The photo is too blurry to analyze. Hold the camera steady and retake it.";
    case "QUALITY_GATE_BRIGHTNESS":
      return "The photo is too dark or washed out. Try moving to a brighter spot with even lighting.";
    case "QUALITY_GATE_CONTRAST":
      return "The pencil strokes are faint against the paper. Try adjusting the lighting or angle.";
    case "SEGMENTATION_COUNT_MISMATCH":
      return "The handwritten words couldn't be matched to the assigned sentence. Please ensure the full sentence was written.";
    case "UNAUTHORIZED":
      return "Your session has expired. Please sign in again.";
    case "FORBIDDEN":
      return "You don't have permission to upload for this activity.";
    case "MODEL_INFERENCE_ERROR":
      return "The assessment system encountered an issue. Please try submitting again shortly.";
    case "QUALITY_GATE_LIGHTING":
      return "The lighting has glare or harsh shadows. Move to a space with diffuse, even light.";
    case "QUALITY_GATE_SKEW":
      return "The worksheet is tilted or angled. Place the paper flat on a table and point the camera directly above it.";
    case "PIPELINE_ERROR":
      return "An unexpected issue occurred while processing the worksheet. Please retake the photo ensuring the entire page is flat and visible.";
    default:
      return error.message || "Upload failed. Please check your connection and try again.";
  }
}

function subscribeTouch(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  const mql = window.matchMedia("(pointer: coarse)");
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

function getTouchSnapshot() {
  if (typeof window === "undefined") return false;
  return (
    "ontouchstart" in window ||
    navigator.maxTouchPoints > 0 ||
    window.matchMedia("(pointer: coarse)").matches
  );
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
  const dropzoneRef = useRef<HTMLDivElement>(null);
  const submitButtonRef = useRef<HTMLButtonElement>(null);
  const retryButtonRef = useRef<HTMLButtonElement>(null);
  const doneButtonRef = useRef<HTMLButtonElement>(null);

  const [step, setStep] = useState<Step>(prefilledActivityId ? 2 : 1);
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(
    prefilledActivityId ?? null
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showTips, setShowTips] = useState(false);
  const [uploadError, setUploadError] = useState<UploadError | null>(null);
  const [processingStageIndex, setProcessingStageIndex] = useState(0);

  const { data: activities, isLoading: activitiesLoading } =
    useTakeHomeActivities(childId);
  const { data: priorSubmission } = useChildSubmissionForActivity(
    childId,
    selectedActivityId ?? ""
  );
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

  // Calibrated staged progress sequence while uploading (DESIGN.md §7.2)
  useEffect(() => {
    if (!isUploading) return;
    const interval = setInterval(() => {
      setProcessingStageIndex((prev) =>
        prev < PROCESSING_STAGES.length - 1 ? prev + 1 : prev
      );
    }, 2000);
    return () => {
      clearInterval(interval);
      setProcessingStageIndex(0);
    };
  }, [isUploading]);

  // Programmatic focus steering upon step transitions
  useEffect(() => {
    if (step === 2) {
      dropzoneRef.current?.focus();
    } else if (step === 3) {
      submitButtonRef.current?.focus();
    } else if (step === 4 && uploadError) {
      retryButtonRef.current?.focus();
    } else if (step === 5) {
      doneButtonRef.current?.focus();
    }
  }, [step, uploadError]);

  // Revoke object URL on unmount
  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
    };
  }, []);

  const selectedActivity = useMemo(() => {
    return activities?.find((a) => a.id === selectedActivityId) ?? null;
  }, [activities, selectedActivityId]);

  const handleClearFile = () => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setUploadError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    if (step === 3 || step === 4) {
      setStep(2);
    }
  };

  const handleRetakePhoto = () => {
    handleClearFile();
    setUploadError(null);
    setStep(2);
  };

  const handleFileChange = (file: File | undefined) => {
    if (!file) return;

    if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
      toast.error("Please select a JPEG or PNG image.");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      toast.error("Image file size must be less than 15MB.");
      return;
    }

    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
    }

    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    previewUrlRef.current = url;
    setPreviewUrl(url);
    setUploadError(null);
    setStep(3);
  };

  const handleSubmit = () => {
    if (!selectedFile || !selectedActivityId || !childId) return;

    setStep(4);
    setUploadError(null);

    uploadMutation.mutate(
      {
        image: selectedFile,
        activityId: selectedActivityId,
        studentId: childId,
      },
      {
        onSuccess: () => {
          toast.success("Worksheet uploaded successfully!");
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
          const error =
            err && typeof err === "object" && "code" in err
              ? (err as UploadError)
              : { code: "INTERNAL_ERROR", message: "Upload failed." };
          setUploadError(error);
        },
      }
    );
  };

  const isStepNavigable = (targetStep: Step): boolean => {
    if (isUploading) return false;
    if (targetStep === 1) return !prefilledActivityId;
    if (targetStep === 2) return Boolean(selectedActivityId);
    if (targetStep === 3) return Boolean(selectedActivityId && selectedFile);
    return false;
  };

  const stepAnnouncement = useMemo(() => {
    switch (step) {
      case 1:
        return "Step 1 of 3: Select Take-Home Activity";
      case 2:
        return "Step 2 of 3: Capture or Choose Photo";
      case 3:
        return "Step 3 of 3: Review and Confirm Submission";
      case 4:
        return "Step 4: Analyzing handwriting";
      case 5:
        return "Step 5: Assessment completed";
      default:
        return "";
    }
  }, [step]);

  return (
    <>
      <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-5 pb-3 sm:pb-4 border-b border-border/80 pr-12">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
            <UploadCloudIcon className="size-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <DialogTitle className="text-base sm:text-lg font-semibold text-foreground truncate">
              Upload Worksheet
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm text-muted-foreground mt-0.5 truncate">
              Submitting for <span className="font-medium text-foreground">{childName}</span>
            </DialogDescription>
          </div>
        </div>

        {/* 3-Step Interactive Progress Stepper */}
        <nav aria-label="Upload progress" className="mt-3 sm:mt-3.5">
          <p className="sr-only" aria-live="polite" aria-atomic="true">
            {stepAnnouncement}
          </p>
          <ol className="flex items-center justify-between gap-1.5 sm:gap-2 w-full">
            {STEPS.map((s) => {
              const isCurrent = step === s.step;
              const isCompleted = step > s.step || step === 5;
              const canJump = isStepNavigable(s.step as Step) && !isUploading && step !== 5;

              return (
                <li
                  key={s.step}
                  className={`flex items-center gap-1.5 sm:gap-2 min-w-0 ${
                    s.step < STEPS.length ? "flex-1" : ""
                  }`}
                  aria-current={isCurrent ? "step" : undefined}
                >
                  {canJump && !isCurrent ? (
                    <button
                      type="button"
                      onClick={() => setStep(s.step as Step)}
                      aria-label={`${s.label} — Step ${s.step}, completed`}
                      className="group flex items-center gap-1.5 sm:gap-2 min-w-0 p-1 -m-1 rounded-lg transition-colors hover:bg-muted/80 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary text-left cursor-pointer"
                    >
                      <div
                        className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-all ${
                          isCompleted
                            ? "bg-primary text-primary-foreground group-hover:bg-primary/90 group-hover:scale-105"
                            : "bg-muted text-muted-foreground group-hover:bg-primary/20 group-hover:text-primary"
                        }`}
                      >
                        {isCompleted ? (
                          <CheckIcon className="size-3.5" aria-hidden="true" />
                        ) : (
                          s.step
                        )}
                      </div>
                      <span className="text-xs sm:text-sm truncate font-medium text-foreground group-hover:text-primary transition-colors">
                        {s.label}
                      </span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                      <div
                        className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                          isCompleted
                            ? "bg-primary text-primary-foreground"
                            : isCurrent
                            ? "bg-primary/15 text-primary ring-2 ring-primary ring-offset-2 ring-offset-background"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {isCompleted ? (
                          <CheckIcon className="size-3.5" aria-hidden="true" />
                        ) : (
                          s.step
                        )}
                      </div>
                      <span
                        className={`text-xs sm:text-sm truncate font-medium ${
                          isCurrent
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

                  {s.step < STEPS.length && (
                    <div
                      className={`h-0.5 flex-1 rounded-full transition-colors ${
                        step > s.step || step === 5 ? "bg-primary" : "bg-muted"
                      }`}
                      aria-hidden="true"
                    />
                  )}
                </li>
              );
            })}
          </ol>
        </nav>
      </DialogHeader>

      <div className="px-4 sm:px-6 py-4 max-h-[min(72dvh,calc(100vh-10rem))] overflow-y-auto overscroll-contain">
        {/* Step 4 — Uploading / Analyzing state */}
        {isUploading ? (
          <div
            aria-busy="true"
            aria-live="polite"
            aria-atomic="true"
            className="flex flex-col items-center justify-center py-10 space-y-3.5 text-center min-h-[160px]"
          >
            <Loader2Icon
              className="size-8 animate-spin text-primary motion-reduce:animate-none"
              aria-hidden="true"
            />
            <div className="space-y-1 transition-all duration-200">
              <p className="text-sm font-semibold text-foreground tracking-tight">
                {PROCESSING_STAGES[processingStageIndex].title}
              </p>
              <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                {PROCESSING_STAGES[processingStageIndex].detail}
              </p>
            </div>
            <div className="flex items-center gap-1.5 pt-2" aria-hidden="true">
              {PROCESSING_STAGES.map((_, idx) => (
                <span
                  key={idx}
                  className={`size-1.5 rounded-full transition-all duration-300 ${
                    idx === processingStageIndex
                      ? "bg-primary w-4"
                      : idx < processingStageIndex
                      ? "bg-primary/50"
                      : "bg-muted-foreground/30"
                  }`}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Step 1 — Select Take-Home Activity */}
            {step === 1 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Select Assigned Take-Home Activity
                  </span>
                </div>

                {activitiesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2Icon
                      className="size-5 animate-spin motion-reduce:animate-none text-muted-foreground"
                      aria-hidden="true"
                    />
                  </div>
                ) : !activities || activities.length === 0 ? (
                  <div className="p-6 rounded-xl border border-dashed text-center space-y-2">
                    <BookOpen
                      className="size-8 text-muted-foreground mx-auto"
                      aria-hidden="true"
                    />
                    <p className="text-sm font-medium text-foreground">
                      No take-home activities available
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Your teacher has not assigned any home practice worksheets yet.
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-2.5">
                    {activities.map((act) => {
                      const isSelected = selectedActivityId === act.id;
                      return (
                        <button
                          key={act.id}
                          type="button"
                          onClick={() => {
                            setSelectedActivityId(act.id);
                            setStep(2);
                          }}
                          className={`flex flex-col text-left p-3.5 rounded-xl border transition-all text-xs sm:text-sm cursor-pointer shadow-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary ${
                            isSelected
                              ? "border-primary bg-primary/5 ring-1 ring-primary"
                              : "border-border/80 bg-card hover:border-primary/60 hover:bg-muted/30"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-foreground line-clamp-2">
                              &ldquo;{act.targetText}&rdquo;
                            </span>
                            {isSelected && (
                              <CheckCircle2Icon
                                className="size-4 text-primary shrink-0"
                                aria-hidden="true"
                              />
                            )}
                          </div>
                          <span className="text-[11px] text-muted-foreground mt-1">
                            Assigned on{" "}
                            {new Date(act.createdAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
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
                {/* Context Header: Active Child & Activity */}
                <div className="flex items-center justify-between gap-2 p-2.5 px-3 rounded-xl bg-muted/40 border border-border/80 text-xs">
                  <div className="flex items-center gap-1.5 min-w-0 truncate">
                    <span className="font-semibold text-foreground truncate">
                      {childName}
                    </span>
                    <span className="text-muted-foreground shrink-0">&middot;</span>
                    <span className="text-muted-foreground truncate font-medium">
                      {selectedActivity?.targetText ?? "Take-Home Activity"}
                    </span>
                  </div>
                  {!prefilledActivityId && (
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="text-xs text-primary font-medium hover:underline shrink-0 cursor-pointer"
                    >
                      Change
                    </button>
                  )}
                </div>

                {/* Reassurance banner for re-attempts */}
                {priorSubmission?.status === "completed" && (
                  <div className="flex items-center gap-2 p-2.5 px-3 rounded-xl bg-brand-50/80 dark:bg-brand-950/40 border border-brand-200/70 dark:border-brand-800/50 text-[11px] sm:text-xs text-brand-900 dark:text-brand-200">
                    <CheckCircle2Icon
                      className="size-4 shrink-0 text-brand-600 dark:text-brand-400"
                      aria-hidden="true"
                    />
                    <span>
                      <strong>New attempt:</strong> Submitting a new photo records an updated assessment while keeping earlier scores safely archived in your child&apos;s history.
                    </span>
                  </div>
                )}

                {/* Hidden File Inputs */}
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

                {/* Interactive Dropzone with Keyboard Activation */}
                <div
                  ref={dropzoneRef}
                  role="button"
                  tabIndex={0}
                  aria-label={
                    isMobile
                      ? "Worksheet photo upload dropzone. Take a photo or choose from library."
                      : "Worksheet photo upload dropzone. Drop an image or press Enter or Space to choose a file."
                  }
                  onClick={() => fileInputRef.current?.click()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      fileInputRef.current?.click();
                    }
                  }}
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
                  className={`flex flex-col items-center justify-center p-6 sm:p-8 rounded-2xl border-2 border-dashed transition-all text-center cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 shadow-warm ${
                    isDragging
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
                      ? "Supports JPEG or PNG (up to 15MB) · Take a photo or choose from library"
                      : "Supports JPEG or PNG (up to 15MB) · Drag & drop or browse"}
                  </p>

                  {/* Mobile Camera / Library Action Triggers */}
                  {isMobile ? (
                    <div className="grid grid-cols-1 min-[480px]:grid-cols-2 gap-2 w-full max-w-xs mt-4">
                      <Button
                        type="button"
                        variant="default"
                        className="h-10 sm:h-9 text-xs sm:text-sm font-medium gap-1.5 w-full shadow-warm cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          cameraInputRef.current?.click();
                        }}
                      >
                        <CameraIcon className="size-3.5" aria-hidden="true" />
                        Take Photo
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-10 sm:h-9 text-xs sm:text-sm font-medium gap-1.5 w-full bg-background hover:bg-muted cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          fileInputRef.current?.click();
                        }}
                      >
                        <FileImageIcon
                          className="size-3.5 text-muted-foreground"
                          aria-hidden="true"
                        />
                        Photo Library
                      </Button>
                    </div>
                  ) : (
                    <div className="w-full max-w-xs mt-4">
                      <Button
                        type="button"
                        variant="default"
                        className="h-10 sm:h-9 text-xs sm:text-sm font-medium gap-1.5 w-full shadow-warm cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          fileInputRef.current?.click();
                        }}
                      >
                        <FileImageIcon className="size-3.5" aria-hidden="true" />
                        Browse Files
                      </Button>
                    </div>
                  )}
                </div>

                {/* Subtle Privacy Notice Footnote */}
                <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground pt-0.5">
                  <ShieldCheckIcon
                    className="size-4 text-primary/70 shrink-0"
                    aria-hidden="true"
                  />
                  <span>
                    Location &amp; device metadata stripped automatically for student privacy
                  </span>
                </div>

                {/* Streamlined Photo Quality Guide (2x2 Micro-card Grid) */}
                <div className="rounded-xl bg-muted/30 overflow-hidden text-xs">
                  <button
                    type="button"
                    onClick={() => setShowTips((prev) => !prev)}
                    className="w-full flex items-center justify-between px-3.5 py-2.5 hover:bg-muted/50 transition-colors text-left font-medium text-foreground cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
                    aria-expanded={showTips}
                    aria-controls={photoTipsId}
                  >
                    <div className="flex items-center gap-2">
                      <LightbulbIcon
                        className="size-4 text-primary shrink-0"
                        aria-hidden="true"
                      />
                      <span className="text-xs sm:text-sm font-semibold">
                        Photo quality tips
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground text-xs font-medium">
                      <span>{showTips ? "Hide tips" : "Show tips"}</span>
                      <ChevronDownIcon
                        className={`size-3.5 transition-transform duration-200 ${
                          showTips ? "rotate-180" : ""
                        }`}
                        aria-hidden="true"
                      />
                    </div>
                  </button>
                  {showTips && (
                    <div
                      id={photoTipsId}
                      className="px-3.5 pb-3.5 pt-1.5 border-t border-border/40 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs animate-in fade-in-50 duration-150 motion-reduce:animate-none"
                    >
                      <div className="flex items-start gap-2.5 p-2 rounded-lg bg-background/60 dark:bg-muted/30">
                        <Scan
                          className="size-4 text-primary shrink-0 mt-0.5"
                          aria-hidden="true"
                        />
                        <div>
                          <p className="font-semibold text-foreground text-xs sm:text-sm">
                            90° Overhead Angle
                          </p>
                          <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                            Hold camera flat directly above the paper.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2.5 p-2 rounded-lg bg-background/60 dark:bg-muted/30">
                        <SunMedium
                          className="size-4 text-primary shrink-0 mt-0.5"
                          aria-hidden="true"
                        />
                        <div>
                          <p className="font-semibold text-foreground text-xs sm:text-sm">
                            Even Light
                          </p>
                          <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                            Avoid shadows and strong glare on words.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2.5 p-2 rounded-lg bg-background/60 dark:bg-muted/30">
                        <AlignJustify
                          className="size-4 text-primary shrink-0 mt-0.5"
                          aria-hidden="true"
                        />
                        <div>
                          <p className="font-semibold text-foreground text-xs sm:text-sm">
                            Clear Ruling
                          </p>
                          <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                            Keep headline, midline &amp; baseline visible.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2.5 p-2 rounded-lg bg-background/60 dark:bg-muted/30">
                        <Focus
                          className="size-4 text-primary shrink-0 mt-0.5"
                          aria-hidden="true"
                        />
                        <div>
                          <p className="font-semibold text-foreground text-xs sm:text-sm">
                            Sharp Focus
                          </p>
                          <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                            Tap screen on cursive ink before snapping.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Step 3 — Review & Confirm */}
            {step === 3 && selectedFile && (
              <>
                {/* Context Header: Active Child & Activity */}
                <div className="flex items-center justify-between gap-2 p-2.5 px-3 rounded-xl bg-muted/40 border border-border/80 text-xs">
                  <div className="flex items-center gap-1.5 min-w-0 truncate">
                    <span className="font-semibold text-foreground truncate">
                      {childName}
                    </span>
                    <span className="text-muted-foreground shrink-0">&middot;</span>
                    <span className="text-muted-foreground truncate font-medium">
                      {selectedActivity?.targetText ?? "Take-Home Activity"}
                    </span>
                  </div>
                </div>

                {/* Reassurance banner for re-attempts */}
                {priorSubmission?.status === "completed" && (
                  <div className="flex items-center gap-2 p-2.5 px-3 rounded-xl bg-brand-50/80 dark:bg-brand-950/40 border border-brand-200/70 dark:border-brand-800/50 text-[11px] sm:text-xs text-brand-900 dark:text-brand-200">
                    <CheckCircle2Icon
                      className="size-4 shrink-0 text-brand-600 dark:text-brand-400"
                      aria-hidden="true"
                    />
                    <span>
                      <strong>New attempt:</strong> Submitting a new photo records an updated assessment while keeping earlier scores safely archived in your child&apos;s history.
                    </span>
                  </div>
                )}

                {/* File Inspection Card */}
                <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FileImageIcon
                        className="size-5 text-primary shrink-0"
                        aria-hidden="true"
                      />
                      <div className="truncate">
                        <p className="text-sm font-semibold truncate text-foreground">
                          {selectedFile.name}
                        </p>
                        <p className="text-xs text-muted-foreground font-mono tabular-nums">
                          {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-10 sm:size-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
                      onClick={handleClearFile}
                      aria-label="Remove selected image and select another"
                    >
                      <XIcon className="size-4" aria-hidden="true" />
                    </Button>
                  </div>

                  {previewUrl && (
                    <div className="relative aspect-4/3 w-full rounded-xl overflow-hidden bg-muted/40 border border-border">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={previewUrl}
                        alt={`Handwriting worksheet preview for ${childName}`}
                        className="size-full object-contain"
                      />
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Inline error banner (step 4 failure) */}
            {step === 4 && uploadError && (
              <div
                role="alert"
                className="flex flex-col gap-3 p-4 rounded-xl border border-destructive/20 bg-destructive/10 text-destructive"
              >
                <div className="flex items-start gap-3">
                  <AlertCircleIcon className="size-5 shrink-0 mt-0.5" aria-hidden="true" />
                  <div className="space-y-1 min-w-0">
                    <p className="text-sm font-semibold text-destructive">
                      {isQualityGateError(uploadError.code)
                        ? "Photo Quality Check"
                        : "Upload Failed"}
                    </p>
                    <p className="text-xs text-destructive/90 leading-relaxed">
                      {errorMessageFor(uploadError)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-destructive/15 justify-end">
                  {isQualityGateError(uploadError.code) ? (
                    <Button
                      ref={retryButtonRef}
                      variant="destructive"
                      onClick={handleRetakePhoto}
                      className="shrink-0 h-10 sm:h-9 px-4 text-xs sm:text-sm font-medium gap-1.5 cursor-pointer"
                    >
                      <CameraIcon className="size-3.5" aria-hidden="true" />
                      Retake Photo
                    </Button>
                  ) : (
                    <>
                      <Button
                        variant="outline"
                        onClick={() => setStep(3)}
                        className="border-destructive/30 hover:bg-destructive/10 text-destructive shrink-0 h-10 sm:h-9 px-3.5 text-xs sm:text-sm font-medium cursor-pointer"
                      >
                        Back to Review
                      </Button>
                      <Button
                        ref={retryButtonRef}
                        variant="destructive"
                        onClick={handleSubmit}
                        className="shrink-0 h-10 sm:h-9 px-3.5 text-xs sm:text-sm font-medium gap-1.5 cursor-pointer"
                      >
                        <RotateCcwIcon className="size-3.5" aria-hidden="true" />
                        Retry Upload
                      </Button>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Step 5 — Success State */}
            {step === 5 && (
              <div className="flex flex-col items-center justify-center py-6 text-center space-y-4 animate-in fade-in-50 zoom-in-95 duration-200 motion-reduce:animate-none">
                <div className="flex size-14 sm:size-16 items-center justify-center rounded-2xl bg-success/10 text-success border border-success/20 shadow-warm">
                  <CheckCircle2Icon className="size-8 sm:size-9" aria-hidden="true" />
                </div>

                <div className="space-y-1.5 max-w-sm">
                  <h3 className="text-base sm:text-lg font-semibold text-foreground tracking-tight font-heading">
                    Worksheet Assessed!
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    The cursive sample for{" "}
                    <strong className="text-foreground font-medium">{childName}</strong>{" "}
                    has been analyzed. The diagnostic feedback has been updated on your
                    progress page.
                  </p>
                </div>

                <div className="pt-2 w-full max-w-xs">
                  <Button
                    ref={doneButtonRef}
                    type="button"
                    variant="default"
                    onClick={onClose}
                    className="h-10 sm:h-9 text-xs sm:text-sm font-medium w-full shadow-warm cursor-pointer bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    View Progress
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Standardized Sticky Footer for Steps 1–3 */}
      {!isUploading && step <= 3 && (
        <div className="flex items-center justify-between p-3 sm:p-3.5 px-4 sm:px-6 border-t border-border bg-muted/20">
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
              onClick={() => setStep(1)}
              disabled={Boolean(prefilledActivityId)}
              className="gap-1.5 h-10 sm:h-9 px-4 text-xs sm:text-sm font-medium cursor-pointer"
            >
              <ArrowLeftIcon className="size-3.5" aria-hidden="true" />
              Back
            </Button>
          )}
          {step === 3 && (
            <Button
              variant="outline"
              onClick={handleClearFile}
              className="gap-1.5 h-10 sm:h-9 px-4 text-xs sm:text-sm font-medium cursor-pointer"
            >
              <ArrowLeftIcon className="size-3.5" aria-hidden="true" />
              Back
            </Button>
          )}

          {step === 1 && (
            <Button
              disabled={!selectedActivityId}
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
              disabled={uploadMutation.isPending}
              onClick={handleSubmit}
              className="gap-2 h-10 sm:h-9 px-5 text-xs sm:text-sm font-semibold shadow-warm cursor-pointer bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              <CheckCircle2Icon className="size-4" aria-hidden="true" />
              Submit Assessment
            </Button>
          )}
        </div>
      )}
    </>
  );
}
