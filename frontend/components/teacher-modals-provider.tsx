"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, type SetStateAction } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";

const QuickUploadDialog = dynamic(
  () => import("@/components/quick-upload-dialog").then((m) => m.QuickUploadDialog),
  { ssr: false }
);
const RubricReferenceDialog = dynamic(
  () => import("@/components/rubric-reference-dialog").then((m) => m.RubricReferenceDialog),
  { ssr: false }
);
const CursiveGuideDialog = dynamic(
  () => import("@/components/cursive-guide-dialog").then((m) => m.CursiveGuideDialog),
  { ssr: false }
);
const ShortcutsDialog = dynamic(
  () => import("@/components/shortcuts-dialog").then((m) => m.ShortcutsDialog),
  { ssr: false }
);
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Spinner } from "@/components/ui/spinner";

interface TeacherModalsContextValue {
  uploadOpen: boolean;
  setUploadOpen: (open: boolean) => void;
  openUpload: (opts?: { activityId?: string; studentId?: string }) => void;
  uploadPrefill: { activityId?: string; studentId?: string };

  rubricOpen: boolean;
  setRubricOpen: (open: boolean) => void;
  openRubric: () => void;

  cursiveGuideOpen: boolean;
  setCursiveGuideOpen: (open: boolean) => void;
  openCursiveGuide: () => void;

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
  const [uploadOpen, setUploadOpenState] = useState(false);
  const [uploadMounted, setUploadMounted] = useState(false);
  const [uploadPrefill, setUploadPrefill] = useState<{
    activityId?: string;
    studentId?: string;
  }>({});
  const [rubricOpen, setRubricOpenState] = useState(false);
  const [rubricMounted, setRubricMounted] = useState(false);
  const [cursiveGuideOpen, setCursiveGuideOpenState] = useState(false);
  const [cursiveGuideMounted, setCursiveGuideMounted] = useState(false);
  const [shortcutsOpen, setShortcutsOpenState] = useState(false);
  const [shortcutsMounted, setShortcutsMounted] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const router = useRouter();
  const supabase = createClient();

  const setUploadOpen = useCallback((value: SetStateAction<boolean>) => {
    setUploadOpenState((prev) => {
      const next = typeof value === "function" ? value(prev) : value;
      if (next) setUploadMounted(true);
      return next;
    });
  }, []);

  const setRubricOpen = useCallback((value: SetStateAction<boolean>) => {
    setRubricOpenState((prev) => {
      const next = typeof value === "function" ? value(prev) : value;
      if (next) setRubricMounted(true);
      return next;
    });
  }, []);

  const setCursiveGuideOpen = useCallback((value: SetStateAction<boolean>) => {
    setCursiveGuideOpenState((prev) => {
      const next = typeof value === "function" ? value(prev) : value;
      if (next) setCursiveGuideMounted(true);
      return next;
    });
  }, []);

  const setShortcutsOpen = useCallback((value: SetStateAction<boolean>) => {
    setShortcutsOpenState((prev) => {
      const next = typeof value === "function" ? value(prev) : value;
      if (next) setShortcutsMounted(true);
      return next;
    });
  }, []);

  const openUpload = useCallback(
    (opts?: { activityId?: string; studentId?: string }) => {
      setUploadPrefill(opts ?? {});
      setUploadMounted(true);
      setUploadOpenState(true);
    },
    []
  );
  const openRubric = useCallback(() => {
    setRubricMounted(true);
    setRubricOpenState(true);
  }, []);
  const openCursiveGuide = useCallback(() => {
    setCursiveGuideMounted(true);
    setCursiveGuideOpenState(true);
  }, []);
  const openShortcuts = useCallback(() => {
    setShortcutsMounted(true);
    setShortcutsOpenState(true);
  }, []);
  const openSignOut = useCallback(() => setSignOutOpen(true), []);

  // Global hotkeys for educator efficiency (⌘K / Ctrl+K, Alt+R, Alt+C, and ?)
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
        setUploadOpen(true);
      }

      // Alt+R (Option+R) -> Toggle handwriting rubric reference guide
      // Note: On macOS, Option+R produces the character "®" (e.key === "®"), so we check e.code === "KeyR" as well.
      if (
        e.altKey &&
        !e.metaKey &&
        !e.ctrlKey &&
        (e.key.toLowerCase() === "r" || e.code === "KeyR")
      ) {
        e.preventDefault();
        setRubricOpen((prev) => !prev);
      }

      // Alt+C (Option+C) -> Toggle cursive alphabet guide
      // Note: On macOS, Option+C produces the character "ç" (e.key === "ç"), so we check e.code === "KeyC" as well.
      if (
        e.altKey &&
        !e.metaKey &&
        !e.ctrlKey &&
        (e.key.toLowerCase() === "c" || e.code === "KeyC")
      ) {
        e.preventDefault();
        setCursiveGuideOpen((prev) => !prev);
      }

      // ? (Shift + /) -> Open keyboard shortcuts dialog
      if (e.key === "?" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setShortcutsOpen((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setUploadOpen, setRubricOpen, setCursiveGuideOpen, setShortcutsOpen]);

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
    } catch {
      toast.add({ type: "error", title: "We couldn't sign you out. Check your connection and try again." });
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
        cursiveGuideOpen,
        setCursiveGuideOpen,
        openCursiveGuide,
        shortcutsOpen,
        setShortcutsOpen,
        openShortcuts,
        signOutOpen,
        setSignOutOpen,
        openSignOut }}
    >
      {children}

      {/* Global Teacher Modals lazy-loaded on first trigger */}
      {uploadMounted && (
        <QuickUploadDialog
          open={uploadOpen}
          onOpenChange={(val) => {
            setUploadOpen(val);
            if (!val) setUploadPrefill({});
          }}
          prefilledActivityId={uploadPrefill.activityId}
          prefilledStudentId={uploadPrefill.studentId}
        />
      )}
      {rubricMounted && (
        <RubricReferenceDialog open={rubricOpen} onOpenChange={setRubricOpen} />
      )}
      {cursiveGuideMounted && (
        <CursiveGuideDialog open={cursiveGuideOpen} onOpenChange={setCursiveGuideOpen} />
      )}
      {shortcutsMounted && (
        <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
      )}

      <AlertDialog open={signOutOpen} onOpenChange={setSignOutOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sign out of WriteWise?</AlertDialogTitle>
            <AlertDialogDescription>
              You will need to sign in again to access the teacher portal.
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
                  <Spinner data-icon="inline-start" />
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
