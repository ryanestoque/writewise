"use client";

import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel, FieldGroup, FieldContent, FieldError } from "@/components/ui/field";
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
} from "@/components/ui/combobox";
import { Progress } from "@/components/ui/progress";
import { Student } from "@/lib/hooks/use-students";
import { createClient } from "@/lib/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { runConcurrentPool } from "@/lib/utils/concurrent-pool";
import { Loader2, ArrowRightLeft, Check } from "lucide-react";
import { toast } from "sonner";

interface BatchMoveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedStudents: Student[];
  allStudents: Student[];
  onComplete?: () => void;
}

export function BatchMoveDialog({
  open,
  onOpenChange,
  selectedStudents,
  allStudents,
  onComplete,
}: BatchMoveDialogProps) {
  const queryClient = useQueryClient();
  const [targetSection, setTargetSection] = useState("");
  const [sectionError, setSectionError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  // Extract unique sections for the combobox
  const existingSections = useMemo(() => {
    if (!allStudents) return [];
    const sections = new Set(allStudents.map((s) => s.section).filter(Boolean));
    return Array.from(sections).sort();
  }, [allStudents]);

  const handleOpenChange = (newOpen: boolean) => {
    if (isProcessing) return;
    if (!newOpen) {
      setTargetSection("");
      setSectionError(null);
      setProgress(0);
    }
    onOpenChange(newOpen);
  };

  const handleMove = async () => {
    const trimmed = targetSection.trim();
    if (!trimmed) {
      setSectionError("Please enter or select a destination class section.");
      toast.error("Please enter or select a destination class section.");
      return;
    }
    setSectionError(null);

    if (selectedStudents.length === 0) return;

    setIsProcessing(true);
    setProgress(0);

    const supabase = createClient();
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    if (!token) {
      toast.error("Authentication session expired. Please log in again.");
      setIsProcessing(false);
      return;
    }

    const { successCount, failedItems } = await runConcurrentPool(
      selectedStudents,
      async (student) => {
        const response = await fetch(`/api/students/${student.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ section: trimmed }),
        });
        return response.ok;
      },
      {
        concurrency: 4,
        onProgress: (completed, total) => {
          setProgress(Math.round((completed / total) * 100));
        },
      }
    );

    await queryClient.invalidateQueries({ queryKey: ["students"] });
    setIsProcessing(false);

    if (failedItems.length === 0) {
      toast.success(`Moved ${successCount} ${successCount === 1 ? "student" : "students"} to ${trimmed}.`);
      onComplete?.();
      handleOpenChange(false);
    } else if (successCount > 0) {
      toast.warning(`Moved ${successCount} students. ${failedItems.length} failed to update.`);
      onComplete?.();
      handleOpenChange(false);
    } else {
      toast.error("Failed to move students. Please try again.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[calc(100%-1.5rem)] max-w-lg sm:max-w-[460px] max-h-[min(92dvh,calc(100vh-2rem))] flex flex-col p-5 sm:p-6 rounded-2xl sm:rounded-3xl gap-0 overflow-hidden shadow-xl border border-border/80 bg-surface dark:bg-card">
        <DialogHeader className="pb-3 sm:pb-4 shrink-0 text-left">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300 shrink-0">
              <ArrowRightLeft className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="font-heading text-lg sm:text-xl font-semibold tracking-tight text-foreground">Move to Section</DialogTitle>
              <DialogDescription className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Change the class section for {selectedStudents.length}{" "}
                {selectedStudents.length === 1 ? "student" : "selected students"}.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-col flex-1 min-h-0 overflow-hidden pt-1">
          <div className="space-y-4 overflow-y-auto overflow-x-hidden overscroll-contain px-1 py-1 flex-1 min-h-0">
            {/* Target Section */}
            <FieldGroup>
              <Field data-invalid={!!sectionError}>
                <FieldLabel htmlFor="batch_target_section" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Destination Section <span className="text-destructive" aria-hidden="true">*</span>
                </FieldLabel>
                <FieldContent>
                  <Combobox 
                    value={targetSection} 
                    onValueChange={(val: string | null) => {
                      setTargetSection(val || "");
                      if (sectionError) setSectionError(null);
                    }}
                  >
                    <ComboboxInput 
                      id="batch_target_section"
                      placeholder="e.g. Grade 3 - Rizal" 
                      value={targetSection}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        setTargetSection(e.target.value);
                        if (sectionError) setSectionError(null);
                      }}
                      disabled={isProcessing}
                      aria-invalid={!!sectionError}
                      aria-describedby={sectionError ? "batch_target_section_error" : undefined}
                      aria-required="true"
                      autoCapitalize="words"
                      autoCorrect="off"
                      spellCheck={false}
                      className="h-10 sm:h-9.5 text-base sm:text-sm rounded-lg sm:rounded-xl"
                    />
                    {existingSections.length > 0 && (
                      <ComboboxContent>
                        <ComboboxList>
                          {existingSections.map((sec) => (
                            <ComboboxItem key={sec} value={sec} className="py-2.5 px-3">
                              {sec}
                            </ComboboxItem>
                          ))}
                        </ComboboxList>
                      </ComboboxContent>
                    )}
                  </Combobox>
                </FieldContent>
                {sectionError && <FieldError id="batch_target_section_error">{sectionError}</FieldError>}
              </Field>
            </FieldGroup>

            {/* Student Names Summary Preview */}
            <div className="p-3 bg-muted/30 dark:bg-muted/10 rounded-xl border border-border/70 max-h-36 overflow-y-auto text-xs space-y-1.5">
              <span className="font-semibold text-foreground block">
                Selected Students ({selectedStudents.length}):
              </span>
              <div className="flex flex-wrap gap-1.5">
                {selectedStudents.map((s) => (
                  <span
                    key={s.id}
                    className="inline-flex items-center gap-1 bg-background px-2.5 py-1 rounded-md border border-border/80 text-foreground font-medium text-xs shadow-2xs"
                  >
                    {s.full_name} <span className="text-[10px] text-muted-foreground font-normal">({s.section})</span>
                  </span>
                ))}
              </div>
            </div>

            {/* Progress Indicator */}
            {isProcessing && (
              <div className="space-y-2 p-3 bg-muted/40 rounded-xl border border-border">
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="flex items-center gap-1.5 text-foreground">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                    Moving students to {targetSection}...
                  </span>
                  <span className="text-muted-foreground">{progress}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            )}
          </div>

          <div className="flex flex-col-reverse sm:flex-row justify-between items-stretch sm:items-center gap-2 pt-3.5 sm:pt-4 mt-2 border-t border-border shrink-0">
            <Button
              type="button"
              variant="ghost"
              disabled={isProcessing}
              onClick={() => handleOpenChange(false)}
              className="h-10 sm:h-9 w-full sm:w-auto text-muted-foreground hover:text-foreground text-xs sm:text-sm rounded-lg sm:rounded-xl font-medium"
            >
              Cancel
            </Button>

            <Button
              type="button"
              disabled={isProcessing || !targetSection.trim()}
              onClick={handleMove}
              className="h-10 sm:h-9 w-full sm:w-auto bg-primary hover:bg-brand-700 text-primary-foreground font-medium text-xs sm:text-sm rounded-lg sm:rounded-xl shadow-xs"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Moving...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-1.5" />
                  Confirm Move
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
