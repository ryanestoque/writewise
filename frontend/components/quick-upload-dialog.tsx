"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { Kbd } from "@/components/ui/kbd";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput } from "@/components/ui/input-group";
import {
  NativeSelect,
  NativeSelectOption } from "@/components/ui/native-select";
import { toast } from "@/components/ui/toast";
import {
  Field,
  FieldContent,
  FieldGroup,
  FieldLabel } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList } from "@/components/ui/combobox";
import { activityAssignedTo } from "@/lib/utils/activity-work";
import { useActivities } from "@/lib/hooks/use-activities";
import { useStudents } from "@/lib/hooks/use-students";
import { useUploadSubmission } from "@/lib/hooks/use-submissions";
import { rotateImageFile } from "@/lib/utils/image";
import {
  QualityErrorCard,
  type QualityError } from "@/components/submissions/quality-error-card";
import {
  UploadCloudIcon,
  CameraIcon,
  FileImageIcon,
  CheckCircle2Icon,
  LightbulbIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
  XIcon,
  AlertCircleIcon,
  RotateCwIcon,
  CheckIcon,
  Scan,
  SunMedium,
  Focus,
  Hash,
  AlignJustify,
  Plus,
  ChevronDownIcon,
  ShieldCheckIcon,
  Video } from "lucide-react";

interface QuickUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-fill activity when opened from an activity detail page */
  prefilledActivityId?: string;
  /** Pre-fill student when opened from a context that knows the student */
  prefilledStudentId?: string;
}

type Step = 1 | 2 | 3 | 4 | 5;

type UploadError = QualityError;

/** Combobox choice representation */
interface Choice {
  value: string;
  label: string;
  sublabel?: string;
}

const ACCEPTED_MIME_TYPES = ["image/jpeg", "image/png"];
const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15 MB

const PROCESSING_STAGES = [
  {
    title: "Checking image quality…",
    detail: "Verifying focus, lighting, and alignment." },
  {
    title: "Analyzing handwriting…",
    detail: "Evaluating letter formation, spacing, and slant." },
  {
    title: "Calculating scores…",
    detail: "Finalizing criteria breakdown." },
] as const;

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

function getTouchServerSnapshot() {
  return false;
}

const STEPS = [
  { step: 1, label: "Details" },
  { step: 2, label: "Capture" },
  { step: 3, label: "Review" },
] as const;

export function QuickUploadDialog({
  open,
  onOpenChange,
  prefilledActivityId,
  prefilledStudentId }: QuickUploadDialogProps) {
  const [isUploading, setIsUploading] = useState(false);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        // Prevent closing via backdrop/escape while upload mutation is in-flight
        if (!nextOpen && isUploading) {
          return;
        }
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent
        showCloseButton={!isUploading}
        className="w-[calc(100%-1.5rem)] max-w-xl max-h-[min(92dvh,calc(100dvh-2rem))] p-0 gap-0 overflow-hidden flex flex-col shadow-warm"
      >
        {/* key remounts the flow on every open/close so state starts fresh */}
        <UploadFlow
          key={open ? "open" : "closed"}
          onClose={() => onOpenChange(false)}
          prefilledActivityId={prefilledActivityId}
          prefilledStudentId={prefilledStudentId}
          onUploadingChange={setIsUploading}
        />
      </DialogContent>
    </Dialog>
  );
}

function UploadFlow({
  onClose,
  prefilledActivityId: requestedActivityId,
  prefilledStudentId: requestedStudentId,
  onUploadingChange }: {
  onClose: () => void;
  prefilledActivityId?: string;
  prefilledStudentId?: string;
  onUploadingChange?: (uploading: boolean) => void;
}) {
  const activityInputId = useId();
  const studentInputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);
  const originalFileRef = useRef<File | null>(null);
  const dropzoneRef = useRef<HTMLDivElement>(null);
  const browseButtonRef = useRef<HTMLButtonElement>(null);
  const takePhotoButtonRef = useRef<HTMLButtonElement>(null);
  const submitButtonRef = useRef<HTMLButtonElement>(null);
  const retryButtonRef = useRef<HTMLButtonElement>(null);
  const uploadNextButtonRef = useRef<HTMLButtonElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [step, setStep] = useState<Step>(1);
  const [showTips, setShowTips] = useState(false);
  const [activityChoice, setActivityChoice] = useState<Choice | null>(null);
  const [studentChoice, setStudentChoice] = useState<Choice | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [rotationDegrees, setRotationDegrees] = useState(0);
  const [isPortrait, setIsPortrait] = useState(true);
  const [isRotating, setIsRotating] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<UploadError | null>(null);
  const router = useRouter();
  const [uploadedCount, setUploadedCount] = useState(0);
  const [submittedPairs, setSubmittedPairs] = useState<Set<string>>(new Set());
  const [lastSubmittedStudent, setLastSubmittedStudent] = useState<string | null>(
    null
  );
  const [lastSubmittedActivity, setLastSubmittedActivity] = useState<string | null>(
    null
  );
  const [lastSubmittedSubmissionId, setLastSubmittedSubmissionId] = useState<string | null>(
    null
  );
  const [lastSubmittedActivityId, setLastSubmittedActivityId] = useState<string | null>(
    null
  );
  const [lastRetakeTip, setLastRetakeTip] = useState<{ tip: string; badgeLabel?: string } | null>(
    null
  );
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");

  const { data: activities, isPending: activitiesLoading, error: activitiesError } = useActivities();
  const { data: students, isPending: studentsLoading, error: studentsError } = useStudents();
  const prefilledActivityId = activities?.some((a) => a.id === requestedActivityId)
    ? requestedActivityId : undefined;
  const chosenActivity = activities?.find((a) => a.id === (prefilledActivityId ?? activityChoice?.value));
  const prefilledStudentId = students?.some((s) => s.id === requestedStudentId && !!chosenActivity && activityAssignedTo(chosenActivity, s))
    ? requestedStudentId : undefined;
  const invalidPrefill = !!activities && !!students && (
    (!!requestedActivityId && !prefilledActivityId) || (!!requestedStudentId && !prefilledStudentId)
  );
  const uploadMutation = useUploadSubmission();

  const isMobile = useSyncExternalStore(
    subscribeTouch,
    getTouchSnapshot,
    getTouchServerSnapshot
  );

  const isUploading = step === 4 && !uploadError && uploadMutation.isPending;
  const [processingStageIndex, setProcessingStageIndex] = useState(0);

  // Propagate uploading state to parent dialog to control close guards
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

  // Derived state: live camera is only active while on step 2
  const isLiveCamera = step === 2 && isCameraActive;

  // Stop camera helper (called from user click / capture / clear actions)
  const handleStopDesktopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  // Re-attach stream whenever camera becomes active and video element mounts
  useEffect(() => {
    if (isLiveCamera && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [isLiveCamera]);

  // Stop camera stream tracks when step changes away from step 2
  useEffect(() => {
    if (step !== 2 && streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, [step]);

  // Programmatic focus steering upon step transitions (WCAG 2.4.3)
  useEffect(() => {
    if (step === 2) {
      if (isMobile) {
        takePhotoButtonRef.current?.focus();
      } else {
        browseButtonRef.current?.focus();
      }
    } else if (step === 3) {
      submitButtonRef.current?.focus();
    } else if (step === 4 && uploadError) {
      retryButtonRef.current?.focus();
    } else if (step === 5) {
      uploadNextButtonRef.current?.focus();
    }
  }, [step, uploadError, isMobile]);

  // Cleanup object URL & camera tracks on unmount to prevent browser leaks
  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  const activityChoices: Choice[] = useMemo(() => {
    return (
      activities?.map((a) => ({
        value: a.id,
        label: a.title })) ?? []
    );
  }, [activities]);

  const studentChoices: Choice[] = useMemo(() => {
    return (
      students?.filter((s) => {
        const activity = activities?.find((a) => a.id === (prefilledActivityId ?? activityChoice?.value));
        return !!activity && activityAssignedTo(activity, s);
      }).map((s) => ({
        value: s.id,
        label: s.full_name,
        sublabel: s.section })) ?? []
    );
  }, [students, activities, prefilledActivityId, activityChoice]);

  const selectedActivity = useMemo(() => {
    if (prefilledActivityId) {
      return activities?.find((a) => a.id === prefilledActivityId) ?? null;
    }
    return activities?.find((a) => a.id === activityChoice?.value) ?? null;
  }, [activities, activityChoice, prefilledActivityId]);

  const selectedStudent = useMemo(() => {
    if (prefilledStudentId) {
      return students?.find((s) => s.id === prefilledStudentId && !!selectedActivity && activityAssignedTo(selectedActivity, s)) ?? null;
    }
    return students?.find((s) => s.id === studentChoice?.value && !!selectedActivity && activityAssignedTo(selectedActivity, s)) ?? null;
  }, [students, studentChoice, prefilledStudentId, selectedActivity]);

  const handleClearFile = () => {
    handleStopDesktopCamera();
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
    handleStopDesktopCamera();
    handleClearFile();
    setUploadError(null);
    if (tipInfo) {
      setLastRetakeTip(tipInfo);
    }
    setStep(2);
  };

  const handleNextUpload = () => {
    handleStopDesktopCamera();
    handleClearFile();
    setUploadError(null);
    setLastRetakeTip(null);
    // Clear student choice so teacher can select the next child
    if (!prefilledStudentId) {
      setStudentChoice(null);
    }
    // Return to Step 1 (or Step 2 if student was also hard prefilled)
    setStep(prefilledStudentId ? 2 : 1);
  };

  const handleFileChange = (file: File | undefined) => {
    if (!file) return;
    handleStopDesktopCamera();
    setLastRetakeTip(null);

    if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
      toast.add({ type: "error", title: "Please select a JPEG or PNG image." });
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      toast.add({ type: "error", title: "Image file size must be less than 15MB." });
      return;
    }

    // Revoke previous URL if one exists
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

  // Keep a stable ref for handleFileChange to use in the paste event listener
  const handleFileChangeRef = useRef(handleFileChange);
  useEffect(() => {
    handleFileChangeRef.current = handleFileChange;
  });

  // Clipboard paste support on Step 2 (e.g. Snipping Tool or copied images)
  useEffect(() => {
    if (step !== 2) return;

    const handlePaste = (e: ClipboardEvent) => {
      // Don't hijack paste if user is typing in a form input or combobox
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          activeEl.getAttribute("contenteditable") === "true")
      ) {
        return;
      }

      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith("image/")) {
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault();
            toast.add({ type: "info", title: "Image pasted from clipboard." });
            handleFileChangeRef.current(file);
            break;
          }
        }
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [step]);

  // Start live webcam / document camera stream on desktop
  const handleStartDesktopCamera = async (deviceId?: string) => {
    if (!navigator?.mediaDevices?.getUserMedia) {
      toast.add({ type: "error", title: "Camera access is not supported by your browser." });
      return;
    }

    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      const activeDevId = deviceId || selectedDeviceId;
      const constraints: MediaStreamConstraints = {
        video: activeDevId
          ? { deviceId: { exact: activeDevId }, width: { ideal: 1920 }, height: { ideal: 1080 } }
          : { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      setIsCameraActive(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }

      // Enumerate available video input devices (e.g. document camera vs webcam)
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevs = devices.filter((d) => d.kind === "videoinput");
      setVideoDevices(videoDevs);
      if (!activeDevId && videoDevs.length > 0) {
        setSelectedDeviceId(videoDevs[0].deviceId);
      }
    } catch {
      toast.add({ type: "error", title: "Camera access denied or unavailable. Please check browser permissions." });
      handleStopDesktopCamera();
    }
  };

  const handleSwitchCamera = (deviceId: string) => {
    setSelectedDeviceId(deviceId);
    handleStartDesktopCamera(deviceId);
  };

  const handleCaptureFrame = () => {
    const video = videoRef.current;
    if (!video) return;

    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 1920;
      canvas.height = video.videoHeight || 1080;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        toast.add({ type: "error", title: "Could not capture frame from camera." });
        return;
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            toast.add({ type: "error", title: "Failed to generate photo from camera frame." });
            return;
          }
          const file = new File(
            [blob],
            `worksheet_camera_${Date.now()}.jpg`,
            { type: "image/jpeg" }
          );
          handleStopDesktopCamera();
          handleFileChange(file);
        },
        "image/jpeg",
        0.92
      );
    } catch {
      toast.add({ type: "error", title: "Failed to capture image. Please try again." });
    }
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
      toast.add({ type: "error", title: "Failed to rotate photo. Please try again." });
    } finally {
      setIsRotating(false);
    }
  };

  const handleSubmit = (bypassTextCheck = false) => {
    const activityId = prefilledActivityId ?? activityChoice?.value;
    const studentId = prefilledStudentId ?? studentChoice?.value;
    if (!selectedFile || !activityId || !studentId || !selectedActivity || !selectedStudent) return;

    setStep(4);
    setUploadError(null);

    uploadMutation.mutate(
      {
        image: selectedFile,
        activityId,
        studentId,
        bypassTextCheck },
      {
        onSuccess: (data: unknown) => {
          const res = data as { submission_id?: string; id?: string };
          const subId = res?.submission_id || res?.id || null;
          if (subId) {
            setLastSubmittedSubmissionId(subId);
          }
          setLastSubmittedActivityId(activityId);
          setUploadedCount((prev) => prev + 1);
          setSubmittedPairs((prev) =>
            new Set(prev).add(`${activityId}:${studentId}`)
          );
          setLastSubmittedStudent(selectedStudent?.full_name ?? "Student");
          setLastSubmittedActivity(selectedActivity?.target_text ?? "Activity");
          toast.add({ type: "success", title: "Submission uploaded successfully." });
          setStep(5);
        },
        onError: (err) => {
          console.error("Submission upload failed:", err);
          let error: UploadError;
          if (err && typeof err === "object" && "code" in err) {
            error = err as UploadError;
          } else if (err instanceof Error) {
            error = {
              code: "INTERNAL_ERROR",
              message: err.message || "Upload failed. Please try again." };
          } else {
            error = { code: "INTERNAL_ERROR", message: "Upload failed. Please try again." };
          }
          setUploadError(error);
        } }
    );
  };

  const handleRetryUpload = () => {
    handleSubmit(false);
  };

  const handleProceedAnyway = () => {
    handleSubmit(true);
  };

  const handleViewDiagnostic = () => {
    const actId = prefilledActivityId ?? activityChoice?.value ?? lastSubmittedActivityId;
    if (lastSubmittedSubmissionId && actId) {
      onClose();
      router.push(`/activities/${actId}/submissions/${lastSubmittedSubmissionId}`);
    } else {
      onClose();
    }
  };

  const canProceed = Boolean(
    selectedActivity && selectedStudent
  );

  const isDuplicateSubmission = useMemo(() => {
    const activeActivityId = prefilledActivityId ?? activityChoice?.value;
    const activeStudentId = prefilledStudentId ?? studentChoice?.value;
    if (!activeActivityId || !activeStudentId) return false;
    return submittedPairs.has(`${activeActivityId}:${activeStudentId}`);
  }, [
    prefilledActivityId,
    activityChoice,
    prefilledStudentId,
    studentChoice,
    submittedPairs,
  ]);

  const isStepNavigable = (targetStep: Step): boolean => {
    if (isUploading) return false;
    if (targetStep === 1) return true;
    if (targetStep === 2) return canProceed;
    if (targetStep === 3) return canProceed && Boolean(selectedFile);
    return false;
  };

  const stepAnnouncement = useMemo(() => {
    switch (step) {
      case 1:
        return "Step 1 of 3: Select Activity and Student";
      case 2:
        return "Step 2 of 3: Capture Worksheet Photo";
      case 3:
        return "Step 3 of 3: Review and Confirm Submission";
      case 4:
        return uploadError
          ? "Upload failed. Please review the error."
          : "Step 4: Uploading worksheet submission";
      case 5:
        return "Step 5: Submission uploaded successfully";
    }
  }, [step, uploadError]);

  return (
    <>
      <span className="sr-only" aria-live="polite" role="status">
        {stepAnnouncement}
      </span>

      <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-5 pb-3 sm:pb-3.5 border-b border-border">
        <div className="min-w-0 pr-10 sm:pr-8">
          <DialogTitle className="text-base sm:text-lg font-semibold text-foreground">
            Upload Student Worksheet
          </DialogTitle>
          <DialogDescription className="sr-only">
            Upload student cursive worksheets for automated assessment and feedback.
          </DialogDescription>
        </div>

        {/* 3-Step Interactive Progress Stepper (Anchored Across All Steps) */}
        <nav aria-label="Upload progress" className="mt-3 sm:mt-3.5 w-full">
          <ol className="flex items-center justify-between gap-1.5 sm:gap-2 w-full">
            {STEPS.map((s) => {
              const isCompleted = step > s.step || step === 5;
              const isCurrent = step === s.step || (step === 4 && s.step === 3);
              const canJump = isStepNavigable(s.step as Step) && !isUploading && step !== 5;

              return (
                <li
                  key={s.step}
                  className={cn(
                    "flex items-center gap-1.5 sm:gap-2 min-w-0",
                    s.step < STEPS.length && "flex-1"
                  )}
                  aria-current={isCurrent ? "step" : undefined}
                >
                  {canJump && !isCurrent ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setStep(s.step as Step)}
                      aria-label={`${s.label} — Step ${s.step}, completed`}
                      className="group h-auto shrink min-w-0 justify-start gap-1.5 sm:gap-2 p-1 -m-1 hover:bg-muted/80 text-left font-normal"
                    >
                      <div
                        className={cn(
                          "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-all",
                          isCompleted
                            ? "bg-primary text-primary-foreground group-hover:bg-primary/90 group-hover:scale-105"
                            : "bg-muted text-muted-foreground group-hover:bg-primary/20 group-hover:text-primary"
                        )}
                      >
                        {isCompleted ? <CheckIcon className="size-3.5" /> : s.step}
                      </div>
                      <span className="text-xs sm:text-sm truncate font-medium text-foreground group-hover:text-primary transition-colors">
                        {s.label}
                      </span>
                    </Button>
                  ) : (
                    <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                      <div
                        className={cn(
                          "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                          isCompleted
                            ? "bg-primary text-primary-foreground"
                            : isCurrent
                            ? "bg-primary/15 text-primary ring-2 ring-primary ring-offset-2 ring-offset-background"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {isCompleted ? <CheckIcon className="size-3.5" /> : s.step}
                      </div>
                      <span
                        className={cn(
                          "text-xs sm:text-sm truncate font-medium",
                          isCurrent
                            ? "text-foreground font-semibold"
                            : isCompleted
                            ? "text-foreground"
                            : "text-muted-foreground"
                        )}
                      >
                        {s.label}
                      </span>
                    </div>
                  )}

                  {s.step < STEPS.length && (
                    <div
                      className={cn(
                        "h-0.5 flex-1 rounded-full transition-colors",
                        step > s.step || step === 5 ? "bg-primary" : "bg-muted"
                      )}
                      aria-hidden="true"
                    />
                  )}
                </li>
              );
            })}
          </ol>
        </nav>
      </DialogHeader>

      <div className="px-4 sm:px-6 py-4 max-h-[min(72dvh,calc(100dvh-10rem))] overflow-y-auto overscroll-contain">
        {isUploading ? (
          /* Step 4 — Uploading state (DESIGN.md §7.2 staged progress) */
          <div
            aria-busy="true"
            aria-live="polite"
            aria-atomic="true"
            className="flex flex-col items-center justify-center py-10 gap-3.5 text-center min-h-[160px]"
          >
            <Spinner className="size-8 text-primary" />
            <div className="flex flex-col gap-1 transition-all duration-200">
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
                  className={cn(
                    "size-1.5 rounded-full transition-all duration-300",
                    idx === processingStageIndex
                      ? "bg-primary w-4"
                      : idx < processingStageIndex
                      ? "bg-primary/50"
                      : "bg-muted-foreground/30"
                  )}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {/* Step 1 — Select student & activity */}
            {step === 1 && (
              <>
                {invalidPrefill && !canProceed && (
                  <Alert role="status">
                    <AlertCircleIcon aria-hidden="true" />
                    <AlertTitle>Selection unavailable</AlertTitle>
                    <AlertDescription>
                      The previous selection is no longer available. Choose an assigned student below, or edit the activity&apos;s assignments first.
                    </AlertDescription>
                  </Alert>
                )}

                <FieldGroup>
                  <Field className="gap-1.5">
                    <FieldLabel
                      htmlFor={activityInputId}
                      className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between"
                    >
                      <span>
                        Activity{" "}
                        <span className="text-destructive" aria-hidden="true">
                          *
                        </span>
                      </span>
                      {uploadedCount > 0 && !prefilledActivityId && activityChoice && (
                        <span className="text-xs font-normal text-primary flex items-center gap-1 normal-case tracking-normal">
                          <CheckCircle2Icon className="size-3" />
                          Retained from batch
                        </span>
                      )}
                    </FieldLabel>
                    <FieldContent>
                      {prefilledActivityId ? (
                        <InputGroup className="h-10 sm:h-9 rounded-lg sm:rounded-xl">
                          <InputGroupInput
                            id={activityInputId}
                            readOnly
                            value={selectedActivity?.target_text ?? "Loading activity…"}
                            aria-label={`Pre-selected activity: ${
                              selectedActivity?.target_text ?? "Loading activity..."
                            }`}
                            className="font-medium"
                          />
                          <InputGroupAddon align="inline-end">
                            <Badge variant="secondary">Locked</Badge>
                          </InputGroupAddon>
                        </InputGroup>
                      ) : (
                        <Combobox
                          items={activityChoices}
                          value={activityChoice}
                          onValueChange={(choice) => { setActivityChoice(choice); setStudentChoice(null); }}
                          itemToStringLabel={(c: Choice | null) => c?.label ?? ""}
                          itemToStringValue={(c: Choice | null) => c?.value ?? ""}
                          isItemEqualToValue={(a: Choice, b: Choice) =>
                            a?.value === b?.value
                          }
                        >
                          <ComboboxInput
                            id={activityInputId}
                            aria-required="true"
                            placeholder="Search activities..."
                            className="h-10 sm:h-9 text-base sm:text-sm rounded-lg sm:rounded-xl"
                          />
                          <ComboboxContent>
                            <ComboboxList>
                              <ComboboxEmpty>
                                {activitiesLoading ? "Loading activities…" : activitiesError ? "Activities could not be loaded. Close and reopen upload to try again." : activityChoices.length === 0 ? "Create an activity before uploading a worksheet." : "No matching activities. Try another search."}
                              </ComboboxEmpty>
                              {activityChoices.map((choice) => (
                                <ComboboxItem
                                  key={choice.value}
                                  value={choice}
                                  className="py-2.5 px-3"
                                >
                                  <span className="truncate">
                                    {choice.label}
                                  </span>
                                </ComboboxItem>
                              ))}
                            </ComboboxList>
                          </ComboboxContent>
                        </Combobox>
                      )}
                    </FieldContent>
                  </Field>

                  <Field className="gap-1.5">
                    <FieldLabel
                      htmlFor={studentInputId}
                      className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                    >
                      Student{" "}
                      <span className="text-destructive" aria-hidden="true">
                        *
                      </span>
                    </FieldLabel>
                    <FieldContent>
                      {prefilledStudentId ? (
                        <InputGroup className="h-10 sm:h-9 rounded-lg sm:rounded-xl">
                          <InputGroupInput
                            id={studentInputId}
                            readOnly
                            value={selectedStudent?.full_name ?? "Loading student…"}
                            aria-label={`Pre-selected student: ${
                              selectedStudent?.full_name ?? "Loading student..."
                            }`}
                            className="font-medium"
                          />
                          <InputGroupAddon align="inline-end">
                            <Badge variant="secondary">Locked</Badge>
                          </InputGroupAddon>
                        </InputGroup>
                      ) : (
                        <Combobox
                          items={studentChoices}
                          value={studentChoice}
                          onValueChange={setStudentChoice}
                          itemToStringLabel={(c: Choice | null) => c?.label ?? ""}
                          itemToStringValue={(c: Choice | null) => c?.value ?? ""}
                          isItemEqualToValue={(a: Choice, b: Choice) =>
                            a?.value === b?.value
                          }
                        >
                          <ComboboxInput
                            id={studentInputId}
                            aria-required="true"
                            placeholder="Search students..."
                            className="h-10 sm:h-9 text-base sm:text-sm rounded-lg sm:rounded-xl"
                          />
                          <ComboboxContent>
                            <ComboboxList>
                              <ComboboxEmpty>
                                {studentsLoading ? "Loading students…" : studentsError ? "Students could not be loaded. Close and reopen upload to try again." : !selectedActivity ? "Choose an activity first." : !students?.length ? "Add students to your class roster first." : studentChoices.length === 0 ? "No students are assigned to this activity." : "No matching students. Try another search."}
                              </ComboboxEmpty>
                              {studentChoices.map((choice) => (
                                <ComboboxItem
                                  key={choice.value}
                                  value={choice}
                                  className="py-2.5 px-3"
                                >
                                  <span className="truncate">
                                    {choice.label}
                                  </span>
                                  {choice.sublabel && (
                                    <span className="text-xs text-muted-foreground ml-auto shrink-0 font-medium">
                                      {choice.sublabel}
                                    </span>
                                  )}
                                </ComboboxItem>
                              ))}
                            </ComboboxList>
                          </ComboboxContent>
                        </Combobox>
                      )}
                    </FieldContent>
                  </Field>
                </FieldGroup>

                {/* Duplicate Submission Warning Banner (Step 1) */}
                {!activitiesLoading && !studentsLoading && !activitiesError && !studentsError && (
                  activityChoices.length === 0 || !students?.length || (selectedActivity && studentChoices.length === 0)
                ) && (
                  <Alert role="status">
                    <AlertCircleIcon aria-hidden="true" />
                    <AlertTitle>Setup needed before uploading</AlertTitle>
                    <AlertDescription className="flex flex-col items-start gap-2">
                      <p>
                        {!students?.length
                          ? "Add students to your class roster before uploading a worksheet."
                          : activityChoices.length === 0
                            ? "Create an activity and assign students before uploading a worksheet."
                            : "Assign students to this activity before uploading a worksheet."}
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        className="min-h-10 md:min-h-9"
                        onClick={() => {
                          onClose();
                          router.push(!students?.length ? "/roster" : activityChoices.length === 0 ? "/activities" : `/activities/${selectedActivity!.id}`);
                        }}
                      >
                        {!students?.length ? "Go to Class Roster" : activityChoices.length === 0 ? "Go to Activities" : "Manage activity assignments"}
                      </Button>
                    </AlertDescription>
                  </Alert>
                )}

                {isDuplicateSubmission && (
                  <Alert
                    variant="destructive"
                    className="animate-in fade-in duration-150 motion-reduce:animate-none"
                  >
                    <AlertCircleIcon aria-hidden="true" />
                    <AlertTitle className="text-xs sm:text-sm font-semibold">
                      Worksheet already uploaded this session
                    </AlertTitle>
                    <AlertDescription className="text-xs leading-relaxed">
                      A submission for <strong className="font-medium">{selectedStudent?.full_name ?? "this student"}</strong> was already recorded for this activity. Submitting again will add another submission attempt.
                    </AlertDescription>
                  </Alert>
                )}
              </>
            )}

            {/* Step 2 — Capture photo */}
            {step === 2 && (
              <>
                {/* Context Header: Active Student & Activity */}
                <div className="flex items-center justify-between gap-2 p-2.5 px-3 rounded-xl bg-muted/40 border border-border/80 text-xs flex-wrap min-[380px]:flex-nowrap">
                  <div className="flex items-center gap-1.5 min-w-0 flex-1 truncate">
                    <span className="font-semibold text-foreground truncate">
                      {selectedStudent?.full_name ?? "Student"}
                    </span>
                    {selectedStudent?.section && (
                      <span className="text-muted-foreground shrink-0">
                        ({selectedStudent.section})
                      </span>
                    )}
                  </div>
                  <div
                    className="flex items-center gap-1 text-muted-foreground shrink-0 max-w-full min-[380px]:max-w-[50%] truncate font-medium cursor-help"
                    title={
                      selectedActivity?.target_text
                        ? `Activity prompt: "${selectedActivity.target_text}"`
                        : "Activity"
                    }
                  >
                    <span className="truncate">
                      {selectedActivity?.target_text ?? "Activity"}
                    </span>
                  </div>
                </div>

                {/* Persistent Retake Guidance Banner */}
                {lastRetakeTip && (
                  <Alert className="border-warning/30 bg-warning/10 text-foreground text-xs animate-in fade-in-50 duration-200 motion-reduce:animate-none">
                    <LightbulbIcon className="text-warning" aria-hidden="true" />
                    <AlertTitle className="text-xs font-semibold">
                      Tip for this retake{lastRetakeTip.badgeLabel ? ` (${lastRetakeTip.badgeLabel})` : ""}
                    </AlertTitle>
                    <AlertDescription className="text-xs leading-relaxed">
                      {lastRetakeTip.tip}
                    </AlertDescription>
                    <AlertAction>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => setLastRetakeTip(null)}
                        className="relative after:absolute after:-inset-2 sm:after:hidden text-muted-foreground hover:text-foreground cursor-pointer"
                        aria-label="Dismiss tip"
                      >
                        <XIcon aria-hidden="true" />
                      </Button>
                    </AlertAction>
                  </Alert>
                )}

                {/* Standard File Picker Input */}
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/jpeg,image/png"
                  className="sr-only"
                  tabIndex={-1}
                  aria-hidden="true"
                  onChange={(e) => handleFileChange(e.target.files?.[0])}
                />

                {/* Direct Camera Capture Input */}
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

                {/* Live Desktop / Document Camera Viewfinder */}
                {isLiveCamera ? (
                  <div className="relative rounded-2xl border border-border bg-black/95 overflow-hidden flex flex-col items-center justify-center p-3 shadow-warm animate-in fade-in duration-200 motion-reduce:animate-none">
                    <div className="relative w-full aspect-4/3 max-h-[340px] rounded-xl overflow-hidden bg-black flex items-center justify-center">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="size-full object-contain"
                      />
                      {/* Cursive Penmanship Framing Overlay on Live Camera */}
                      <div
                        className="absolute inset-x-8 top-1/2 -translate-y-1/2 flex flex-col justify-between h-20 opacity-40 pointer-events-none select-none"
                        aria-hidden="true"
                      >
                        <div className="w-full h-px bg-white/60" />
                        <div className="w-full border-b border-dashed border-white/70" />
                        <div className="w-full h-0.5 bg-white/90" />
                      </div>
                      {/* Viewfinder Corner Framing */}
                      <div className="absolute top-3 left-3 size-4 pointer-events-none" aria-hidden="true">
                        <span className="absolute top-0 left-0 w-full h-0.5 bg-white/80 rounded-full" />
                        <span className="absolute top-0 left-0 h-full w-0.5 bg-white/80 rounded-full" />
                      </div>
                      <div className="absolute top-3 right-3 size-4 pointer-events-none" aria-hidden="true">
                        <span className="absolute top-0 right-0 w-full h-0.5 bg-white/80 rounded-full" />
                        <span className="absolute top-0 right-0 h-full w-0.5 bg-white/80 rounded-full" />
                      </div>
                      <div className="absolute bottom-3 left-3 size-4 pointer-events-none" aria-hidden="true">
                        <span className="absolute bottom-0 left-0 w-full h-0.5 bg-white/80 rounded-full" />
                        <span className="absolute bottom-0 left-0 h-full w-0.5 bg-white/80 rounded-full" />
                      </div>
                      <div className="absolute bottom-3 right-3 size-4 pointer-events-none" aria-hidden="true">
                        <span className="absolute bottom-0 right-0 w-full h-0.5 bg-white/80 rounded-full" />
                        <span className="absolute bottom-0 right-0 h-full w-0.5 bg-white/80 rounded-full" />
                      </div>
                    </div>

                    {/* Camera Controls Bar */}
                    <div className="flex items-center justify-between w-full pt-3 px-1 gap-2">
                      {videoDevices.length > 1 ? (
                        <Field className="w-auto min-w-0">
                          <FieldLabel htmlFor="camera-select" className="sr-only">
                            Camera
                          </FieldLabel>
                          <NativeSelect
                            id="camera-select"
                            size="sm"
                            value={selectedDeviceId}
                            onChange={(e) => handleSwitchCamera(e.target.value)}
                            className="max-w-[150px]"
                          >
                            {videoDevices.map((dev, idx) => (
                              <NativeSelectOption key={dev.deviceId || idx} value={dev.deviceId}>
                                {dev.label || `Camera ${idx + 1}`}
                              </NativeSelectOption>
                            ))}
                          </NativeSelect>
                        </Field>
                      ) : (
                        <span className="text-xs text-muted-foreground flex items-center gap-1.5 pl-1">
                          <span className="size-2 rounded-full bg-success" aria-hidden="true" />
                          Live Viewfinder
                        </span>
                      )}

                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs cursor-pointer"
                          onClick={handleStopDesktopCamera}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          variant="default"
                          size="sm"
                          className="h-8 text-xs font-semibold shadow-warm cursor-pointer"
                          onClick={handleCaptureFrame}
                        >
                          <CameraIcon data-icon="inline-start" aria-hidden="true" />
                          Capture Photo
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Standard Dropzone Centerpiece with Penmanship Guidelines and Clean Semantics (WCAG 4.1.2) */
                  <div
                    ref={dropzoneRef}
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
                    className={cn(
                      "group relative flex flex-col items-center justify-center p-6 sm:p-8 rounded-2xl border-2 border-dashed transition-all text-center shadow-warm overflow-hidden",
                      isDragging
                        ? "border-primary bg-primary/5 scale-[0.99]"
                        : "border-border bg-card hover:border-primary/60 hover:bg-muted/10"
                    )}
                  >
                    {/* Viewfinder Corner Framing Brackets */}
                    <div className="absolute top-2.5 left-2.5 size-3 pointer-events-none" aria-hidden="true">
                      <span className="absolute top-0 left-0 w-full h-0.5 bg-border/80 group-hover:bg-primary/60 transition-colors rounded-full" />
                      <span className="absolute top-0 left-0 h-full w-0.5 bg-border/80 group-hover:bg-primary/60 transition-colors rounded-full" />
                    </div>
                    <div className="absolute top-2.5 right-2.5 size-3 pointer-events-none" aria-hidden="true">
                      <span className="absolute top-0 right-0 w-full h-0.5 bg-border/80 group-hover:bg-primary/60 transition-colors rounded-full" />
                      <span className="absolute top-0 right-0 h-full w-0.5 bg-border/80 group-hover:bg-primary/60 transition-colors rounded-full" />
                    </div>
                    <div className="absolute bottom-2.5 left-2.5 size-3 pointer-events-none" aria-hidden="true">
                      <span className="absolute bottom-0 left-0 w-full h-0.5 bg-border/80 group-hover:bg-primary/60 transition-colors rounded-full" />
                      <span className="absolute bottom-0 left-0 h-full w-0.5 bg-border/80 group-hover:bg-primary/60 transition-colors rounded-full" />
                    </div>
                    <div className="absolute bottom-2.5 right-2.5 size-3 pointer-events-none" aria-hidden="true">
                      <span className="absolute bottom-0 right-0 w-full h-0.5 bg-border/80 group-hover:bg-primary/60 transition-colors rounded-full" />
                      <span className="absolute bottom-0 right-0 h-full w-0.5 bg-border/80 group-hover:bg-primary/60 transition-colors rounded-full" />
                    </div>

                    {/* Decorative Cursive Penmanship Guidelines Background (DESIGN.md signature component) */}
                    <div
                      className="absolute inset-x-8 top-1/2 -translate-y-1/2 flex flex-col justify-between h-20 opacity-25 pointer-events-none select-none transition-opacity group-hover:opacity-40"
                      aria-hidden="true"
                    >
                      {/* Headline */}
                      <div className="w-full h-px bg-primary/40" />
                      {/* Dotted Midline */}
                      <div className="w-full border-b border-dashed border-primary/50" />
                      {/* Baseline */}
                      <div className="w-full h-0.5 bg-primary/60" />
                    </div>

                    <div className="relative z-10 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-2.5 transition-transform group-hover:scale-105">
                      {isMobile ? (
                        <CameraIcon className="size-6" />
                      ) : (
                        <UploadCloudIcon className="size-6" />
                      )}
                    </div>
                    <p className="relative z-10 text-sm sm:text-base font-semibold text-foreground">
                      {isMobile
                        ? "Capture or upload worksheet photo"
                        : "Upload worksheet photo"}
                    </p>
                    <p className="relative z-10 text-xs sm:text-sm text-muted-foreground mt-1">
                      {isMobile
                        ? "Supports JPEG or PNG (up to 15MB) · Take a photo or choose from library"
                        : "Supports JPEG or PNG (up to 15MB) · Drag & drop or choose an option"}
                    </p>

                    {/* Action Triggers */}
                    {isMobile ? (
                      <div className="relative z-10 grid grid-cols-1 min-[480px]:grid-cols-2 gap-2 w-full max-w-xs mt-4">
                        <Button
                          ref={takePhotoButtonRef}
                          type="button"
                          variant="default"
                          className="h-10 sm:h-9 text-xs sm:text-sm font-medium w-full shadow-warm cursor-pointer"
                          onClick={() => cameraInputRef.current?.click()}
                        >
                          <CameraIcon data-icon="inline-start" aria-hidden="true" />
                          Take Photo
                        </Button>
                        <Button
                          ref={browseButtonRef}
                          type="button"
                          variant="outline"
                          className="h-10 sm:h-9 text-xs sm:text-sm font-medium w-full cursor-pointer"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <FileImageIcon data-icon="inline-start" className="text-muted-foreground" aria-hidden="true" />
                          Photo Library
                        </Button>
                      </div>
                    ) : (
                      <div className="relative z-10 flex flex-col sm:flex-row items-center gap-2 w-full max-w-xs sm:max-w-sm mt-4">
                        <Button
                          ref={browseButtonRef}
                          type="button"
                          variant="default"
                          className="h-10 sm:h-9 text-xs sm:text-sm font-medium w-full shadow-warm cursor-pointer"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <FileImageIcon data-icon="inline-start" aria-hidden="true" />
                          Browse Files
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-10 sm:h-9 text-xs sm:text-sm font-medium w-full cursor-pointer"
                          onClick={() => handleStartDesktopCamera()}
                        >
                          <Video data-icon="inline-start" className="text-primary" aria-hidden="true" />
                          Use Camera / Doc Cam
                        </Button>
                      </div>
                    )}

                    {/* Desktop Clipboard Paste Hint */}
                    <p className="relative z-10 text-[11px] text-muted-foreground/80 mt-2 hidden sm:block">
                      Tip: You can also paste an image directly with <Kbd className="h-auto min-w-0 px-1.5 py-0.5 rounded border border-border text-[10px] font-mono">Ctrl+V</Kbd>
                    </p>
                  </div>
                )}

                {/* Subtle Privacy Notice Footnote */}
                <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground pt-0.5">
                  <ShieldCheckIcon className="size-4 text-primary/70 shrink-0" />
                  <span>Location &amp; device metadata stripped automatically for student privacy</span>
                </div>

                {/* Streamlined Photo Quality Guide (Collapsible Accordion Below Dropzone) */}
                <Collapsible
                  open={showTips}
                  onOpenChange={setShowTips}
                  className="rounded-xl bg-muted/30 overflow-hidden text-xs"
                >
                  <CollapsibleTrigger
                    render={
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="w-full h-auto justify-between rounded-none px-3.5 py-2.5 hover:bg-muted/50 text-left font-medium text-foreground cursor-pointer"
                      />
                    }
                  >
                    <span className="flex items-center gap-2">
                      <LightbulbIcon data-icon="inline-start" className="text-primary shrink-0" aria-hidden="true" />
                      <span className="text-xs sm:text-sm font-semibold">Photo quality tips</span>
                    </span>
                    <span className="flex items-center gap-1 text-muted-foreground text-xs font-medium">
                      <span>{showTips ? "Hide tips" : "Show tips"}</span>
                      <ChevronDownIcon
                        data-icon="inline-end"
                        className={cn("transition-transform duration-200", showTips && "rotate-180")}
                        aria-hidden="true"
                      />
                    </span>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="px-3.5 pb-3.5 pt-1.5 border-t border-border/40 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs animate-in fade-in-50 duration-150 motion-reduce:animate-none">
                    <div className="flex items-start gap-2.5 p-2 rounded-lg bg-card">
                      <Scan className="size-4 text-primary shrink-0 mt-0.5" aria-hidden="true" />
                      <div>
                        <p className="font-semibold text-foreground text-xs sm:text-sm">
                          90° Overhead Angle
                        </p>
                        <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                          Hold camera flat directly above the paper.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5 p-2 rounded-lg bg-card">
                      <SunMedium className="size-4 text-primary shrink-0 mt-0.5" aria-hidden="true" />
                      <div>
                        <p className="font-semibold text-foreground text-xs sm:text-sm">
                          Even Light
                        </p>
                        <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                          Avoid shadows and strong glare on words.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5 p-2 rounded-lg bg-card">
                      <AlignJustify className="size-4 text-primary shrink-0 mt-0.5" aria-hidden="true" />
                      <div>
                        <p className="font-semibold text-foreground text-xs sm:text-sm">
                          Clear Ruling
                        </p>
                        <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                          Keep headline, midline &amp; baseline visible.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5 p-2 rounded-lg bg-card">
                      <Focus className="size-4 text-primary shrink-0 mt-0.5" aria-hidden="true" />
                      <div>
                        <p className="font-semibold text-foreground text-xs sm:text-sm">
                          Sharp Focus
                        </p>
                        <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                          Tap screen on cursive ink before snapping.
                        </p>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </>
            )}

            {/* Step 3 — Preview + confirm */}
            {step === 3 && selectedFile && (
              <>
                {/* Context Header: Active Student & Activity */}
                <div className="flex items-center justify-between gap-2 p-2.5 px-3 rounded-xl bg-muted/40 border border-border/80 text-xs flex-wrap min-[380px]:flex-nowrap">
                  <div className="flex items-center gap-1.5 min-w-0 flex-1 truncate">
                    <span className="font-semibold text-foreground truncate">
                      {selectedStudent?.full_name ?? "Student"}
                    </span>
                    {selectedStudent?.section && (
                      <span className="text-muted-foreground shrink-0">
                        ({selectedStudent.section})
                      </span>
                    )}
                  </div>
                  <div
                    className="flex items-center gap-1 text-muted-foreground shrink-0 max-w-full min-[380px]:max-w-[50%] truncate font-medium cursor-help"
                    title={
                      selectedActivity?.target_text
                        ? `Activity prompt: "${selectedActivity.target_text}"`
                        : "Activity"
                    }
                  >
                    <span className="truncate">
                      {selectedActivity?.target_text ?? "Activity"}
                    </span>
                  </div>
                </div>
                {/* Duplicate Submission Advisory on Step 3 */}
                {isDuplicateSubmission && (
                  <Alert
                    variant="destructive"
                    className="animate-in fade-in duration-150 motion-reduce:animate-none"
                  >
                    <AlertCircleIcon aria-hidden="true" />
                    <AlertTitle className="text-xs sm:text-sm font-semibold">
                      Worksheet already uploaded this session
                    </AlertTitle>
                    <AlertDescription className="text-xs leading-relaxed">
                      A submission for <strong className="font-medium">{selectedStudent?.full_name ?? "this student"}</strong> was already uploaded for this activity. Submitting again will add another submission attempt.
                    </AlertDescription>
                  </Alert>
                )}

                <div className="rounded-2xl border border-border bg-card p-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FileImageIcon className="size-5 text-primary shrink-0" />
                      <div className="truncate">
                        <p className="text-sm font-semibold truncate text-foreground">
                          {selectedFile.name}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <p className="text-xs text-muted-foreground font-mono tabular-nums">
                            {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                          </p>
                          {rotationDegrees > 0 && (
                            <Badge
                              variant="outline"
                              className="text-[10px] h-4 px-1.5 font-medium border-primary/30 text-primary bg-primary/5"
                            >
                              Rotated {rotationDegrees}°
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-10 sm:size-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
                        onClick={handleRotateClockwise}
                        disabled={isRotating}
                        title="Rotate 90° clockwise"
                        aria-label="Rotate photo 90 degrees clockwise"
                      >
                        {isRotating ? (
                          <Spinner data-icon="inline-start" />
                        ) : (
                          <RotateCwIcon aria-hidden="true" />
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-10 sm:size-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
                        onClick={handleClearFile}
                        aria-label="Remove selected image and select another"
                      >
                        <XIcon aria-hidden="true" />
                      </Button>
                    </div>
                  </div>

                  {previewUrl && (
                    <div
                      className={cn(
                        "relative w-full rounded-xl overflow-hidden bg-muted/40 border border-border flex items-center justify-center transition-[aspect-ratio,max-height] duration-200 touch-pan-y",
                        isPortrait
                          ? "aspect-3/4 max-h-[380px] sm:max-h-[440px]"
                          : "aspect-4/3 max-h-[300px] sm:max-h-[360px]"
                      )}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={previewUrl}
                        alt={
                          selectedStudent
                            ? `Handwriting worksheet preview for ${selectedStudent.full_name}`
                            : "Handwriting worksheet preview"
                        }
                        draggable={false}
                        onLoad={(e) => {
                          const img = e.currentTarget;
                          setIsPortrait(img.naturalHeight >= img.naturalWidth);
                        }}
                        className="size-full object-contain pointer-events-none select-none"
                      />
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Inline error card with rich quality feedback (step 4 failure) */}
            {step === 4 && uploadError && (
              <QualityErrorCard
                error={uploadError}
                previewUrl={previewUrl}
                retryRef={retryButtonRef}
                onRetake={handleRetakePhoto}
                onRetry={handleRetryUpload}
                onProceedAnyway={handleProceedAnyway}
              />
            )}

            {/* Step 5 — Success & Continuous Class Upload Flow */}
            {step === 5 && (
              <div className="flex flex-col items-center justify-center py-6 text-center gap-4 animate-in fade-in-50 zoom-in-95 duration-200 motion-reduce:animate-none">
                <div className="flex size-14 sm:size-16 items-center justify-center rounded-2xl bg-success/10 text-success border border-success/20 shadow-warm">
                  <CheckCircle2Icon className="size-8 sm:size-9" />
                </div>

                <div className="flex flex-col gap-1.5 max-w-sm">
                  <h3 className="text-base sm:text-lg font-semibold text-foreground tracking-tight">
                    Worksheet Submitted!
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    <strong className="text-foreground font-medium">
                      {lastSubmittedStudent ?? "Student"}
                    </strong>
                    &apos;s worksheet for{" "}
                    <strong className="text-foreground font-medium">
                      {lastSubmittedActivity ?? "Activity"}
                    </strong>{" "}
                    will have diagnostic feedback ready shortly.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className="text-xs font-semibold px-2.5 py-0.5 bg-success/10 text-success border-success/30"
                  >
                    <Hash data-icon="inline-start" aria-hidden="true" />
                    {uploadedCount} {uploadedCount === 1 ? "worksheet" : "worksheets"} uploaded this session
                  </Badge>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full max-w-xs sm:max-w-sm pt-2">
                  <Button
                    type="button"
                    variant="default"
                    onClick={handleViewDiagnostic}
                    className="h-10 sm:h-9 text-xs sm:text-sm font-semibold w-full shadow-warm cursor-pointer"
                  >
                    <ArrowRightIcon data-icon="inline-start" aria-hidden="true" />
                    View Diagnostic Results
                  </Button>
                  <Button
                    ref={uploadNextButtonRef}
                    type="button"
                    variant="outline"
                    onClick={handleNextUpload}
                    className="h-10 sm:h-9 text-xs sm:text-sm font-medium w-full cursor-pointer"
                  >
                    <Plus data-icon="inline-start" className="text-muted-foreground" aria-hidden="true" />
                    Upload Next Student
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer actions for Steps 1–3 */}
      {!isUploading && step <= 3 && (
        <DialogFooter className="border-t border-border bg-muted/20 px-4 py-3 sm:px-6 sm:justify-between">
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
              className="h-10 sm:h-9 px-4 text-xs sm:text-sm font-medium cursor-pointer"
            >
              <ArrowLeftIcon data-icon="inline-start" aria-hidden="true" />
              Back
            </Button>
          )}
          {step === 3 && (
            <Button
              variant="outline"
              onClick={handleClearFile}
              className="h-10 sm:h-9 px-4 text-xs sm:text-sm font-medium cursor-pointer"
            >
              <ArrowLeftIcon data-icon="inline-start" aria-hidden="true" />
              Back
            </Button>
          )}

          {step === 1 && (
            <Button
              disabled={!canProceed}
              onClick={() => setStep(2)}
              className="h-10 sm:h-9 px-4 text-xs sm:text-sm font-medium cursor-pointer"
            >
              <span>Next</span>
              <ArrowRightIcon data-icon="inline-end" aria-hidden="true" />
            </Button>
          )}
          {step === 3 && (
            <Button
              ref={submitButtonRef}
              disabled={uploadMutation.isPending}
              onClick={handleRetryUpload}
              className="h-10 sm:h-9 px-5 text-xs sm:text-sm font-semibold shadow-warm cursor-pointer"
            >
              <CheckCircle2Icon data-icon="inline-start" aria-hidden="true" />
              Submit
            </Button>
          )}
        </DialogFooter>
      )}
    </>
  );
}
