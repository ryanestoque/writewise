"use client";

import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ActivityTitleField,
  ActivityRosterField,
  ActivityOptionalSettings,
  activitySchema,
  type ActivityFormValues } from "./activity-assignment-fields";
import { toActivityDueAt, toActivityDueInput } from "@/lib/utils/activity-deadlines";
import { ApiError } from "@/lib/utils/api-error";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ResponsiveModal,
  ResponsiveModalBody,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from "@/components/shared/responsive-modal";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  type Activity,
  useUpdateActivity,
} from "@/lib/hooks/use-activities";
import { AlertTriangle, Edit3, Home } from "lucide-react";
import { toast } from "@/components/ui/toast";

function getWordCount(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
}

interface EditActivityDialogProps {
  activity: Activity | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditActivityDialog({
  activity,
  open,
  onOpenChange }: EditActivityDialogProps) {
  const { mutate: updateActivity, isPending } = useUpdateActivity();
  const [removeConfirmation, setRemoveConfirmation] = useState(false);

  const form = useForm<ActivityFormValues>({
    resolver: zodResolver(activitySchema),
    defaultValues: {
      title: activity?.title ?? "",
      instructions: activity?.instructions ?? "",
      assignments: activity?.assignments ?? [],
      due_input: toActivityDueInput(activity?.due_at ?? null),
      close_after_due: activity?.close_after_due ?? false,
      target_text: activity?.target_text ?? "",
      is_take_home: activity?.is_take_home ?? false,
      points_input: activity?.points_possible?.toString() ?? "",
      confirm_remove_points: false } });

  const targetText = useWatch({ control: form.control, name: "target_text" });
  const isTakeHome = useWatch({ control: form.control, name: "is_take_home" });
  const points = useWatch({ control: form.control, name: "points_input" });
  const wordCount = getWordCount(targetText || "");

  useEffect(() => {
    if (activity && open) {
      form.reset({
        title: activity.title,
        instructions: activity.instructions ?? "",
        assignments: activity.assignments,
        due_input: toActivityDueInput(activity.due_at),
        close_after_due: activity.close_after_due,
        target_text: activity.target_text,
        is_take_home: activity.is_take_home,
        points_input: activity.points_possible?.toString() ?? "",
        confirm_remove_points: false });
    }
  }, [activity, open, form]);

  const onSubmit = (data: ActivityFormValues) => {
    if (!activity) return;
    if (activity.points_possible !== null && !data.points_input && !data.confirm_remove_points) {
      setRemoveConfirmation(true);
      return;
    }
    if (!data.assignments.length && activity.assignments.length) {
      form.setError("assignments", { message: "Choose at least one section or student." });
      return;
    }

    updateActivity(
      {
        id: activity.id,
        data: {
          title: data.title,
          instructions: data.instructions.trim() || null,
          ...(form.formState.dirtyFields.assignments && data.assignments.length
            ? { assignments: data.assignments }
            : {}),
          due_at: toActivityDueAt(data.due_input),
          close_after_due: data.close_after_due,
          target_text: data.target_text,
          is_take_home: data.is_take_home,
          ...(form.formState.dirtyFields.points_input || data.confirm_remove_points
            ? { points_possible: data.points_input || null }
            : {}),
          confirm_remove_points: data.confirm_remove_points } },
      {
        onSuccess: () => {
          toast.add({ type: "success", title: "Activity updated successfully." });
          onOpenChange(false);
        },
        onError: (error: Error) => {
          if (error instanceof ApiError && error.code === "POINTS_OVERRIDE_CONFLICT") {
            form.setError("points_input", {
              message: "An existing override exceeds this maximum. Adjust the override first." });
          }
          if (error instanceof ApiError && error.code === "POINTS_REMOVAL_CONFIRMATION_REQUIRED") {
            form.setError("points_input", {
              message: "Confirm removal of points and existing grade publication." });
          }
          if (error instanceof ApiError && error.code === "INVALID_ASSIGNMENT_TARGET") {
            form.setError("assignments", {
              message: "Choose sections or students from your current roster." });
          }
          toast.add({ type: "error", title: error.message || "Failed to update activity." });
        } }
    );
  };

  const hasExistingOptional = Boolean(
    activity?.instructions?.trim() ||
      activity?.points_possible != null ||
      activity?.due_at != null
  );

  const pointsNotice = (
    <>
      {activity?.points_possible != null && !points && (
        <Alert className="border-band-2/40 bg-band-2/15 text-band-2-text *:data-[slot=alert-description]:text-band-2-text">
          <AlertTriangle aria-hidden="true" />
          <AlertDescription className="text-xs">
            Saving will ask you to confirm removal of existing point grades.
          </AlertDescription>
        </Alert>
      )}
      {activity?.points_possible != null &&
        points &&
        Number(points) !== activity.points_possible && (
          <FieldDescription className="text-xs">
            Changing the maximum returns point grades to draft. Release them again after review.
          </FieldDescription>
        )}
    </>
  );

  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <ResponsiveModalContent className="w-[calc(100%-1.5rem)] max-w-lg sm:max-w-[540px] max-h-[min(92dvh,calc(100dvh-2rem))] flex flex-col p-5 sm:p-6 rounded-2xl sm:rounded-3xl gap-0 overflow-hidden shadow-warm">
        <ResponsiveModalHeader className="pb-3 sm:pb-4 shrink-0 text-left">
          <ResponsiveModalTitle className="font-heading text-lg sm:text-xl font-semibold tracking-tight text-foreground">
            Edit Activity
          </ResponsiveModalTitle>
          <ResponsiveModalDescription className="sr-only">
            Update the title, target text, assignments, instructions, due date, or take-home setting.
          </ResponsiveModalDescription>
        </ResponsiveModalHeader>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col flex-1 min-h-0 overflow-hidden pt-1"
        >
          <ResponsiveModalBody className="overflow-x-hidden px-5 py-2 md:px-1 md:py-1">
            <FieldGroup>
              {/* Chunk 1: Activity Prompt */}
              <ActivityTitleField form={form} />

              {/* Target Text */}
              <Field data-invalid={!!form.formState.errors.target_text}>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <FieldLabel
                    htmlFor="edit_target_text"
                    className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    Target Text{" "}
                    <span className="text-destructive" aria-hidden="true">
                      *
                    </span>
                  </FieldLabel>

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
                    id="edit_target_text"
                    {...form.register("target_text")}
                    aria-invalid={!!form.formState.errors.target_text}
                    aria-describedby={
                      form.formState.errors.target_text
                        ? "edit_target_text-error edit_target_text_hint"
                        : "edit_target_text_hint"
                    }
                    aria-required="true"
                    placeholder="e.g., The quick brown fox jumps over the lazy dog."
                    className="min-h-24 text-base sm:text-sm rounded-lg sm:rounded-xl focus-visible:ring-brand-500"
                  />
                </FieldContent>

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

                <FieldDescription id="edit_target_text_hint" className="mt-2 text-xs">
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
                  id="edit_target_text-error"
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
                  <FieldLabel htmlFor="edit_is_take_home" className="cursor-pointer">
                    Take-home activity
                  </FieldLabel>
                  <FieldDescription className="text-xs">
                    Allow parents to upload completed handwriting photos from home.
                  </FieldDescription>
                </FieldContent>
                <Switch
                  id="edit_is_take_home"
                  checked={isTakeHome}
                  onCheckedChange={(checked: boolean) =>
                    form.setValue("is_take_home", checked)
                  }
                />
              </Field>

              {/* Chunk 2: Assignment & Optional Settings */}
              <ActivityRosterField form={form} />
              <ActivityOptionalSettings
                key={activity?.id ?? "edit-options"}
                form={form}
                defaultOpen={hasExistingOptional}
                pointsNotice={pointsNotice}
              />
            </FieldGroup>
          </ResponsiveModalBody>

          <Separator className="mt-2 shrink-0" />
          <ResponsiveModalFooter className="pt-3.5 sm:pt-4 sm:justify-between shrink-0">
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
              ) : (
                <Edit3 data-icon="inline-start" aria-hidden="true" />
              )}
              Save Changes
            </Button>
          </ResponsiveModalFooter>
        </form>
        <AlertDialog open={removeConfirmation} onOpenChange={setRemoveConfirmation}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove points from this activity?</AlertDialogTitle>
              <AlertDialogDescription>
                All teacher point overrides will be cleared, and published point grades withdrawn.
                Handwriting assessments remain available. Restoring points later requires releasing
                grades again.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep editing</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() => {
                  setRemoveConfirmation(false);
                  onSubmit({ ...form.getValues(), confirm_remove_points: true });
                }}
              >
                Remove points and save
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
