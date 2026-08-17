"use client";

import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel, FieldGroup, FieldContent } from "@/components/ui/field";
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
      setProgress(0);
    }
    onOpenChange(newOpen);
  };

  const handleMove = async () => {
    const trimmed = targetSection.trim();
    if (!trimmed) {
      toast.error("Please enter or select a destination class section.");
      return;
    }

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
      <DialogContent className="sm:max-w-[460px] rounded-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-brand-100 text-brand-700">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="font-heading text-xl">Move to Section</DialogTitle>
              <DialogDescription className="text-sm">
                Change the class section for {selectedStudents.length}{" "}
                {selectedStudents.length === 1 ? "student" : "selected students"}.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Target Section */}
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="batch_target_section" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Destination Section <span className="text-destructive" aria-hidden="true">*</span>
              </FieldLabel>
              <FieldContent>
                <Combobox 
                  value={targetSection} 
                  onValueChange={(val: string | null) => setTargetSection(val || "")}
                >
                  <ComboboxInput 
                    id="batch_target_section"
                    placeholder="e.g. Grade 3 - Rizal" 
                    value={targetSection}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTargetSection(e.target.value)}
                    disabled={isProcessing}
                    aria-required="true"
                    className="h-10"
                  />
                  {existingSections.length > 0 && (
                    <ComboboxContent>
                      <ComboboxList>
                        {existingSections.map((sec) => (
                          <ComboboxItem key={sec} value={sec}>
                            {sec}
                          </ComboboxItem>
                        ))}
                      </ComboboxList>
                    </ComboboxContent>
                  )}
                </Combobox>
              </FieldContent>
            </Field>
          </FieldGroup>

          {/* Student Names Summary Preview */}
          <div className="p-3 bg-muted/30 rounded-xl border border-border/70 max-h-32 overflow-y-auto text-xs space-y-1">
            <span className="font-semibold text-foreground block mb-1">
              Selected Students ({selectedStudents.length}):
            </span>
            <div className="flex flex-wrap gap-1.5">
              {selectedStudents.map((s) => (
                <span
                  key={s.id}
                  className="bg-background px-2 py-0.5 rounded-md border border-border/80 text-muted-foreground"
                >
                  {s.full_name} <span className="text-[10px] text-muted-foreground/70">({s.section})</span>
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

          <div className="flex items-center justify-between gap-3 pt-4 border-t border-border">
            <Button
              type="button"
              variant="ghost"
              disabled={isProcessing}
              onClick={() => handleOpenChange(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              Cancel
            </Button>

            <Button
              type="button"
              disabled={isProcessing || !targetSection.trim()}
              onClick={handleMove}
              className="bg-primary hover:bg-brand-700 text-primary-foreground font-medium shadow-xs"
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
