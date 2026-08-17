"use client";

import { useStudents, useRemoveStudent, Student } from "@/lib/hooks/use-students";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { MoreHorizontal, Plus, Loader2, Trash2, Edit2, Users, AlertCircle, RotateCcw } from "lucide-react";
import { StudentDialog } from "@/components/roster/student-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useState } from "react";
import { toast } from "sonner";

export default function RosterPage() {
  const { data: students, isLoading, error, refetch } = useStudents();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [studentToEdit, setStudentToEdit] = useState<Student | null>(null);

  const handleEdit = (student: Student) => {
    setStudentToEdit(student);
    setIsDialogOpen(true);
  };

  const handleOpenNew = () => {
    setStudentToEdit(null);
    setIsDialogOpen(true);
  };

  if (error) {
    return (
      <div className="p-4 sm:p-6 md:p-8 max-w-5xl mx-auto">
        <div
          role="alert"
          className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl border border-destructive/20 bg-destructive/10 text-destructive"
        >
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span className="text-sm font-medium">Failed to load roster: {error.message}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="border-destructive/30 hover:bg-destructive/10 text-destructive"
          >
            <RotateCcw className="w-4 h-4 mr-1.5" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-heading font-semibold text-foreground">Class Roster</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage students and class sections for handwriting activities.
          </p>
        </div>
        <Button onClick={handleOpenNew} className="bg-primary hover:bg-brand-700 text-primary-foreground shadow-xs self-start sm:self-auto">
          <Plus className="w-4 h-4 mr-2" />
          Add Student
        </Button>
      </div>

      <div className="bg-surface border border-border rounded-sm shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow className="border-b border-border hover:bg-transparent">
                <TableHead className="font-heading font-medium text-foreground">Name</TableHead>
                <TableHead className="font-heading font-medium text-foreground">Section</TableHead>
                <TableHead className="font-heading font-medium text-foreground">Date Added</TableHead>
                <TableHead className="text-right font-heading font-medium text-foreground">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-40 text-center">
                    <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                      <span className="text-sm">Loading roster...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : students?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="p-0">
                    <Empty className="py-12 border-0">
                      <EmptyMedia variant="icon" className="bg-brand-100 text-brand-700">
                        <Users className="w-6 h-6" />
                      </EmptyMedia>
                      <EmptyHeader>
                        <EmptyTitle>No students yet</EmptyTitle>
                        <EmptyDescription>
                          Add your first student to start creating activities and tracking handwriting progress.
                        </EmptyDescription>
                      </EmptyHeader>
                      <EmptyContent>
                        <Button onClick={handleOpenNew} size="sm" className="bg-primary hover:bg-brand-700 text-primary-foreground">
                          <Plus className="w-4 h-4 mr-2" />
                          Add Student
                        </Button>
                      </EmptyContent>
                    </Empty>
                  </TableCell>
                </TableRow>
              ) : (
                students?.map((student) => (
                  <TableRow key={student.id} className="border-b border-border/60 hover:bg-muted/30 transition-colors">
                    <TableCell className="text-foreground font-medium">{student.full_name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      <Badge variant="secondary" className="font-normal text-xs bg-brand-100/70 text-brand-700">
                        {student.section}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(student.created_at).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      <RowActions student={student} onEdit={() => handleEdit(student)} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <StudentDialog 
        open={isDialogOpen} 
        onOpenChange={setIsDialogOpen} 
        student={studentToEdit}
      />
    </div>
  );
}

function RowActions({ student, onEdit }: { student: Student; onEdit: () => void }) {
  const { mutate: removeStudent, isPending } = useRemoveStudent();

  const handleRemove = () => {
    removeStudent(student.id, {
      onSuccess: () => {
        toast.success(`Removed ${student.full_name} from roster.`);
      },
      onError: (err: Error) => {
        toast.error(err.message || "Failed to remove student");
      }
    });
  };

  return (
    <AlertDialog>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              aria-label={`Actions for ${student.full_name}`}
            />
          }
        >
          <span className="sr-only">Actions for {student.full_name}</span>
          <MoreHorizontal className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="rounded-xl min-w-36">
          <DropdownMenuItem onClick={onEdit} className="cursor-pointer">
            <Edit2 className="w-4 h-4 mr-2 text-muted-foreground" />
            Edit
          </DropdownMenuItem>
          <AlertDialogTrigger
            nativeButton={false}
            render={
              <DropdownMenuItem variant="destructive" className="cursor-pointer text-destructive focus:text-destructive">
                <Trash2 className="w-4 h-4 mr-2" />
                Remove
              </DropdownMenuItem>
            }
          />
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialogContent className="rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-heading">Remove Student?</AlertDialogTitle>
          <AlertDialogDescription>
            This will unenroll <strong className="text-foreground">{student.full_name}</strong> from your roster. Their historical data will not be deleted, but they will no longer appear in your active class list.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-lg">Cancel</AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleRemove} 
            disabled={isPending}
            variant="destructive"
            className="rounded-lg bg-destructive hover:bg-destructive/90 text-white"
          >
            {isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Remove
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
