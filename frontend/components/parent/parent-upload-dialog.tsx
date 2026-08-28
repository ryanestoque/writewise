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
import { useTakeHomeActivities } from "@/lib/hooks/use-parent-data";
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
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

interface ParentUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  childId: string;
  childName: string;
  prefilledActivityId?: string;
}

type Step = "select" | "capture" | "processing";

interface UploadError {
  code: string;
  message: string;
}

const ACCEPTED_MIME_TYPES = ["image/jpeg", "image/png"];
const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15 MB

function errorMessageFor(error: UploadError): string {
  switch (error.code) {
    case "UNSUPPORTED_FILE_TYPE":
      return "That file isn't a supported image. Please choose a JPEG or PNG photo.";
    case "FILE_TOO_LARGE":
      return "The photo is too large. Please use an image file 15 MB or smaller.";
    case "NOT_FOUND":
      return "The selected activity or child link was not found. Please refresh and try again.";
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

const STAGED_PROGRESS_MESSAGES = [
  "Checking image quality and lighting…",
  "Segmenting cursive words and baseline…",
  "Extracting stroke features and slant…",
  "Computing diagnostic scores…",
];

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

  const [step, setStep] = useState<Step>(
    prefilledActivityId ? "capture" : "select"
  );
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(
    prefilledActivityId ?? null
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showTips, setShowTips] = useState(false);
  const [uploadError, setUploadError] = useState<UploadError | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [stagedProgressIndex, setStagedProgressIndex] = useState(0);

  const { data: activities, isLoading: activitiesLoading } =
    useTakeHomeActivities(childId);
  const uploadMutation = useUploadSubmission();
  const queryClient = useQueryClient();

  const isMobile = useSyncExternalStore(
    subscribeTouch,
    getTouchSnapshot,
    () => false
  );

  const isUploading =
    step === "processing" && !uploadError && !uploadSuccess && uploadMutation.isPending;

  useEffect(() => {
    onUploadingChange?.(isUploading);
  }, [isUploading, onUploadingChange]);

  // Simulated staged progress sequence while uploading
  useEffect(() => {
    if (!isUploading) return;
    const interval = setInterval(() => {
      setStagedProgressIndex((prev) =>
        prev < STAGED_PROGRESS_MESSAGES.length - 1 ? prev + 1 : prev
      );
    }, 1800);
    return () => {
      clearInterval(interval);
      setStagedProgressIndex(0);
    };
  }, [isUploading]);

  // Focus steering upon step change
  useEffect(() => {
    if (step === "capture" && !selectedFile) {
      dropzoneRef.current?.focus();
    } else if (step === "capture" && selectedFile) {
      submitButtonRef.current?.focus();
    } else if (step === "processing" && uploadError) {
      retryButtonRef.current?.focus();
    }
  }, [step, selectedFile, uploadError]);

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
  };

  const handleRetake = () => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setUploadError(null);
    setUploadSuccess(false);
    setStep("capture");
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  const handleSubmit = () => {
    if (!selectedFile || !selectedActivityId || !childId) return;

    setStep("processing");
    setUploadError(null);
    setUploadSuccess(false);

    uploadMutation.mutate(
      {
        image: selectedFile,
        activityId: selectedActivityId,
        studentId: childId,
      },
      {
        onSuccess: () => {
          setUploadSuccess(true);
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

  return (
    <>
      <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-5 pb-3 sm:pb-4 border-b border-border pr-12">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
            <UploadCloudIcon className="size-5" />
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
      </DialogHeader>

      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-5 space-y-4">
        {/* Step 1: Select Take-Home Activity */}
        {step === "select" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Select Assigned Activity
              </span>
            </div>

            {activitiesLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : !activities || activities.length === 0 ? (
              <div className="p-6 rounded-xl border border-dashed text-center space-y-2">
                <BookOpen className="size-8 text-muted-foreground mx-auto" />
                <p className="text-sm font-medium text-foreground">
                  No take-home activities available
                </p>
                <p className="text-xs text-muted-foreground">
                  Your teacher has not assigned any home practice worksheets yet.
                </p>
              </div>
            ) : (
              <div className="grid gap-2.5">
                {activities.map((act) => (
                  <button
                    key={act.id}
                    type="button"
                    onClick={() => {
                      setSelectedActivityId(act.id);
                      setStep("capture");
                    }}
                    className="flex flex-col text-left p-3.5 rounded-xl border border-border/80 bg-card hover:border-primary hover:bg-primary/5 transition-all text-xs sm:text-sm cursor-pointer shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <span className="font-semibold text-foreground line-clamp-2">
                      &ldquo;{act.targetText}&rdquo;
                    </span>
                    <span className="text-[11px] text-muted-foreground mt-1">
                      Assigned on{" "}
                      {new Date(act.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 2: Capture / Review Photo */}
        {step === "capture" && (
          <div className="space-y-4">
            {/* Context Breadcrumb */}
            <div className="flex items-center justify-between gap-2 p-2.5 px-3 rounded-xl bg-muted/40 border border-border/80 text-xs">
              <div className="min-w-0 flex-1 truncate">
                <span className="font-semibold text-foreground">{childName}</span>
                <span className="text-muted-foreground mx-1.5">&middot;</span>
                <span className="text-muted-foreground truncate font-medium">
                  {selectedActivity?.targetText ?? "Activity"}
                </span>
              </div>
              {!prefilledActivityId && (
                <button
                  type="button"
                  onClick={() => setStep("select")}
                  className="text-xs text-primary font-medium hover:underline shrink-0 cursor-pointer"
                >
                  Change
                </button>
              )}
            </div>

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

            {/* Preview or Dropzone */}
            {previewUrl ? (
              <div className="space-y-3">
                <div className="relative rounded-2xl overflow-hidden border border-border/80 bg-black/5 aspect-4/3 flex items-center justify-center shadow-warm">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUrl}
                    alt="Worksheet photo preview"
                    className="w-full h-full object-contain"
                  />
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 sm:h-9 text-xs sm:text-sm font-medium gap-1.5 cursor-pointer"
                    onClick={handleRetake}
                  >
                    <RotateCcwIcon className="size-3.5" />
                    Retake Photo
                  </Button>

                  <Button
                    ref={submitButtonRef}
                    type="button"
                    variant="default"
                    className="h-10 sm:h-9 text-xs sm:text-sm font-medium gap-1.5 shadow-warm cursor-pointer"
                    onClick={handleSubmit}
                  >
                    <UploadCloudIcon className="size-4" />
                    Submit Assessment
                  </Button>
                </div>
              </div>
            ) : (
              <>
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
                  className={`flex flex-col items-center justify-center p-6 sm:p-8 rounded-2xl border-2 border-dashed transition-all text-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 shadow-warm ${
                    isDragging
                      ? "border-primary bg-primary/5 scale-[0.99]"
                      : "border-border bg-card hover:border-primary/60 hover:bg-muted/10"
                  }`}
                >
                  <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-2.5">
                    {isMobile ? (
                      <CameraIcon className="size-6" />
                    ) : (
                      <UploadCloudIcon className="size-6" />
                    )}
                  </div>
                  <p className="text-sm sm:text-base font-semibold text-foreground">
                    {isMobile
                      ? "Capture or select worksheet photo"
                      : "Upload worksheet photo"}
                  </p>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                    {isMobile
                      ? "Supports JPEG or PNG (up to 15MB) · Take a photo or choose from library"
                      : "Supports JPEG or PNG (up to 15MB) · Drag & drop or browse"}
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-xs mt-4">
                    {isMobile && (
                      <Button
                        type="button"
                        variant="default"
                        className="h-10 sm:h-9 text-xs sm:text-sm font-medium gap-1.5 w-full shadow-warm cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          cameraInputRef.current?.click();
                        }}
                      >
                        <CameraIcon className="size-3.5" />
                        Take Photo
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant={isMobile ? "outline" : "default"}
                      className="h-10 sm:h-9 text-xs sm:text-sm font-medium gap-1.5 w-full shadow-warm cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                    >
                      <FileImageIcon className="size-3.5" />
                      {isMobile ? "Photo Library" : "Browse Files"}
                    </Button>
                  </div>
                </div>

                {/* Privacy Badge */}
                <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground pt-0.5">
                  <ShieldCheckIcon className="size-4 text-primary/70 shrink-0" />
                  <span>Location and device metadata stripped automatically</span>
                </div>

                {/* Collapsible Photo Tips */}
                <div className="rounded-xl bg-muted/30 overflow-hidden text-xs">
                  <button
                    type="button"
                    onClick={() => setShowTips((prev) => !prev)}
                    className="w-full flex items-center justify-between px-3.5 py-2.5 hover:bg-muted/50 transition-colors text-left font-medium text-foreground cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    aria-expanded={showTips}
                    aria-controls={photoTipsId}
                  >
                    <div className="flex items-center gap-2">
                      <LightbulbIcon className="size-4 text-primary shrink-0" />
                      <span className="text-xs sm:text-sm font-semibold">
                        Photo quality tips
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground text-xs font-medium">
                      <span>{showTips ? "Hide" : "Show"}</span>
                      <ChevronDownIcon
                        className={`size-3.5 transition-transform duration-200 ${
                          showTips ? "rotate-180" : ""
                        }`}
                      />
                    </div>
                  </button>
                  {showTips && (
                    <div id={photoTipsId} className="px-3.5 pb-3 pt-1 space-y-1.5 border-t border-border/40 text-muted-foreground">
                      <p>📷 <strong>Flat &amp; Straight:</strong> Hold the camera directly above the worksheet to avoid distortion.</p>
                      <p>💡 <strong>Good Lighting:</strong> Avoid heavy shadows across the paper.</p>
                      <p>🔍 <strong>Clear &amp; Focused:</strong> Ensure pencil strokes and penmanship ruling lines are clearly visible.</p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* Step 3: Processing / Result State */}
        {step === "processing" && (
          <div className="py-6 space-y-6">
            {uploadError ? (
              <div className="space-y-4">
                <div
                  role="alert"
                  className="flex items-start gap-3 p-4 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-sm"
                >
                  <AlertCircleIcon className="size-5 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-semibold text-foreground">
                      Unable to process worksheet
                    </p>
                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                      {errorMessageFor(uploadError)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2">
                  <Button
                    ref={retryButtonRef}
                    type="button"
                    variant="default"
                    className="h-10 sm:h-9 text-xs sm:text-sm font-medium gap-1.5 shadow-warm cursor-pointer"
                    onClick={handleRetake}
                  >
                    <RotateCcwIcon className="size-3.5" />
                    Retake Photo
                  </Button>
                </div>
              </div>
            ) : uploadSuccess ? (
              <div className="text-center space-y-4 py-4">
                <div className="flex justify-center">
                  <div className="flex size-14 items-center justify-center rounded-full bg-brand-100 dark:bg-brand-950 text-brand-600 dark:text-brand-400 animate-in zoom-in-50 duration-200">
                    <CheckCircle2Icon className="size-8" />
                  </div>
                </div>
                <div className="space-y-1">
                  <h3 className="font-heading text-lg font-semibold text-foreground">
                    Worksheet Assessed!
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground max-w-sm mx-auto">
                    The cursive sample for {childName} has been analyzed. The diagnostic feedback has been updated on your progress page.
                  </p>
                </div>
                <div className="pt-2">
                  <Button
                    type="button"
                    variant="default"
                    className="h-10 sm:h-9 px-6 font-medium shadow-warm cursor-pointer"
                    onClick={onClose}
                  >
                    View Progress
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center space-y-4 py-8">
                <div className="flex justify-center">
                  <Loader2Icon className="size-10 animate-spin text-brand-600 dark:text-brand-400" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="font-heading text-base font-semibold text-foreground">
                    Analyzing Worksheet
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground animate-pulse">
                    {STAGED_PROGRESS_MESSAGES[stagedProgressIndex]}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
