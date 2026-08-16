"use client";

import { useStudents, useRemoveStudent } from "@/lib/hooks/use-students";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Plus, Loader2, Trash2, Edit2 } from "lucide-react";
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
import { toast } from "sonner"; // Assuming sonner is used for toasts (from shadcn preset)
import { Student } from "@/lib/hooks/use-students";

export default function RosterPage() {
  const { data: students, isLoading, error } = useStudents();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [studentToEdit, setStudentToEdit] = useState<Student | null>(null);

  if (error) {
    return <div className="p-8 text-red-500">Error loading roster: {error.message}</div>;
  }

  const handleEdit = (student: Student) => {
    setStudentToEdit(student);
    setIsDialogOpen(true);
  };

  const handleOpenNew = () => {
    setStudentToEdit(null);
    setIsDialogOpen(true);
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-poppins font-semibold text-primary">Class Roster</h1>
        <Button onClick={handleOpenNew} className="rounded-lg bg-[#1B6B63] hover:bg-[#145049] text-white">
          <Plus className="w-4 h-4 mr-2" />
          Add Student
        </Button>
      </div>

      <div className="bg-surface border border-border rounded-sm shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead className="font-poppins font-medium text-text-primary">Name</TableHead>
              <TableHead className="font-poppins font-medium text-text-primary">Section</TableHead>
              <TableHead className="font-poppins font-medium text-text-primary">Date Added</TableHead>
              <TableHead className="text-right font-poppins font-medium text-text-primary">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : students?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-32 text-center text-text-secondary">
                  No students yet. Add your first student to start creating activities.
                </TableCell>
              </TableRow>
            ) : (
              students?.map((student) => (
                <TableRow key={student.id}>
                  <TableCell className="font-inter text-text-primary font-medium">{student.full_name}</TableCell>
                  <TableCell className="font-inter text-text-secondary">{student.section}</TableCell>
                  <TableCell className="font-inter text-text-secondary">
                    {new Date(student.created_at).toLocaleDateString()}
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
        toast.error(`Error: ${err.message || 'Failed to remove student'}`);
      }
    });
  };

  return (
    <AlertDialog>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" className="h-8 w-8 p-0" />}>
          <span className="sr-only">Open menu</span>
          <MoreHorizontal className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="rounded-xl">
          <DropdownMenuItem onClick={onEdit} className="cursor-pointer">
            <Edit2 className="w-4 h-4 mr-2 text-text-secondary" />
            Edit
          </DropdownMenuItem>
          <AlertDialogTrigger render={<DropdownMenuItem className="cursor-pointer text-red-600 focus:text-red-700" />}>
            <Trash2 className="w-4 h-4 mr-2" />
            Remove
          </AlertDialogTrigger>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialogContent className="rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-poppins">Remove Student?</AlertDialogTitle>
          <AlertDialogDescription className="font-inter">
            This will unenroll <strong>{student.full_name}</strong> from your roster. Their historical data will not be deleted, but they will no longer appear in your active class list.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-lg">Cancel</AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleRemove} 
            disabled={isPending}
            className="rounded-lg bg-red-600 hover:bg-red-700 text-white"
          >
            {isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Remove
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
