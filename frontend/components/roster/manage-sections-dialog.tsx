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
import {
  useSections,
  useCreateSection,
  useUpdateSection,
  useDeleteSection,
  Section,
} from "@/lib/hooks/use-sections";
import { Plus, Trash2, Edit2, Check, X, Layers, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface ManageSectionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ManageSectionsDialog({ open, onOpenChange }: ManageSectionsDialogProps) {
  const { data: sections, isLoading, error } = useSections();
  const { mutate: createSection, isPending: isCreating } = useCreateSection();
  const { mutate: updateSection, isPending: isUpdating } = useUpdateSection();
  const { mutate: deleteSection, isPending: isDeleting } = useDeleteSection();

  // Create state
  const [newSectionName, setNewSectionName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  // Edit state
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editSectionName, setEditSectionName] = useState("");

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
  };

  const cancelEdit = () => {
    setEditingSectionId(null);
    setEditSectionName("");
  };

  const handleSaveEdit = (sec: Section) => {
    const trimmed = editSectionName.trim();
    if (!trimmed || trimmed === sec.name) {
      cancelEdit();
      return;
    }

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
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px] p-6 space-y-6">
          <DialogHeader className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <Layers className="w-5 h-5" />
              </div>
              <DialogTitle className="font-heading text-lg font-semibold tracking-tight">
                Manage Class Sections
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              Create, rename, or delete class sections for your roster.
            </DialogDescription>
          </DialogHeader>

          {/* Create Section Input */}
          <form onSubmit={handleCreate} className="space-y-2">
            <div className="flex items-center gap-2">
              <Input
                placeholder="New section name (e.g. Diamond, Pearl)"
                value={newSectionName}
                onChange={(e) => {
                  setNewSectionName(e.target.value);
                  if (createError) setCreateError(null);
                }}
                disabled={isCreating}
                className="h-9 text-sm"
              />
              <Button
                type="submit"
                size="sm"
                disabled={isCreating || !newSectionName.trim()}
                className="gap-1.5 shrink-0"
              >
                {isCreating ? (
                  <Spinner className="w-3.5 h-3.5" />
                ) : (
                  <Plus className="w-3.5 h-3.5" />
                )}
                <span>Add</span>
              </Button>
            </div>
            {createError && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="w-3 h-3 shrink-0" />
                <span>{createError}</span>
              </p>
            )}
          </form>

          {/* Section List */}
          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
            {isLoading ? (
              <div className="py-8 text-center text-muted-foreground flex flex-col items-center gap-2">
                <Spinner className="w-5 h-5 text-primary" />
                <span className="text-xs">Loading sections...</span>
              </div>
            ) : error ? (
              <div className="py-6 text-center text-destructive text-xs">
                Failed to load sections. Please try again.
              </div>
            ) : !sections || sections.length === 0 ? (
              <div className="py-8 text-center border border-dashed rounded-lg p-4">
                <p className="text-xs text-muted-foreground">No class sections yet.</p>
                <p className="text-[11px] text-muted-foreground/80 mt-0.5">
                  Create a section above or add students with a section name.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border/50 border border-border/60 rounded-lg overflow-hidden">
                {sections.map((sec) => {
                  const isEditing = editingSectionId === sec.id;
                  const hasStudents = sec.student_count > 0;

                  return (
                    <div
                      key={sec.id}
                      className="flex items-center justify-between px-3 py-2.5 bg-card hover:bg-muted/30 transition-colors text-sm"
                    >
                      {isEditing ? (
                        <div className="flex items-center gap-1.5 flex-1 mr-2">
                          <Input
                            value={editSectionName}
                            onChange={(e) => setEditSectionName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleSaveEdit(sec);
                              } else if (e.key === "Escape") {
                                cancelEdit();
                              }
                            }}
                            autoFocus
                            className="h-8 text-xs flex-1"
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleSaveEdit(sec)}
                            disabled={isUpdating}
                            className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                            title="Save"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={cancelEdit}
                            className="h-8 w-8 text-muted-foreground"
                            title="Cancel"
                          >
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 flex-1 min-w-0 pr-2">
                          <span className="font-medium text-foreground truncate">
                            {sec.name}
                          </span>
                          <Badge
                            variant={hasStudents ? "secondary" : "outline"}
                            className="text-[11px] font-normal px-2 py-0 shrink-0"
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
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            title="Rename section"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>

                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setSectionToDelete(sec)}
                            disabled={hasStudents || isDeleting}
                            className={`h-8 w-8 ${
                              hasStudents
                                ? "text-muted-foreground/40 cursor-not-allowed"
                                : "text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            }`}
                            title={
                              hasStudents
                                ? "Cannot delete: students are enrolled. Move students first."
                                : "Delete section"
                            }
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
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
              className="text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? <Spinner className="w-3.5 h-3.5 mr-1" /> : null}
              Delete Section
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
