"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Field,
  FieldContent,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { useActivities } from "@/lib/hooks/use-activities";
import { useStudents } from "@/lib/hooks/use-students";
import { useUploadSubmission } from "@/lib/hooks/use-submissions";
import {
  UploadCloudIcon,
  CameraIcon,
  FileImageIcon,
  CheckCircle2Icon,
  SparklesIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
  XIcon,
  Loader2Icon,
  AlertCircleIcon,
  RotateCcwIcon,
  CheckIcon,
  Scan,
  SunMedium,
  Focus,
  Hash,
  AlignJustify,
  Plus,
  ChevronDownIcon,
  ShieldCheckIcon,
} from "lucide-react";

interface QuickUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-fill activity when opened from an activity detail page */
  prefilledActivityId?: string;
  /** Pre-fill student when opened from a context that knows the student */
  prefilledStudentId?: string;
}

type Step = 1 | 2 | 3 | 4 | 5;

interface UploadError {
  code: string;
  message: string;
}

/** Combobox choice representation */
interface Choice {
  value: string;
  label: string;
  sublabel?: string;
}

const ACCEPTED_MIME_TYPES = ["image/jpeg", "image/png"];
const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15 MB

function isQualityGateError(code: string): boolean {
  return [
    "QUALITY_GATE_RESOLUTION",
    "QUALITY_GATE_BLUR",
    "QUALITY_GATE_BRIGHTNESS",
    "QUALITY_GATE_CONTRAST",
    "SEGMENTATION_COUNT_MISMATCH",
    "UNSUPPORTED_FILE_TYPE",
    "FILE_TOO_LARGE",
  ].includes(code);
}

function errorMessageFor(error: UploadError): string {
  switch (error.code) {
    case "UNSUPPORTED_FILE_TYPE":
      return "That file isn't a supported image. Please choose a JPEG or PNG.";
    case "FILE_TOO_LARGE":
      return "The image is too large. Please use a file 15 MB or smaller.";
    case "NOT_FOUND":
      return "The activity or student wasn't found. It may have been removed.";
    case "VALIDATION_ERROR":
      return "Something's off with the selected activity or student. Please try again.";
    case "QUALITY_GATE_RESOLUTION":
      return "The photo needs more detail to assess cursive strokes clearly. Move a little closer and retake it.";
    case "QUALITY_GATE_BLUR":
      return "The photo is a bit blurry. Hold the camera steady and retake it.";
    case "QUALITY_GATE_BRIGHTNESS":
      return "The photo is too dark or washed out. Try adjusting the lighting and retake it.";
    case "QUALITY_GATE_CONTRAST":
      return "The pencil strokes are faint against the paper. Try adjusting the lighting or angle and retake it.";
    case "SEGMENTATION_COUNT_MISMATCH":
      return "The handwritten words couldn't be matched to the activity sentence. Please check that the student followed the prompt and retake.";
    case "UNAUTHORIZED":
      return "Your session has expired. Please sign in again.";
    case "FORBIDDEN":
      return "You don't have permission to upload submissions for this class.";
    case "MODEL_INFERENCE_ERROR":
      return "The assessment system encountered an issue. Please try submitting again shortly.";
    default:
      return "Upload failed. Please check your connection and try again.";
  }
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
  prefilledStudentId,
}: QuickUploadDialogProps) {
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
        className="max-w-xl p-0 overflow-hidden"
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
  prefilledActivityId,
  prefilledStudentId,
  onUploadingChange,
}: {
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
  const dropzoneRef = useRef<HTMLDivElement>(null);
  const submitButtonRef = useRef<HTMLButtonElement>(null);
  const retryButtonRef = useRef<HTMLButtonElement>(null);
  const uploadNextButtonRef = useRef<HTMLButtonElement>(null);

  const [step, setStep] = useState<Step>(1);
  const [showTips, setShowTips] = useState(false);
  const [activityChoice, setActivityChoice] = useState<Choice | null>(null);
  const [studentChoice, setStudentChoice] = useState<Choice | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<UploadError | null>(null);
  const [uploadedCount, setUploadedCount] = useState(0);
  const [submittedPairs, setSubmittedPairs] = useState<Set<string>>(new Set());
  const [lastSubmittedStudent, setLastSubmittedStudent] = useState<string | null>(
    null
  );
  const [lastSubmittedActivity, setLastSubmittedActivity] = useState<string | null>(
    null
  );

  const { data: activities } = useActivities();
  const { data: students } = useStudents();
  const uploadMutation = useUploadSubmission();

  const isUploading = step === 4 && !uploadError && uploadMutation.isPending;

  // Propagate uploading state to parent dialog to control close guards
  useEffect(() => {
    onUploadingChange?.(isUploading);
  }, [isUploading, onUploadingChange]);

  // Programmatic focus steering upon step transitions
  useEffect(() => {
    if (step === 2) {
      dropzoneRef.current?.focus();
    } else if (step === 3) {
      submitButtonRef.current?.focus();
    } else if (step === 4 && uploadError) {
      retryButtonRef.current?.focus();
    } else if (step === 5) {
      uploadNextButtonRef.current?.focus();
    }
  }, [step, uploadError]);

  // Cleanup object URL on unmount to prevent browser memory leaks
  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
    };
  }, []);

  const activityChoices: Choice[] = useMemo(() => {
    return (
      activities?.map((a) => ({
        value: a.id,
        label: a.target_text,
      })) ?? []
    );
  }, [activities]);

  const studentChoices: Choice[] = useMemo(() => {
    return (
      students?.map((s) => ({
        value: s.id,
        label: s.full_name,
        sublabel: s.section,
      })) ?? []
    );
  }, [students]);

  const selectedActivity = useMemo(() => {
    if (prefilledActivityId) {
      return activities?.find((a) => a.id === prefilledActivityId) ?? null;
    }
    return activities?.find((a) => a.id === activityChoice?.value) ?? null;
  }, [activities, activityChoice, prefilledActivityId]);

  const selectedStudent = useMemo(() => {
    if (prefilledStudentId) {
      return students?.find((s) => s.id === prefilledStudentId) ?? null;
    }
    return students?.find((s) => s.id === studentChoice?.value) ?? null;
  }, [students, studentChoice, prefilledStudentId]);

  const handleClearFile = () => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    if (step === 3) {
      setStep(2);
    }
  };

  const handleNextUpload = () => {
    handleClearFile();
    setUploadError(null);
    // Clear student choice so teacher can select the next child
    if (!prefilledStudentId) {
      setStudentChoice(null);
    }
    // Return to Step 1 (or Step 2 if student was also hard prefilled)
    setStep(prefilledStudentId ? 2 : 1);
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

    // Revoke previous URL if one exists
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
    const activityId = prefilledActivityId ?? activityChoice?.value;
    const studentId = prefilledStudentId ?? studentChoice?.value;
    if (!selectedFile || !activityId || !studentId) return;

    setStep(4);
    setUploadError(null);

    uploadMutation.mutate(
      {
        image: selectedFile,
        activityId,
        studentId,
      },
      {
        onSuccess: () => {
          setUploadedCount((prev) => prev + 1);
          setSubmittedPairs((prev) =>
            new Set(prev).add(`${activityId}:${studentId}`)
          );
          setLastSubmittedStudent(selectedStudent?.full_name ?? "Student");
          setLastSubmittedActivity(selectedActivity?.target_text ?? "Activity");
          toast.success("Submission uploaded successfully.");
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

  const canProceed = Boolean(
    (prefilledActivityId ?? activityChoice) &&
      (prefilledStudentId ?? studentChoice)
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

      <DialogHeader className="p-4 sm:p-6 pb-3 sm:pb-4 border-b border-border pr-12">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
            <UploadCloudIcon className="size-5" />
          </div>
          <div>
            <DialogTitle className="text-base font-semibold text-foreground">
              Upload Student Worksheet
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
              Upload student cursive worksheets for automated assessment and feedback.
            </DialogDescription>
          </div>
        </div>

        {/* 3-Step Interactive Progress Stepper (Anchored Across All Steps) */}
        <nav aria-label="Upload progress" className="mt-4 pt-3 border-t border-border/60">
          <ol className="flex items-center justify-between gap-1.5 sm:gap-2">
            {STEPS.map((s) => {
              const isCompleted = step > s.step || step === 5;
              const isCurrent = step === s.step || (step === 4 && s.step === 3);
              const canJump = isStepNavigable(s.step as Step) && !isUploading && step !== 5;

              return (
                <li
                  key={s.step}
                  className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0"
                  aria-current={isCurrent ? "step" : undefined}
                >
                  {canJump && !isCurrent ? (
                    <button
                      type="button"
                      onClick={() => setStep(s.step as Step)}
                      aria-label={`Jump to Step ${s.step}: ${s.label}`}
                      className="group flex items-center gap-1.5 sm:gap-2 min-w-0 p-1 -m-1 rounded-lg transition-colors hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary text-left"
                    >
                      <div
                        className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-all ${
                          isCompleted
                            ? "bg-primary text-primary-foreground group-hover:bg-primary/90 group-hover:scale-105"
                            : "bg-muted text-muted-foreground group-hover:bg-primary/20 group-hover:text-primary"
                        }`}
                      >
                        {isCompleted ? <CheckIcon className="size-3.5" /> : s.step}
                      </div>
                      <span className="text-xs truncate font-medium text-foreground group-hover:text-primary transition-colors">
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
                        {isCompleted ? <CheckIcon className="size-3.5" /> : s.step}
                      </div>
                      <span
                        className={`text-xs truncate font-medium ${
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

      <div className="p-4 sm:p-6 max-h-[min(75vh,80dvh)] overflow-y-auto">
        {isUploading ? (
          /* Step 4 — Uploading state */
          <div
            aria-busy="true"
            aria-live="polite"
            className="flex flex-col items-center justify-center py-12 space-y-3"
          >
            <Loader2Icon className="size-8 animate-spin text-primary" />
            <p className="text-sm font-medium text-foreground">
              Analyzing worksheet&hellip;
            </p>
            <p className="text-xs text-muted-foreground">
              Checking image clarity and handwriting alignment.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Step 1 — Select student & activity */}
            {step === 1 && (
              <>
                <FieldGroup>
                  <Field>
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
                        <span className="text-[11px] font-normal text-primary flex items-center gap-1 normal-case tracking-normal">
                          <CheckCircle2Icon className="size-3" />
                          Retained from batch
                        </span>
                      )}
                    </FieldLabel>
                    <FieldContent>
                      {prefilledActivityId ? (
                        <div
                          id={activityInputId}
                          role="textbox"
                          aria-readonly="true"
                          tabIndex={0}
                          className="flex items-center justify-between gap-2 h-10 sm:h-9 px-3.5 rounded-lg sm:rounded-xl border border-border bg-muted/40 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          aria-label={`Pre-selected activity: ${
                            selectedActivity?.target_text ?? "Loading activity..."
                          }`}
                        >
                          <span className="truncate font-medium">
                            {selectedActivity?.target_text ??
                              "Loading activity\u2026"}
                          </span>
                          <Badge
                            variant="outline"
                            className="text-[11px] font-medium shrink-0 bg-background/60 border-border/80"
                          >
                            Pre-selected
                          </Badge>
                        </div>
                      ) : (
                        <Combobox
                          value={activityChoice}
                          onValueChange={setActivityChoice}
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
                                No activities found
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
                </FieldGroup>

                <FieldGroup>
                  <Field>
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
                        <div
                          id={studentInputId}
                          role="textbox"
                          aria-readonly="true"
                          tabIndex={0}
                          className="flex items-center justify-between gap-2 h-10 sm:h-9 px-3.5 rounded-lg sm:rounded-xl border border-border bg-muted/40 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          aria-label={`Pre-selected student: ${
                            selectedStudent?.full_name ?? "Loading student..."
                          }`}
                        >
                          <span className="truncate font-medium">
                            {selectedStudent?.full_name ??
                              "Loading student\u2026"}
                          </span>
                          <Badge
                            variant="outline"
                            className="text-[11px] font-medium shrink-0 bg-background/60 border-border/80"
                          >
                            Pre-selected
                          </Badge>
                        </div>
                      ) : (
                        <Combobox
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
                                No students found
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
                                    <span className="text-[11px] text-muted-foreground ml-auto shrink-0 font-medium">
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
                {isDuplicateSubmission && (
                  <div
                    role="status"
                    className="flex items-start gap-2.5 p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200 text-xs animate-in fade-in duration-150"
                  >
                    <AlertCircleIcon className="size-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <p className="font-semibold text-foreground">
                        Worksheet already uploaded this session
                      </p>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        A submission for <strong className="text-foreground font-medium">{selectedStudent?.full_name ?? "this student"}</strong> was already recorded for this activity. Submitting again will add another submission attempt.
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Step 2 — Capture photo */}
            {step === 2 && (
              <>
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

                {/* Interactive Dropzone with Keyboard Activation (Top Centerpiece) */}
                <div
                  ref={dropzoneRef}
                  role="button"
                  tabIndex={0}
                  aria-label="Worksheet photo upload dropzone. Drop an image or press Enter or Space to choose a file."
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
                    <CameraIcon className="size-6" />
                  </div>
                  <p className="text-xs font-semibold text-foreground">
                    Upload or capture worksheet photo
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Supports JPEG or PNG (up to 15MB) &middot; Drag &amp; drop or press Enter
                  </p>

                  {/* Dual Action Triggers */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-xs mt-4">
                    <Button
                      type="button"
                      variant="default"
                      className="h-10 sm:h-9 text-xs font-medium gap-1.5 w-full shadow-warm cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        cameraInputRef.current?.click();
                      }}
                    >
                      <CameraIcon className="size-3.5" />
                      Take Photo
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-10 sm:h-9 text-xs font-medium gap-1.5 w-full bg-background hover:bg-muted cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                    >
                      <FileImageIcon className="size-3.5 text-muted-foreground" />
                      Upload Photo
                    </Button>
                  </div>
                </div>

                {/* Subtle Privacy Notice Footnote */}
                <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground pt-0.5">
                  <ShieldCheckIcon className="size-3.5 text-primary/70 shrink-0" />
                  <span>Location &amp; device metadata stripped automatically for student privacy</span>
                </div>

                {/* Streamlined Photo Quality Guide (Collapsible Accordion Below Dropzone) */}
                <div className="rounded-xl bg-muted/30 overflow-hidden text-xs">
                  <button
                    type="button"
                    onClick={() => setShowTips((prev) => !prev)}
                    className="w-full flex items-center justify-between px-3.5 py-2 hover:bg-muted/50 transition-colors text-left font-medium text-foreground cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    aria-expanded={showTips}
                  >
                    <div className="flex items-center gap-2">
                      <SparklesIcon className="size-3.5 text-primary shrink-0" />
                      <span className="text-xs font-semibold">Photo quality tips</span>
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground text-xs font-normal">
                      <span>{showTips ? "Hide tips" : "Show tips"}</span>
                      <ChevronDownIcon
                        className={`size-3.5 transition-transform duration-200 ${
                          showTips ? "rotate-180" : ""
                        }`}
                      />
                    </div>
                  </button>
                  {showTips && (
                    <div className="px-3.5 pb-3 pt-1 border-t border-border/40 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs animate-in fade-in-50 duration-150">
                      <div className="flex items-start gap-2 p-1.5 rounded-lg bg-background/60 dark:bg-muted/30">
                        <Scan className="size-4 text-primary shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold text-foreground text-[11.5px]">
                            90° Overhead Angle
                          </p>
                          <p className="text-[10.5px] text-muted-foreground leading-tight">
                            Hold camera flat directly above the paper.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2 p-1.5 rounded-lg bg-background/60 dark:bg-muted/30">
                        <SunMedium className="size-4 text-primary shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold text-foreground text-[11.5px]">
                            Even Light
                          </p>
                          <p className="text-[10.5px] text-muted-foreground leading-tight">
                            Avoid shadows and strong glare on words.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2 p-1.5 rounded-lg bg-background/60 dark:bg-muted/30">
                        <AlignJustify className="size-4 text-primary shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold text-foreground text-[11.5px]">
                            Clear Ruling
                          </p>
                          <p className="text-[10.5px] text-muted-foreground leading-tight">
                            Keep headline, midline &amp; baseline visible.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2 p-1.5 rounded-lg bg-background/60 dark:bg-muted/30">
                        <Focus className="size-4 text-primary shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold text-foreground text-[11.5px]">
                            Sharp Focus
                          </p>
                          <p className="text-[10.5px] text-muted-foreground leading-tight">
                            Tap screen on cursive ink before snapping.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Step 3 — Preview + confirm */}
            {step === 3 && selectedFile && (
              <>
                {/* Duplicate Submission Advisory on Step 3 */}
                {isDuplicateSubmission && (
                  <div
                    role="status"
                    className="flex items-start gap-2.5 p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200 text-xs animate-in fade-in duration-150"
                  >
                    <AlertCircleIcon className="size-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <p className="font-semibold text-foreground">
                        Worksheet already uploaded this session
                      </p>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        A submission for <strong className="text-foreground font-medium">{selectedStudent?.full_name ?? "this student"}</strong> was already uploaded for this activity. Submitting again will add another submission attempt.
                      </p>
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50 text-xs">
                  <div className="space-y-0.5 min-w-0 pr-2">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                      Submitting for
                    </p>
                    <p className="font-semibold text-foreground text-sm truncate">
                      {selectedStudent?.full_name ?? "Selected Student"}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className="text-xs font-medium border-border/80 bg-background max-w-[200px] truncate shrink-0"
                    title={selectedActivity?.target_text ?? "Activity"}
                  >
                    {selectedActivity?.target_text ?? "Activity"}
                  </Badge>
                </div>

                <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FileImageIcon className="size-5 text-primary shrink-0" />
                      <div className="truncate">
                        <p className="text-xs font-semibold truncate text-foreground">
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
                      <XIcon className="size-4" />
                    </Button>
                  </div>

                  {previewUrl && (
                    <div className="relative aspect-4/3 w-full rounded-xl overflow-hidden bg-muted/40 border border-border">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={previewUrl}
                        alt={
                          selectedStudent
                            ? `Handwriting worksheet preview for ${selectedStudent.full_name}`
                            : "Handwriting worksheet preview"
                        }
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
                  <AlertCircleIcon className="size-5 shrink-0 mt-0.5" />
                  <div className="space-y-1 min-w-0">
                    <p className="text-xs font-semibold text-destructive">
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
                    <>
                      <Button
                        variant="outline"
                        onClick={() => setStep(3)}
                        className="border-destructive/30 hover:bg-destructive/10 text-destructive shrink-0 h-10 sm:h-9 px-3.5 text-xs font-medium cursor-pointer"
                      >
                        Back to Capture
                      </Button>
                      <Button
                        ref={retryButtonRef}
                        variant="destructive"
                        onClick={() => {
                          handleClearFile();
                        }}
                        className="shrink-0 h-10 sm:h-9 px-3.5 text-xs font-medium gap-1.5 cursor-pointer"
                      >
                        <CameraIcon className="size-3.5" />
                        Retake Photo
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        variant="outline"
                        onClick={() => setStep(3)}
                        className="border-destructive/30 hover:bg-destructive/10 text-destructive shrink-0 h-10 sm:h-9 px-3.5 text-xs font-medium cursor-pointer"
                      >
                        Back to Review
                      </Button>
                      <Button
                        ref={retryButtonRef}
                        variant="destructive"
                        onClick={handleSubmit}
                        className="shrink-0 h-10 sm:h-9 px-3.5 text-xs font-medium gap-1.5 cursor-pointer"
                      >
                        <RotateCcwIcon className="size-3.5" />
                        Retry Upload
                      </Button>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Step 5 — Success & Continuous Class Upload Flow */}
            {step === 5 && (
              <div className="flex flex-col items-center justify-center py-6 text-center space-y-4 animate-in fade-in-50 zoom-in-95 duration-200">
                <div className="flex size-14 sm:size-16 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-900 shadow-warm">
                  <CheckCircle2Icon className="size-8 sm:size-9" />
                </div>

                <div className="space-y-1.5 max-w-sm">
                  <h3 className="text-base font-semibold text-foreground tracking-tight">
                    Worksheet Submitted!
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
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
                    className="text-xs font-semibold px-2.5 py-0.5 bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-900"
                  >
                    <Hash className="size-3 mr-1" />
                    {uploadedCount} {uploadedCount === 1 ? "worksheet" : "worksheets"} uploaded this session
                  </Badge>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full max-w-xs pt-2">
                  <Button
                    ref={uploadNextButtonRef}
                    type="button"
                    variant="default"
                    onClick={handleNextUpload}
                    className="h-10 sm:h-9 text-xs font-medium gap-1.5 w-full shadow-warm bg-primary hover:bg-brand-700 text-primary-foreground cursor-pointer"
                  >
                    <Plus className="size-3.5" />
                    Upload Next Student
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onClose}
                    className="h-10 sm:h-9 text-xs font-medium w-full cursor-pointer"
                  >
                    Done / View Roster
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer actions for Steps 1–3 */}
      {!isUploading && step <= 3 && (
        <div className="flex items-center justify-between p-3.5 sm:p-4 px-4 sm:px-6 border-t border-border bg-muted/20">
          {step === 1 && (
            <Button
              variant="outline"
              onClick={onClose}
              className="h-10 sm:h-9 px-4 text-xs font-medium cursor-pointer"
            >
              Cancel
            </Button>
          )}
          {step === 2 && (
            <Button
              variant="outline"
              onClick={() => setStep(1)}
              className="gap-1.5 h-10 sm:h-9 px-4 text-xs font-medium cursor-pointer"
            >
              <ArrowLeftIcon className="size-3.5" />
              Back
            </Button>
          )}
          {step === 3 && (
            <Button
              variant="outline"
              onClick={handleClearFile}
              className="gap-1.5 h-10 sm:h-9 px-4 text-xs font-medium cursor-pointer"
            >
              <ArrowLeftIcon className="size-3.5" />
              Back
            </Button>
          )}

          {step === 1 && (
            <Button
              disabled={!canProceed}
              onClick={() => setStep(2)}
              className="gap-2 h-10 sm:h-9 px-4 text-xs font-medium cursor-pointer"
            >
              <span>Next</span>
              <ArrowRightIcon className="size-3.5" />
            </Button>
          )}
          {step === 3 && (
            <Button
              ref={submitButtonRef}
              disabled={uploadMutation.isPending}
              onClick={handleSubmit}
              className="gap-2 h-10 sm:h-9 px-5 text-xs sm:text-sm font-semibold shadow-warm cursor-pointer bg-primary hover:bg-brand-700 text-primary-foreground"
            >
              <CheckCircle2Icon className="size-4" />
              Submit
            </Button>
          )}
        </div>
      )}
    </>
  );
}