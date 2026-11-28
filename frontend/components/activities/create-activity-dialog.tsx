"use client";

import { useEffect, useRef } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ActivityTitleField,
  ActivityRosterField,
  ActivityOptionalSettings,
  activitySchema,
  type ActivityFormValues } from "./activity-assignment-fields";
import { toActivityDueAt } from "@/lib/utils/activity-deadlines";
import { ApiError } from "@/lib/utils/api-error";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { type Activity, useCreateActivity } from "@/lib/hooks/use-activities";
import {
  AlertTriangle,
  ClipboardList,
  Copy,
  Home,
} from "lucide-react";
import { toast } from "@/components/ui/toast";

function getWordCount(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
}

const PROMPT_SUGGESTIONS = [
  {
    label: "Classic Pangram",
    text: "The quick brown fox jumps over the lazy dog." },
  {
    label: "Loop & Join Drill",
    text: "Sphinx of black quartz, judge my vow." },
  {
    label: "Nature Practice Drill",
    text: "Warm breezes blow through the tall green trees." },
  {
    label: "Letter Formation Warm-up",
    text: "Bright sunny mornings bring cheerful smiles to everyone." },
];

interface CreateActivityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialValues?: Partial<Activity>;
  isDuplicate?: boolean;
}

function activityDraftDefaults(initialValues?: Partial<Activity>): ActivityFormValues {
  return {
    title: initialValues?.title ?? "",
    instructions: initialValues?.instructions ?? "",
    assignments: initialValues?.assignments ?? [],
    due_input: "",
    close_after_due: false,
    target_text: initialValues?.target_text ?? "",
    is_take_home: initialValues?.is_take_home ?? false,
    points_input: initialValues?.points_possible?.toString() ?? "",
    confirm_remove_points: false };
}

export function CreateActivityDialog({
  open,
  onOpenChange,
  initialValues,
  isDuplicate = false }: CreateActivityDialogProps) {
  const { mutate: createActivity, isPending } = useCreateActivity();
  const sourceKey = isDuplicate ? `duplicate:${initialValues?.id ?? ""}` : "create";
  const draftSourceRef = useRef(sourceKey);

  const form = useForm<ActivityFormValues>({
    resolver: zodResolver(activitySchema),
    defaultValues: activityDraftDefaults(initialValues) });

  const targetText = useWatch({ control: form.control, name: "target_text" });
  const isTakeHome = useWatch({ control: form.control, name: "is_take_home" });
  const wordCount = getWordCount(targetText || "");

  useEffect(() => {
    // Reopening or a fresh props object must not replace an unsaved draft.
    if (open && draftSourceRef.current !== sourceKey) {
      draftSourceRef.current = sourceKey;
      form.reset(activityDraftDefaults(initialValues));
    }
  }, [open, sourceKey, initialValues, form]);

  const onSubmit = (data: ActivityFormValues) => {
    if (!data.assignments.length) {
      form.setError("assignments", { message: "Choose at least one section or student." });
      return;
    }
    createActivity(
      {
        title: data.title,
        instructions: data.instructions.trim() || null,
        assignments: data.assignments,
        due_at: toActivityDueAt(data.due_input),
        close_after_due: data.close_after_due,
        target_text: data.target_text,
        is_take_home: data.is_take_home,
        points_possible: data.points_input || null },
      {
        onSuccess: () => {
          form.reset();
          toast.add({
            type: "success",
            title: isDuplicate
              ? "Activity duplicated successfully."
              : "Activity created successfully.",
          });
          onOpenChange(false);
        },
        onError: (error: Error) => {
          if (error instanceof ApiError && error.code === "INVALID_ASSIGNMENT_TARGET") {
            form.setError("assignments", {
              message: "Choose sections or students from your current roster." });
          }
          toast.add({ type: "error", title: error.message || "Failed to create activity." });
        } }
    );
  };

  const handleApplySuggestion = (text: string) => {
    const previous = form.getValues("target_text")?.trim() ?? "";
    const isCustomText =
      previous.length > 0 &&
      previous !== text &&
      !PROMPT_SUGGESTIONS.some((s) => s.text === previous);

    form.setValue("target_text", text, {
      shouldValidate: true,
      shouldDirty: true });

    if (isCustomText) {
      toast.add({
        title: "Replaced custom prompt text",
        actionProps: {
          children: "Undo",
          onClick: () => {
            form.setValue("target_text", previous, {
              shouldValidate: true,
              shouldDirty: true });
          },
        },
      });
    }
  };

  const hasInitialOptional = Boolean(
    initialValues?.instructions?.trim() || initialValues?.points_possible != null
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-1.5rem)] max-w-lg sm:max-w-[540px] max-h-[min(92dvh,calc(100dvh-2rem))] flex flex-col p-5 sm:p-6 rounded-2xl sm:rounded-3xl gap-0 overflow-hidden shadow-warm">
        <DialogHeader className="pb-3 sm:pb-4 shrink-0 text-left">
          <DialogTitle className="font-heading text-lg sm:text-xl font-semibold tracking-tight text-foreground">
            {isDuplicate ? "Duplicate Activity" : "Create Activity"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {isDuplicate
              ? "Create a new handwriting activity using this prompt as a template."
              : "Define the target text students will copy in cursive on ruled paper."}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col flex-1 min-h-0 overflow-hidden pt-1"
        >
          <div className="overflow-y-auto overflow-x-hidden overscroll-contain px-1 py-1 flex-1 min-h-0">
            <FieldGroup>
              {/* Chunk 1: Activity Prompt */}
              <ActivityTitleField form={form} autoFocus />

              {/* Target Text */}
              <Field data-invalid={!!form.formState.errors.target_text}>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <FieldLabel
                    htmlFor="target_text"
                    className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    Target Text{" "}
                    <span className="text-destructive" aria-hidden="true">
                      *
                    </span>
                  </FieldLabel>

                  {/* Word count live indicator */}
                  <span
                    className="text-xs font-medium text-muted-foreground tabular-nums"
                    aria-live="polite"
                    aria-label={`${wordCount} ${wordCount === 1 ? "word" : "words"}`}
                  >
                    {wordCount} {wordCount === 1 ? "word" : "words"}
                  </span>
                </div>

                <FieldContent>
                  <Textarea
                    id="target_text"
                    {...form.register("target_text")}
                    aria-invalid={!!form.formState.errors.target_text}
                    aria-describedby={
                      form.formState.errors.target_text
                        ? "target_text-error target_text_hint"
                        : "target_text_hint"
                    }
                    aria-required="true"
                    placeholder="e.g., The quick brown fox jumps over the lazy dog."
                    className="min-h-24 text-base sm:text-sm rounded-lg sm:rounded-xl focus-visible:ring-brand-500"
                  />
                </FieldContent>

                {/* Suggestions / Prompt starters */}
                <div className="mt-2 flex flex-col gap-1.5">
                  <div className="text-xs font-medium text-muted-foreground">
                    <span>Quick prompt suggestions:</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {PROMPT_SUGGESTIONS.map((sug) => (
                      <Button
                        key={sug.label}
                        type="button"
                        variant="outline"
                        size="xs"
                        onClick={() => handleApplySuggestion(sug.text)}
                        className="min-h-10 sm:min-h-0 cursor-pointer font-normal text-muted-foreground hover:text-foreground"
                        title={sug.text}
                      >
                        {sug.label}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Live Cursive Script Preview */}
                {targetText && targetText.trim().length > 0 && (
                  <div className="flex flex-col gap-1.5 pt-2">
                    <FieldDescription className="text-xs font-medium">
                      Cursive Worksheet Preview
                    </FieldDescription>
                    <div className="relative p-3.5 sm:p-4 pb-5 sm:pb-6 rounded-xl bg-muted/20 border border-border/60 overflow-hidden shadow-2xs">
                      <div className="relative overflow-hidden">
                        <div
                          className="absolute inset-0 pointer-events-none cursive-guidelines overflow-hidden"
                          aria-hidden="true"
                        />
                        {/* impeccable-disable-next-line design-system-font-size -- optical alignment to 48px baseline ruling grid */}
                        <p
                          className="relative z-10 font-cursive text-[34px]/[48px] sm:text-[36px]/[48px] leading-[48px] text-foreground/90 font-medium tracking-wide break-words"
                          style={{ lineHeight: "48px" }}
                        >
                          {targetText}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <FieldDescription id="target_text_hint" className="mt-2 text-xs">
                  Recommended: 5–25 words for standard 3-line ruled cursive worksheets.
                </FieldDescription>

                {wordCount > 0 && wordCount < 3 && (
                  <Alert className="mt-1.5 border-band-2/40 bg-band-2/15 text-band-2-text *:data-[slot=alert-description]:text-band-2-text">
                    <AlertTriangle aria-hidden="true" />
                    <AlertDescription className="text-xs">
                      Short prompt ({wordCount} {wordCount === 1 ? "word" : "words"}): At least 3 words recommended for reliable spacing and slant assessment.
                    </AlertDescription>
                  </Alert>
                )}

                {wordCount > 35 && (
                  <Alert className="mt-1.5 border-band-2/40 bg-band-2/15 text-band-2-text *:data-[slot=alert-description]:text-band-2-text">
                    <AlertTriangle aria-hidden="true" />
                    <AlertDescription className="text-xs">
                      Long prompt ({wordCount} words) may exceed standard single-page 3-line ruled worksheets.
                    </AlertDescription>
                  </Alert>
                )}
                <FieldError
                  id="target_text-error"
                  errors={[form.formState.errors.target_text]}
                />
              </Field>

              {/* Take-Home Toggle */}
              <Field
                orientation="horizontal"
                className="items-center justify-between gap-4 rounded-xl border border-border/60 bg-muted/40 p-3.5"
              >
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                  <Home className="size-4" aria-hidden="true" />
                </div>
                <FieldContent>
                  <FieldLabel htmlFor="is_take_home" className="cursor-pointer">
                    Take-home activity
                  </FieldLabel>
                  <FieldDescription className="text-xs">
                    Allow parents to upload completed handwriting photos from home.
                  </FieldDescription>
                </FieldContent>
                <Switch
                  id="is_take_home"
                  checked={isTakeHome}
                  onCheckedChange={(checked: boolean) =>
                    form.setValue("is_take_home", checked)
                  }
                />
              </Field>

              {/* Chunk 2: Assignment & Optional Settings */}
              <ActivityRosterField form={form} />
              <ActivityOptionalSettings form={form} defaultOpen={hasInitialOptional} />
            </FieldGroup>
          </div>

          <Separator className="mt-2 shrink-0" />
          <DialogFooter className="pt-3.5 sm:pt-4 sm:justify-between shrink-0">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="h-10 sm:h-9 min-h-11 sm:min-h-9 w-full sm:w-auto text-muted-foreground hover:text-foreground text-xs sm:text-sm rounded-lg sm:rounded-xl font-medium cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="h-10 sm:h-9 min-h-11 sm:min-h-9 w-full sm:w-auto font-medium text-xs sm:text-sm rounded-lg sm:rounded-xl shadow-xs cursor-pointer"
            >
              {isPending ? (
                <Spinner data-icon="inline-start" />
              ) : isDuplicate ? (
                <Copy data-icon="inline-start" aria-hidden="true" />
              ) : (
                <ClipboardList data-icon="inline-start" aria-hidden="true" />
              )}
              {isDuplicate ? "Create Duplicated Activity" : "Create Activity"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
