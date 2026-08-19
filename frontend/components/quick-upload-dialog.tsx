"use client";

import { useMemo, useRef, useState } from "react";
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
} from "lucide-react";

interface QuickUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-fill activity when opened from an activity detail page */
  prefilledActivityId?: string;
  /** Pre-fill student when opened from a context that knows the student */
  prefilledStudentId?: string;
}

type Step = 1 | 2 | 3 | 4;

interface UploadError {
  code: string;
  message: string;
}

/** Combobox choice — same object instance is shared between Root value and Item value */
interface Choice {
  value: string;
  label: string;
}

const ACCEPTED_MIME_TYPES = ["image/jpeg", "image/png"];
const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15 MB

function errorMessageFor(error: UploadError): string {
  switch (error.code) {
    case "UNSUPPORTED_FILE_TYPE":
      return "That file isn't a supported image. Please use a JPEG or PNG.";
    case "FILE_TOO_LARGE":
      return "The image is too large. Please use a file 15 MB or smaller.";
    case "NOT_FOUND":
      return "The activity or student wasn't found. It may have been removed.";
    case "VALIDATION_ERROR":
      return "Something's off with the selected activity or student. Please try again.";
    default:
      return "Upload failed. Please check your connection and try again.";
  }
}

export function QuickUploadDialog({
  open,
  onOpenChange,
  prefilledActivityId,
  prefilledStudentId,
}: QuickUploadDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-0 overflow-hidden">
        {/* key remounts the flow on every open/close so state starts fresh */}
        <UploadFlow
          key={open ? "open" : "closed"}
          onClose={() => onOpenChange(false)}
          prefilledActivityId={prefilledActivityId}
          prefilledStudentId={prefilledStudentId}
        />
      </DialogContent>
    </Dialog>
  );
}

function UploadFlow({
  onClose,
  prefilledActivityId,
  prefilledStudentId,
}: {
  onClose: () => void;
  prefilledActivityId?: string;
  prefilledStudentId?: string;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);
  const [step, setStep] = useState<Step>(1);
  const [activityChoice, setActivityChoice] = useState<Choice | null>(null);
  const [studentChoice, setStudentChoice] = useState<Choice | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<UploadError | null>(null);

  const { data: activities } = useActivities();
  const { data: students } = useStudents();
  const uploadMutation = useUploadSubmission();

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
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
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
          toast.success("Submission uploaded.");
          onClose();
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
  const isUploading = step === 4 && !uploadError;

  return (
    <>
      <DialogHeader className="p-6 pb-4 border-b">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
            <UploadCloudIcon className="size-5" />
          </div>
          <div>
            <DialogTitle className="text-base font-semibold text-foreground">
              Upload Handwriting Worksheets
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
              Upload student cursive worksheets for automated OpenCV & CNN
              assessment.
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <div className="p-6 max-h-[75vh] overflow-y-auto">
        {isUploading ? (
          /* Step 4 — Uploading state */
          <div className="flex flex-col items-center justify-center py-12 space-y-3">
            <Loader2Icon className="size-8 animate-spin text-primary" />
            <p className="text-sm font-medium text-foreground">
              Uploading worksheet&hellip;
            </p>
            <p className="text-xs text-muted-foreground">
              This usually takes a few seconds.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Step 1 — Select student & activity */}
            {step === 1 && (
              <>
                <FieldGroup>
                  <Field>
                    <FieldLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Activity{" "}
                      <span className="text-destructive" aria-hidden="true">
                        *
                      </span>
                    </FieldLabel>
                    <FieldContent>
                      {prefilledActivityId ? (
                        <div
                          className="flex items-center justify-between gap-2 h-10 px-3.5 rounded-lg sm:rounded-xl border border-border bg-muted/40 text-sm text-foreground"
                          aria-label="Pre-selected activity"
                        >
                          <span className="truncate">
                            {selectedActivity?.target_text ??
                              "Loading activity&hellip;"}
                          </span>
                          <Badge
                            variant="outline"
                            className="text-[10px] font-semibold shrink-0 bg-background/60 border-border/80"
                          >
                            Pre-selected
                          </Badge>
                        </div>
                      ) : (
                        <Combobox
                          value={activityChoice}
                          onValueChange={setActivityChoice}
                        >
                          <ComboboxInput
                            placeholder="Search activities..."
                            className="h-10 sm:h-9.5 text-base sm:text-sm rounded-lg sm:rounded-xl"
                          />
                          <ComboboxContent>
                            <ComboboxList>
                              <ComboboxEmpty>
                                No activities found
                              </ComboboxEmpty>
                              {activities?.map((a) => (
                                <ComboboxItem
                                  key={a.id}
                                  value={{
                                    value: a.id,
                                    label: a.target_text,
                                  }}
                                  className="py-2.5 px-3"
                                >
                                  <span className="truncate">
                                    {a.target_text}
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
                    <FieldLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Student{" "}
                      <span className="text-destructive" aria-hidden="true">
                        *
                      </span>
                    </FieldLabel>
                    <FieldContent>
                      {prefilledStudentId ? (
                        <div
                          className="flex items-center justify-between gap-2 h-10 px-3.5 rounded-lg sm:rounded-xl border border-border bg-muted/40 text-sm text-foreground"
                          aria-label="Pre-selected student"
                        >
                          <span className="truncate">
                            {selectedStudent?.full_name ??
                              "Loading student&hellip;"}
                          </span>
                          <Badge
                            variant="outline"
                            className="text-[10px] font-semibold shrink-0 bg-background/60 border-border/80"
                          >
                            Pre-selected
                          </Badge>
                        </div>
                      ) : (
                        <Combobox
                          value={studentChoice}
                          onValueChange={setStudentChoice}
                        >
                          <ComboboxInput
                            placeholder="Search students..."
                            className="h-10 sm:h-9.5 text-base sm:text-sm rounded-lg sm:rounded-xl"
                          />
                          <ComboboxContent>
                            <ComboboxList>
                              <ComboboxEmpty>
                                No students found
                              </ComboboxEmpty>
                              {students?.map((s) => (
                                <ComboboxItem
                                  key={s.id}
                                  value={{
                                    value: s.id,
                                    label: s.full_name,
                                  }}
                                  className="py-2.5 px-3"
                                >
                                  <span className="truncate">
                                    {s.full_name}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground ml-auto shrink-0">
                                    {s.section}
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
              </>
            )}

            {/* Step 2 — Capture photo */}
            {step === 2 && (
              <>
                {/* Capture Best Practices */}
                <div className="rounded-xl bg-muted/50 border p-3.5 space-y-2">
                  <div className="flex items-center gap-2">
                    <SparklesIcon className="size-4 text-primary shrink-0" />
                    <span className="text-xs font-semibold text-foreground">
                      Quality Guidelines for Accurate Assessment
                    </span>
                  </div>
                  <ul className="text-[11px] text-muted-foreground space-y-1.5 pl-1">
                    <li className="flex items-center gap-2">
                      <CheckCircle2Icon className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>
                        Keep paper flat under even, natural or overhead
                        lighting.
                      </span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2Icon className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>
                        Ensure guideline rules (top, mid, baseline) are clearly
                        visible.
                      </span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2Icon className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>
                        Avoid extreme perspective angles or shadows cast across
                        words.
                      </span>
                    </li>
                  </ul>
                </div>

                {/* Upload Dropzone */}
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/jpeg,image/png"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => handleFileChange(e.target.files?.[0])}
                />

                <div
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
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex flex-col items-center justify-center p-8 rounded-2xl border-2 border-dashed transition-all cursor-pointer text-center ${
                    isDragging
                      ? "border-primary bg-primary/5 scale-[0.99]"
                      : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30"
                  }`}
                >
                  <div className="flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground mb-3">
                    <CameraIcon className="size-6" />
                  </div>
                  <p className="text-xs font-semibold text-foreground">
                    Click to browse or drag &amp; drop worksheet photo
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Supports JPEG or PNG (up to 15MB)
                  </p>
                  <Badge
                    variant="outline"
                    className="mt-3 text-[10px] font-normal border-border/80"
                  >
                    EXIF GPS metadata stripped unconditionally
                  </Badge>
                </div>
              </>
            )}

            {/* Step 3 — Preview + confirm */}
            {step === 3 && selectedFile && (
              <>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Student:{" "}
                  <span className="font-medium text-foreground">
                    {selectedStudent?.full_name ?? "Unknown student"}
                  </span>{" "}
                  &middot; Activity:{" "}
                  <span className="font-medium text-foreground">
                    {selectedActivity?.target_text ?? "Unknown activity"}
                  </span>
                </p>

                <div className="rounded-2xl border bg-card p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FileImageIcon className="size-5 text-primary shrink-0" />
                      <div className="truncate">
                        <p className="text-xs font-semibold truncate text-foreground">
                          {selectedFile.name}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 rounded-lg text-muted-foreground hover:text-foreground"
                      onClick={handleClearFile}
                      aria-label="Remove selected image"
                    >
                      <XIcon className="size-4" />
                    </Button>
                  </div>

                  {previewUrl && (
                    <div className="relative aspect-4/3 w-full rounded-xl overflow-hidden bg-black/5 dark:bg-white/5 border">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={previewUrl}
                        alt="Worksheet scan preview"
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
                className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-xl border border-destructive/20 bg-destructive/10 text-destructive"
              >
                <div className="flex items-center gap-3">
                  <AlertCircleIcon className="w-5 h-5 shrink-0" />
                  <span className="text-sm font-medium">
                    {errorMessageFor(uploadError)}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setStep(3)}
                  className="border-destructive/30 hover:bg-destructive/10 text-destructive shrink-0"
                >
                  <RotateCcwIcon className="w-4 h-4 mr-1.5" />
                  Try Again
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer actions */}
      {!isUploading && (
        <div className="flex items-center justify-between p-4 px-6 border-t bg-muted/20">
          {step === 1 && (
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="text-xs"
            >
              Cancel
            </Button>
          )}
          {step === 2 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setStep(1)}
              className="gap-1.5 text-xs"
            >
              <ArrowLeftIcon className="size-3.5" />
              Back
            </Button>
          )}
          {step === 3 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                handleClearFile();
                setStep(2);
              }}
              className="gap-1.5 text-xs"
            >
              <ArrowLeftIcon className="size-3.5" />
              Retake
            </Button>
          )}
          {step === 4 && <span />}

          {step === 1 && (
            <Button
              size="sm"
              disabled={!canProceed}
              onClick={() => setStep(2)}
              className="gap-2 text-xs font-medium"
            >
              <span>Next</span>
              <ArrowRightIcon className="size-3.5" />
            </Button>
          )}
          {step === 3 && (
            <Button
              size="sm"
              disabled={uploadMutation.isPending}
              onClick={handleSubmit}
              className="gap-2 text-xs font-medium"
            >
              <UploadCloudIcon className="size-3.5" />
              Submit
            </Button>
          )}
        </div>
      )}
    </>
  );
}