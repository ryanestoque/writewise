"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Field, FieldLabel, FieldContent, FieldError } from "@/components/ui/field";
import {
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  useSections,
  useCreateSection,
  useUpdateSection,
  useDeleteSection,
  Section,
} from "@/lib/hooks/use-sections";
import { Plus, Trash2, Edit2, Check, X, AlertCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface ManageSectionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ManageSectionsDialog({ open, onOpenChange }: ManageSectionsDialogProps) {
  const { data: sections, isLoading, error, refetch } = useSections();
  const { mutate: createSection, isPending: isCreating } = useCreateSection();
  const { mutate: updateSection, isPending: isUpdating } = useUpdateSection();
  const { mutate: deleteSection, isPending: isDeleting } = useDeleteSection();

  // Create state
  const [newSectionName, setNewSectionName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  // Edit state
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editSectionName, setEditSectionName] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  // Delete confirmation state
  const [sectionToDelete, setSectionToDelete] = useState<Section | null>(null);

  const handleCreate = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = newSectionName.trim();
    if (!trimmed) {
      setCreateError("Please enter a section name.");
      return;
    }

    setCreateError(null);
    createSection(
      { name: trimmed },
      {
        onSuccess: () => {
          toast.success(`Section "${trimmed}" created.`);
          setNewSectionName("");
        },
        onError: (err: unknown) => {
          const errObj = err as { code?: string; message?: string; error?: { code?: string; message?: string } };
          const code = errObj?.error?.code || errObj?.code;
          if (code === "SECTION_NAME_EXISTS") {
            setCreateError("A section with this name already exists.");
          } else {
            const msg = errObj?.error?.message || errObj?.message || "Failed to create section.";
            toast.error(msg);
          }
        },
      }
    );
  };

  const startEdit = (sec: Section) => {
    setEditingSectionId(sec.id);
    setEditSectionName(sec.name);
    setEditError(null);
  };

  const cancelEdit = () => {
    setEditingSectionId(null);
    setEditSectionName("");
    setEditError(null);
  };

  const handleSaveEdit = (sec: Section) => {
    const trimmed = editSectionName.trim();
    if (!trimmed) {
      setEditError("Section name cannot be empty.");
      return;
    }

    if (trimmed === sec.name) {
      cancelEdit();
      return;
    }

    setEditError(null);
    updateSection(
      { id: sec.id, data: { name: trimmed } },
      {
        onSuccess: () => {
          toast.success(`Section renamed to "${trimmed}".`);
          cancelEdit();
        },
        onError: (err: unknown) => {
          const errObj = err as { code?: string; message?: string; error?: { code?: string; message?: string } };
          const code = errObj?.error?.code || errObj?.code;
          if (code === "SECTION_NAME_EXISTS") {
            toast.error("Another section with this name already exists.");
            setEditError("A section with this name already exists.");
          } else {
            const msg = errObj?.error?.message || errObj?.message || "Failed to rename section.";
            toast.error(msg);
          }
        },
      }
    );
  };

  const confirmDelete = () => {
    if (!sectionToDelete) return;

    deleteSection(sectionToDelete.id, {
      onSuccess: () => {
        toast.success(`Section "${sectionToDelete.name}" deleted.`);
        setSectionToDelete(null);
      },
      onError: (err: unknown) => {
        const errObj = err as { code?: string; message?: string; error?: { code?: string; message?: string } };
        const code = errObj?.error?.code || errObj?.code;
        if (code === "SECTION_NOT_EMPTY") {
          toast.error("Cannot delete section with assigned students. Please move students first.");
        } else {
          const msg = errObj?.error?.message || errObj?.message || "Failed to delete section.";
          toast.error(msg);
        }
        setSectionToDelete(null);
      },
    });
  };

  return (
    <TooltipProvider>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[calc(100%-1.5rem)] max-w-lg sm:max-w-[480px] p-5 sm:p-6 rounded-2xl sm:rounded-3xl flex flex-col gap-3.5 sm:gap-4 overflow-hidden shadow-warm border border-border/80 bg-surface dark:bg-card">
          <DialogHeader className="space-y-0 text-left">
            <DialogTitle className="font-heading text-lg font-semibold tracking-tight text-foreground">
              Manage Class Sections
            </DialogTitle>
            <DialogDescription className="sr-only">
              Create, rename, or delete class sections for your roster.
            </DialogDescription>
          </DialogHeader>

          {/* Create Section Input */}
          <form onSubmit={handleCreate}>
            <Field className="space-y-1.5" data-invalid={!!createError}>
              <FieldLabel htmlFor="new-section-name-input" className="sr-only">
                New section name
              </FieldLabel>
              <FieldContent>
                <div className="flex items-center gap-2">
                  <Input
                    id="new-section-name-input"
                    placeholder="New section name (e.g. Diamond, Pearl)"
                    value={newSectionName}
                    onChange={(e) => {
                      setNewSectionName(e.target.value);
                      if (createError) setCreateError(null);
                    }}
                    disabled={isCreating}
                    maxLength={50}
                    aria-invalid={!!createError}
                    aria-describedby={createError ? "new-section-error" : undefined}
                    className="h-10 sm:h-9 text-sm"
                  />
                  <Button
                    type="submit"
                    size="sm"
                    disabled={isCreating || !newSectionName.trim()}
                    className="h-10 sm:h-9 min-h-[40px] sm:min-h-[36px] px-3.5 gap-1.5 shrink-0"
                    aria-label="Add new class section"
                  >
                    {isCreating ? (
                      <Spinner className="w-3.5 h-3.5" />
                    ) : (
                      <Plus className="w-3.5 h-3.5" />
                    )}
                    <span>Add</span>
                  </Button>
                </div>
              </FieldContent>
              {createError && (
                <FieldError id="new-section-error" className="text-xs flex items-center gap-1 mt-1">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  <span>{createError}</span>
                </FieldError>
              )}
            </Field>
          </form>

          {/* Section List */}
          <div className="space-y-2 max-h-[min(50vh,340px)] overflow-y-auto pr-1">
            {isLoading ? (
              <div className="py-8 text-center text-muted-foreground flex flex-col items-center gap-2">
                <Spinner className="w-5 h-5 text-primary" />
                <span className="text-xs">Loading sections...</span>
              </div>
            ) : error ? (
              <div className="py-6 text-center text-destructive text-xs flex flex-col items-center gap-2 border border-destructive/20 rounded-lg bg-destructive/5 p-4">
                <span>Failed to load sections. Please try again.</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => refetch()}
                  className="h-8 px-3 text-xs border-destructive/30 text-destructive hover:bg-destructive/10 gap-1.5"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Try Again</span>
                </Button>
              </div>
            ) : !sections || sections.length === 0 ? (
              <div className="py-8 text-center border border-dashed rounded-lg p-4">
                <p className="text-xs text-muted-foreground">No class sections yet.</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Create a section above or add students with a section name.
                </p>
              </div>
            ) : (
              <ul
                role="list"
                className="divide-y divide-border/50 border border-border/60 rounded-lg overflow-hidden list-none p-0 m-0"
              >
                {sections.map((sec) => {
                  const isEditing = editingSectionId === sec.id;
                  const hasStudents = sec.student_count > 0;
                  const errorId = `edit-section-error-${sec.id}`;

                  return (
                    <li
                      key={sec.id}
                      className="flex items-center justify-between px-3 py-2.5 bg-card hover:bg-muted/30 transition-colors text-sm min-h-[44px]"
                    >
                      {isEditing ? (
                        <div className="flex flex-col flex-1 mr-2 gap-1">
                          <div className="flex items-center gap-1.5 flex-1">
                            <Input
                              value={editSectionName}
                              onChange={(e) => {
                                setEditSectionName(e.target.value);
                                if (editError) setEditError(null);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  handleSaveEdit(sec);
                                } else if (e.key === "Escape") {
                                  cancelEdit();
                                }
                              }}
                              autoFocus
                              maxLength={50}
                              aria-label={`Edit name for section ${sec.name}`}
                              aria-invalid={!!editError}
                              aria-describedby={editError ? errorId : undefined}
                              className="h-10 sm:h-9 text-xs flex-1"
                            />
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleSaveEdit(sec)}
                              disabled={isUpdating}
                              aria-label={`Save renaming for section ${sec.name}`}
                              className="h-10 w-10 sm:h-9 sm:w-9 min-h-[40px] min-w-[40px] sm:min-h-[36px] sm:min-w-[36px] text-primary hover:text-primary hover:bg-primary/10"
                              title="Save"
                            >
                              {isUpdating ? (
                                <Spinner className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                              ) : (
                                <Check className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                              )}
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={cancelEdit}
                              disabled={isUpdating}
                              aria-label={`Cancel editing section ${sec.name}`}
                              className="h-10 w-10 sm:h-9 sm:w-9 min-h-[40px] min-w-[40px] sm:min-h-[36px] sm:min-w-[36px] text-muted-foreground"
                              title="Cancel"
                            >
                              <X className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                            </Button>
                          </div>
                          {editError && (
                            <p
                              id={errorId}
                              role="alert"
                              className="text-[11px] text-destructive flex items-center gap-1"
                            >
                              <AlertCircle className="w-3 h-3 shrink-0" />
                              <span>{editError}</span>
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 flex-1 min-w-0 pr-2">
                          <span className="font-medium text-foreground truncate">
                            {sec.name}
                          </span>
                          <Badge
                            variant={hasStudents ? "secondary" : "outline"}
                            className="text-xs font-medium px-2 py-0.5 shrink-0 font-sans tabular-nums"
                          >
                            {sec.student_count}{" "}
                            {sec.student_count === 1 ? "student" : "students"}
                          </Badge>
                        </div>
                      )}

                      {!isEditing && (
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => startEdit(sec)}
                            aria-label={`Rename section ${sec.name}`}
                            className="h-10 w-10 sm:h-9 sm:w-9 min-h-[40px] min-w-[40px] sm:min-h-[36px] sm:min-w-[36px] text-muted-foreground hover:text-foreground"
                            title="Rename section"
                          >
                            <Edit2 className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                          </Button>

                          {hasStudents ? (
                            <Tooltip>
                              <TooltipTrigger
                                render={
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    aria-disabled="true"
                                    tabIndex={0}
                                    onClick={(e) => e.preventDefault()}
                                    aria-label={`Cannot delete section ${sec.name}: ${sec.student_count} students enrolled`}
                                    className="h-10 w-10 sm:h-9 sm:w-9 min-h-[40px] min-w-[40px] sm:min-h-[36px] sm:min-w-[36px] text-muted-foreground/40 cursor-not-allowed"
                                  >
                                    <Trash2 className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                                  </Button>
                                }
                              />
                              <TooltipContent side="top">
                                Cannot delete: {sec.student_count} student{sec.student_count === 1 ? "" : "s"} enrolled. Move students first.
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => setSectionToDelete(sec)}
                              disabled={isDeleting}
                              aria-label={`Delete section ${sec.name}`}
                              className="h-10 w-10 sm:h-9 sm:w-9 min-h-[40px] min-w-[40px] sm:min-h-[36px] sm:min-w-[36px] text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              title={`Delete section ${sec.name}`}
                            >
                              <Trash2 className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                            </Button>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={Boolean(sectionToDelete)}
        onOpenChange={(open) => !open && setSectionToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-semibold">
              Delete section &quot;{sectionToDelete?.name}&quot;?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              This will remove the section from your class settings. No students are currently in this section.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting} className="text-xs">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={isDeleting}
              variant="destructive"
              className="text-xs"
            >
              {isDeleting ? <Spinner className="w-3.5 h-3.5 mr-1" /> : null}
              Delete Section
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
}

