"use client";

import { useState, useMemo } from "react";
import {
  ResponsiveModal,
  ResponsiveModalBody,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from "@/components/shared/responsive-modal";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem } from "@/components/ui/combobox";
import { Progress } from "@/components/ui/progress";
import { Student } from "@/lib/hooks/use-students";
import { useSections } from "@/lib/hooks/use-sections";
import { createClient } from "@/lib/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { runConcurrentPool } from "@/lib/utils/concurrent-pool";
import { ApiError, handleApiResponse } from "@/lib/utils/api-error";
import { Check, Plus } from "lucide-react";
import { toast } from "@/components/ui/toast";

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
  onComplete }: BatchMoveDialogProps) {
  const queryClient = useQueryClient();
  const { data: sectionEntities } = useSections();
  const [targetSection, setTargetSection] = useState("");
  const [sectionError, setSectionError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  // Extract unique sections for the combobox
  const existingSections = useMemo(() => {
    const secSet = new Set<string>();
    if (sectionEntities) {
      sectionEntities.forEach((s) => secSet.add(s.name));
    }
    if (allStudents) {
      allStudents.forEach((s) => s.section && secSet.add(s.section));
    }
    return Array.from(secSet).sort();
  }, [sectionEntities, allStudents]);

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
      toast.add({ type: "error", title: "Please enter or select a destination class section." });
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
      toast.add({ type: "error", title: "Authentication session expired. Please log in again." });
      setIsProcessing(false);
      return;
    }

    let authExpired = false;
    const { successCount, failedItems } = await runConcurrentPool(
      selectedStudents,
      async (student) => {
        const response = await fetch(`/api/students/${student.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}` },
          body: JSON.stringify({ section: trimmed }) });
        try {
          await handleApiResponse(response);
          return true;
        } catch (err) {
          if (err instanceof ApiError && err.code === "UNAUTHORIZED") {
            authExpired = true;
          }
          return false;
        }
      },
      {
        concurrency: 4,
        onProgress: (completed, total) => {
          setProgress(Math.round((completed / total) * 100));
        } }
    );

    await queryClient.invalidateQueries({ queryKey: ["students"] });
    setIsProcessing(false);

    if (authExpired) {
      toast.add({ type: "error", title: "Session expired. Please sign in again." });
    } else if (failedItems.length === 0) {
      toast.add({ type: "success", title: `Moved ${successCount} ${successCount === 1 ? "student" : "students"} to ${trimmed}.` });
      onComplete?.();
      handleOpenChange(false);
    } else if (successCount > 0) {
      toast.add({ type: "warning", title: `Moved ${successCount} students. ${failedItems.length} failed to update.` });
      onComplete?.();
      handleOpenChange(false);
    } else {
      toast.add({ type: "error", title: "Failed to move students. Please try again." });
    }
  };

  return (
    <ResponsiveModal open={open} onOpenChange={handleOpenChange}>
      <ResponsiveModalContent className="w-[calc(100%-1.5rem)] max-w-lg sm:max-w-[460px] max-h-[min(92dvh,calc(100dvh-2rem))] flex flex-col p-5 sm:p-6 rounded-2xl sm:rounded-3xl gap-0 overflow-hidden shadow-warm border border-border/80 bg-card">
        <ResponsiveModalHeader className="pb-3 sm:pb-4 shrink-0 text-left">
          <ResponsiveModalTitle className="font-heading text-lg sm:text-xl font-semibold tracking-tight text-foreground">Move to Section</ResponsiveModalTitle>
          <ResponsiveModalDescription className="sr-only">
            Change the class section for {selectedStudents.length}{" "}
            {selectedStudents.length === 1 ? "student" : "selected students"}.
          </ResponsiveModalDescription>
        </ResponsiveModalHeader>

        <div className="flex flex-col flex-1 min-h-0 overflow-hidden pt-1">
          <ResponsiveModalBody className="flex flex-col gap-3 overflow-x-hidden px-5 py-1 md:px-1">
            {/* Target Section */}
            <FieldGroup>
              <Field data-invalid={Boolean(sectionError) || undefined}>
                <FieldLabel htmlFor="batch_target_section" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Destination Section <span className="text-destructive" aria-hidden="true">*</span>
                </FieldLabel>
                <FieldContent>
                  {(() => {
                    const trimmedInput = targetSection.trim();
                    const isCustomSection =
                      trimmedInput.length > 0 &&
                      !existingSections.some(
                        (sec) => sec.toLowerCase() === trimmedInput.toLowerCase()
                      );

                    return (
                      <Combobox 
                        value={targetSection} 
                        onValueChange={(val: string | null) => {
                          setTargetSection(val || "");
                          if (sectionError) setSectionError(null);
                        }}
                      >
                        <ComboboxInput 
                          id="batch_target_section"
                          aria-label="Destination Class Section"
                          placeholder="e.g. Section Rizal" 
                          value={targetSection}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                            setTargetSection(e.target.value);
                            if (sectionError) setSectionError(null);
                          }}
                          disabled={isProcessing}
                          aria-invalid={!!sectionError}
                          aria-describedby={sectionError ? "batch_target_section_error batch_section_hint" : "batch_section_hint"}
                          aria-required="true"
                          autoCapitalize="words"
                          autoCorrect="off"
                          spellCheck={false}
                          className="h-10 sm:h-9 text-base sm:text-sm rounded-lg sm:rounded-xl"
                        />
                        {(existingSections.length > 0 || isCustomSection) && (
                          <ComboboxContent>
                            <ComboboxList>
                              {existingSections.map((sec) => (
                                <ComboboxItem key={sec} value={sec} className="py-2.5 px-3">
                                  {sec}
                                </ComboboxItem>
                              ))}
                              {isCustomSection && (
                                <ComboboxItem value={trimmedInput} className="py-2.5 px-3 text-primary font-medium">
                                  <Plus aria-hidden="true" />
                                  Create section &ldquo;{trimmedInput}&rdquo;
                                </ComboboxItem>
                              )}
                            </ComboboxList>
                          </ComboboxContent>
                        )}
                      </Combobox>
                    );
                  })()}
                </FieldContent>
                <FieldDescription id="batch_section_hint" className="text-xs mt-1">
                  Type a new section name or select from existing sections.
                </FieldDescription>
                {sectionError && <FieldError id="batch_target_section_error">{sectionError}</FieldError>}
              </Field>
            </FieldGroup>

            {/* Student Names Summary Preview */}
            <Card size="sm" className="bg-muted/30 py-0">
              <CardContent className="p-3 max-h-36 overflow-y-auto text-xs flex flex-col gap-1.5">
                <span className="font-semibold text-foreground block">
                  Selected Students ({selectedStudents.length}):
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {selectedStudents.map((s) => (
                    <Badge key={s.id} variant="outline" className="bg-background font-medium">
                      {s.full_name} <span className="text-[10px] text-muted-foreground font-normal">({s.section})</span>
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Progress Indicator */}
            {isProcessing && (
              <Card size="sm" className="bg-muted/40 py-0">
                <CardContent className="flex flex-col gap-2 p-3">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className="flex items-center gap-1.5 text-foreground">
                      <Spinner className="size-3.5 text-primary" />
                      Moving students to {targetSection}...
                    </span>
                    <span className="text-muted-foreground">{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </CardContent>
              </Card>
            )}
          </ResponsiveModalBody>

          <ResponsiveModalFooter className="pt-3.5 sm:pt-4 mt-2 border-t border-border sm:justify-between shrink-0">
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
              className="h-10 sm:h-9 w-full sm:w-auto font-medium text-xs sm:text-sm rounded-lg sm:rounded-xl shadow-xs"
            >
              {isProcessing ? (
                <>
                  <Spinner data-icon="inline-start" />
                  Moving...
                </>
              ) : (
                <>
                  <Check data-icon="inline-start" aria-hidden="true" />
                  Confirm Move
                </>
              )}
            </Button>
          </ResponsiveModalFooter>
        </div>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
