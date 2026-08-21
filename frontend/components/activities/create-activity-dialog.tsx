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
import { useCreateActivity } from "@/lib/hooks/use-activities";
import {
  Loader2,
  Plus,
  ClipboardList,
  Home,
  AlertTriangle,
  Sparkles,
  Copy,
} from "lucide-react";
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

const PROMPT_SUGGESTIONS = [
  {
    label: "Classic Pangram",
    text: "The quick brown fox jumps over the lazy dog.",
  },
  {
    label: "Loop & Join Drill",
    text: "Sphinx of black quartz, judge my vow.",
  },
  {
    label: "Grade 3 Nature Practice",
    text: "Warm breezes blow through the tall green trees.",
  },
  {
    label: "Letter Formation Warm-up",
    text: "Bright sunny mornings bring cheerful smiles to everyone.",
  },
];

interface CreateActivityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialValues?: {
    target_text?: string;
    is_take_home?: boolean;
  };
  isDuplicate?: boolean;
}

export function CreateActivityDialog({
  open,
  onOpenChange,
  initialValues,
  isDuplicate = false,
}: CreateActivityDialogProps) {
  const { mutate: createActivity, isPending } = useCreateActivity();

  const form = useForm<ActivityFormValues>({
    resolver: zodResolver(activitySchema),
    defaultValues: {
      target_text: initialValues?.target_text ?? "",
      is_take_home: initialValues?.is_take_home ?? false,
    },
  });

  const targetText = useWatch({ control: form.control, name: "target_text" });
  const isTakeHome = useWatch({ control: form.control, name: "is_take_home" });
  const wordCount = getWordCount(targetText || "");

  useEffect(() => {
    if (open) {
      form.reset({
        target_text: initialValues?.target_text ?? "",
        is_take_home: initialValues?.is_take_home ?? false,
      });
    }
  }, [open, initialValues, form]);

  const onSubmit = (data: ActivityFormValues) => {
    createActivity(
      {
        target_text: data.target_text,
        is_take_home: data.is_take_home,
      },
      {
        onSuccess: () => {
          toast.success(
            isDuplicate
              ? "Activity duplicated successfully."
              : "Activity created successfully."
          );
          onOpenChange(false);
        },
        onError: (error: Error) => {
          toast.error(error.message || "Failed to create activity.");
        },
      }
    );
  };

  const handleApplySuggestion = (text: string) => {
    form.setValue("target_text", text, {
      shouldValidate: true,
      shouldDirty: true,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-1.5rem)] max-w-lg sm:max-w-[540px] max-h-[min(92dvh,calc(100vh-2rem))] flex flex-col p-5 sm:p-6 rounded-2xl sm:rounded-3xl gap-0 overflow-hidden shadow-xl border border-border/80 bg-surface dark:bg-card">
        <DialogHeader className="pb-3 sm:pb-4 shrink-0 text-left">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300 shrink-0">
              {isDuplicate ? (
                <Copy className="size-5" />
              ) : (
                <Plus className="size-5" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="font-heading text-lg sm:text-xl font-semibold tracking-tight text-foreground">
                {isDuplicate ? "Duplicate Activity" : "Create Activity"}
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                {isDuplicate
                  ? "Create a new handwriting activity using this prompt as a template."
                  : "Define the target text students will copy in cursive on ruled paper."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col flex-1 min-h-0 overflow-hidden pt-1"
        >
          <div className="space-y-4 overflow-y-auto overflow-x-hidden overscroll-contain px-1 py-1 flex-1 min-h-0">
            <FieldGroup className="space-y-4">
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
                    autoFocus
                  />
                </FieldContent>

                {/* Suggestions / Prompt starters */}
                <div className="mt-2 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                    <Sparkles className="size-3 text-brand-600 dark:text-brand-400" />
                    <span>Quick prompt suggestions:</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {PROMPT_SUGGESTIONS.map((sug) => (
                      <button
                        key={sug.label}
                        type="button"
                        onClick={() => handleApplySuggestion(sug.text)}
                        className="text-[11px] px-2.5 py-1 rounded-md bg-muted/60 hover:bg-brand-50 hover:text-brand-700 dark:hover:bg-brand-950/60 dark:hover:text-brand-300 border border-border/60 hover:border-brand-200 dark:hover:border-brand-800 transition-colors text-muted-foreground cursor-pointer text-left focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                        title={sug.text}
                      >
                        {sug.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Live Cursive Script Preview */}
                {targetText && targetText.trim().length > 0 && (
                  <div className="space-y-1.5 pt-2">
                    <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Sparkles className="size-3 text-brand-600 dark:text-brand-400" />
                        <span>Cursive Worksheet Preview</span>
                      </span>
                      <span className="text-[10px] text-muted-foreground/80">
                        3-line ruling
                      </span>
                    </div>
                    <div className="relative p-3.5 sm:p-4 rounded-xl bg-linear-to-b from-brand-50/20 via-surface to-brand-50/10 dark:from-card dark:to-card/80 border border-brand-200/50 dark:border-border/60 overflow-hidden shadow-2xs">
                      <div
                        className="absolute inset-x-3.5 inset-y-3.5 sm:inset-x-4 sm:inset-y-4 pointer-events-none opacity-40 dark:opacity-20 cursive-guidelines overflow-hidden"
                        aria-hidden="true"
                      />
                      <p className="relative font-cursive text-[32px] leading-[48px] text-foreground/90 font-normal tracking-wide">
                        {targetText}
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between mt-2">
                  <p
                    id="target_text_hint"
                    className="text-xs text-muted-foreground leading-normal"
                  >
                    Recommended: 5–25 words for standard 3-line ruled cursive worksheets.
                  </p>
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
                  id="target_text-error"
                  errors={[form.formState.errors.target_text]}
                />
              </Field>

              {/* Take-Home Toggle */}
              <Field>
                <div className="flex items-center justify-between gap-4 p-3.5 rounded-xl bg-muted/40 border border-border/60">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="flex size-8 items-center justify-center rounded-lg bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300 shrink-0 mt-0.5">
                      <Home className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <FieldLabel
                        htmlFor="is_take_home"
                        className="text-sm font-medium text-foreground cursor-pointer"
                      >
                        Take-home activity
                      </FieldLabel>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-normal">
                        Allow parents to upload completed handwriting photos
                        from home.
                      </p>
                    </div>
                  </div>
                  <Switch
                    id="is_take_home"
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
              ) : isDuplicate ? (
                <Copy className="w-4 h-4 mr-1.5" />
              ) : (
                <ClipboardList className="w-4 h-4 mr-1.5" />
              )}
              {isDuplicate ? "Create Duplicated Activity" : "Create Activity"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}