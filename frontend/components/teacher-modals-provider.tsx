"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { QuickUploadDialog } from "@/components/quick-upload-dialog";
import { RubricReferenceDialog } from "@/components/rubric-reference-dialog";
import { ShortcutsDialog } from "@/components/shortcuts-dialog";
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
import { Loader2Icon } from "lucide-react";

interface TeacherModalsContextValue {
  uploadOpen: boolean;
  setUploadOpen: (open: boolean) => void;
  openUpload: (opts?: { activityId?: string; studentId?: string }) => void;
  uploadPrefill: { activityId?: string; studentId?: string };

  rubricOpen: boolean;
  setRubricOpen: (open: boolean) => void;
  openRubric: () => void;

  shortcutsOpen: boolean;
  setShortcutsOpen: (open: boolean) => void;
  openShortcuts: () => void;

  signOutOpen: boolean;
  setSignOutOpen: (open: boolean) => void;
  openSignOut: () => void;
}

const TeacherModalsContext = createContext<TeacherModalsContextValue | null>(null);

export function useTeacherModals() {
  const context = useContext(TeacherModalsContext);
  if (!context) {
    throw new Error("useTeacherModals must be used within a TeacherModalsProvider");
  }
  return context;
}

export function TeacherModalsProvider({ children }: { children: React.ReactNode }) {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadPrefill, setUploadPrefill] = useState<{
    activityId?: string;
    studentId?: string;
  }>({});
  const [rubricOpen, setRubricOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const router = useRouter();
  const supabase = createClient();

  const openUpload = useCallback(
    (opts?: { activityId?: string; studentId?: string }) => {
      setUploadPrefill(opts ?? {});
      setUploadOpen(true);
    },
    []
  );
  const openRubric = useCallback(() => setRubricOpen(true), []);
  const openShortcuts = useCallback(() => setShortcutsOpen(true), []);
  const openSignOut = useCallback(() => setSignOutOpen(true), []);

  // Global hotkeys for educator efficiency (⌘K / Ctrl+K and ?)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;

      if (isInput) return;

      // ⌘K or Ctrl+K (or Mac ⌘U) -> Open quick worksheet upload
      const isUploadKey =
        ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") ||
        (e.metaKey && e.key.toLowerCase() === "u");

      if (isUploadKey) {
        e.preventDefault();
        setUploadOpen((prev) => !prev);
      }

      // ? (Shift + /) -> Open keyboard shortcuts dialog
      if (e.key === "?" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setShortcutsOpen((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  async function handleSignOut() {
    try {
      setIsSigningOut(true);
      const { error } = await supabase.auth.signOut();
      if (error) {
        throw error;
      }
      setSignOutOpen(false);
      router.push("/login");
      router.refresh();
    } catch (err: unknown) {
      console.error("Sign out error:", err);
      const message =
        err instanceof Error
          ? err.message
          : "Failed to sign out. Please check your connection and try again.";
      toast.error(message);
      setIsSigningOut(false);
    }
  }

  return (
    <TeacherModalsContext.Provider
      value={{
        uploadOpen,
        setUploadOpen,
        openUpload,
        uploadPrefill,
        rubricOpen,
        setRubricOpen,
        openRubric,
        shortcutsOpen,
        setShortcutsOpen,
        openShortcuts,
        signOutOpen,
        setSignOutOpen,
        openSignOut,
      }}
    >
      {children}

      {/* Global Teacher Modals rendered once at layout root */}
      <QuickUploadDialog
        open={uploadOpen}
        onOpenChange={(val) => {
          setUploadOpen(val);
          if (!val) setUploadPrefill({});
        }}
        prefilledActivityId={uploadPrefill.activityId}
        prefilledStudentId={uploadPrefill.studentId}
      />
      <RubricReferenceDialog open={rubricOpen} onOpenChange={setRubricOpen} />
      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />

      <AlertDialog open={signOutOpen} onOpenChange={setSignOutOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sign out of WriteWise?</AlertDialogTitle>
            <AlertDialogDescription>
              You will need to sign in again to access the Grade 3 teacher portal.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSigningOut}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              id="confirm-sign-out"
              onClick={handleSignOut}
              disabled={isSigningOut}
              className="gap-2"
            >
              {isSigningOut ? (
                <>
                  <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
                  <span>Signing out...</span>
                </>
              ) : (
                "Sign out"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TeacherModalsContext.Provider>
  );
}
