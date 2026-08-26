"use client";

import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Field,
  FieldLabel,
  FieldGroup,
  FieldError,
  FieldContent,
} from "@/components/ui/field";
import {
  type Activity,
  useUpdateActivity,
} from "@/lib/hooks/use-activities";
import { Loader2, Edit3, Home, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const activitySchema = z.object({
  target_text: z
    .string()
    .min(1, "Target text is required")
    .refine((v) => v.trim().length > 0, "Target text must not be blank"),
  is_take_home: z.boolean(),
});

type ActivityFormValues = z.infer<typeof activitySchema>;

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
  onOpenChange,
}: EditActivityDialogProps) {
  const { mutate: updateActivity, isPending } = useUpdateActivity();

  const form = useForm<ActivityFormValues>({
    resolver: zodResolver(activitySchema),
    defaultValues: {
      target_text: activity?.target_text ?? "",
      is_take_home: activity?.is_take_home ?? false,
    },
  });

  const targetText = useWatch({ control: form.control, name: "target_text" });
  const isTakeHome = useWatch({ control: form.control, name: "is_take_home" });
  const wordCount = getWordCount(targetText || "");

  useEffect(() => {
    if (activity && open) {
      form.reset({
        target_text: activity.target_text,
        is_take_home: activity.is_take_home,
      });
    }
  }, [activity, open, form]);

  const onSubmit = (data: ActivityFormValues) => {
    if (!activity) return;

    updateActivity(
      {
        id: activity.id,
        data: {
          target_text: data.target_text,
          is_take_home: data.is_take_home,
        },
      },
      {
        onSuccess: () => {
          toast.success("Activity updated successfully.");
          onOpenChange(false);
        },
        onError: (error: Error) => {
          toast.error(error.message || "Failed to update activity.");
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-1.5rem)] max-w-lg sm:max-w-[520px] max-h-[min(92dvh,calc(100vh-2rem))] flex flex-col p-5 sm:p-6 rounded-2xl sm:rounded-3xl gap-0 overflow-hidden shadow-warm border border-border/80 bg-surface dark:bg-card">
        <DialogHeader className="pb-3 sm:pb-4 shrink-0 text-left">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300 shrink-0">
              <Edit3 className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="font-heading text-lg sm:text-xl font-semibold tracking-tight text-foreground">
                Edit Activity
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Update the target text or take-home assignment setting.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col flex-1 min-h-0 overflow-hidden pt-1"
        >
          <div className="overflow-y-auto overflow-x-hidden overscroll-contain px-1 py-1 flex-1 min-h-0">
            <FieldGroup>
              {/* Target Text */}
              <Field data-invalid={!!form.formState.errors.target_text}>
                <FieldLabel
                  htmlFor="edit_target_text"
                  className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  Target Text{" "}
                  <span className="text-destructive" aria-hidden="true">
                    *
                  </span>
                </FieldLabel>
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
                    placeholder="e.g., the quick brown fox jumps over the lazy dog"
                    className="min-h-24 text-base sm:text-sm rounded-lg sm:rounded-xl"
                  />
                </FieldContent>

                {/* Live Cursive Script Preview */}
                {targetText && targetText.trim().length > 0 && (
                  <div className="space-y-1.5 pt-2">
                    <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                      <span>Cursive Worksheet Preview</span>
                      <span className="text-xs text-muted-foreground font-medium">
                        3-line ruling
                      </span>
                    </div>
                    <div className="relative p-3.5 sm:p-4 pb-5 sm:pb-6 rounded-xl bg-linear-to-b from-brand-50/20 via-surface to-brand-50/10 dark:from-card dark:to-card/80 border border-brand-200/50 dark:border-border/60 overflow-hidden shadow-2xs">
                      <div className="relative">
                        <div
                          className="absolute inset-0 pointer-events-none opacity-40 dark:opacity-20 cursive-guidelines overflow-hidden"
                          aria-hidden="true"
                        />
                        <p className="relative font-cursive text-[34px] leading-[48px] text-foreground/90 font-normal tracking-wide break-words">
                          {targetText}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between mt-1.5">
                  <p
                    id="edit_target_text_hint"
                    className="text-xs text-muted-foreground leading-normal"
                  >
                    Recommended: 5–25 words for standard 3-line worksheet.
                  </p>
                  <span
                    className="text-xs font-medium text-muted-foreground tabular-nums shrink-0 ml-2"
                    aria-live="polite"
                    aria-label={`${wordCount} ${wordCount === 1 ? "word" : "words"}`}
                  >
                    {wordCount} {wordCount === 1 ? "word" : "words"}
                  </span>
                </div>

                {wordCount > 0 && wordCount < 3 && (
                  <div className="flex items-center gap-1.5 mt-1.5 p-2 rounded-lg bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900 text-xs text-amber-800 dark:text-amber-300">
                    <AlertTriangle className="size-3.5 shrink-0" />
                    <span>
                      Short prompt ({wordCount} {wordCount === 1 ? "word" : "words"}): At least 3 words recommended for reliable spacing and slant assessment.
                    </span>
                  </div>
                )}

                {wordCount > 35 && (
                  <div className="flex items-center gap-1.5 mt-1.5 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-xs text-amber-800 dark:text-amber-300">
                    <AlertTriangle className="size-3.5 shrink-0" />
                    <span>
                      Long prompt ({wordCount} words) may exceed standard single-page 3-line ruled worksheets.
                    </span>
                  </div>
                )}
                <FieldError
                  id="edit_target_text-error"
                  errors={[form.formState.errors.target_text]}
                />
              </Field>

              {/* Take-Home Toggle */}
              <Field>
                <div className="flex items-center justify-between gap-4 p-3 rounded-xl bg-muted/40 border border-border/60">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="flex size-8 items-center justify-center rounded-lg bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300 shrink-0 mt-0.5">
                      <Home className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <FieldLabel
                        htmlFor="edit_is_take_home"
                        className="text-sm font-medium text-foreground cursor-pointer"
                      >
                        Take-home activity
                      </FieldLabel>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-normal">
                        Allow parents to upload submissions for this activity.
                      </p>
                    </div>
                  </div>
                  <Switch
                    id="edit_is_take_home"
                    checked={isTakeHome}
                    onCheckedChange={(checked: boolean) =>
                      form.setValue("is_take_home", checked)
                    }
                  />
                </div>
              </Field>
            </FieldGroup>
          </div>

          <div className="flex flex-col-reverse sm:flex-row justify-between items-stretch sm:items-center gap-2 pt-3.5 sm:pt-4 mt-2 border-t border-border shrink-0">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="h-10 sm:h-9 min-h-[44px] sm:min-h-[36px] w-full sm:w-auto text-muted-foreground hover:text-foreground text-xs sm:text-sm rounded-lg sm:rounded-xl font-medium cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="h-10 sm:h-9 min-h-[44px] sm:min-h-[36px] w-full sm:w-auto bg-primary hover:bg-brand-700 text-primary-foreground font-medium text-xs sm:text-sm rounded-lg sm:rounded-xl shadow-xs cursor-pointer"
            >
              {isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Edit3 className="w-4 h-4 mr-1.5" />
              )}
              Save Changes
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
