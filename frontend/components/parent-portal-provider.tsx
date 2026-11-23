"use client";

import { createContext, useContext, useState, useMemo, useCallback, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  parseParentNotificationTarget,
  type ParsedNotificationTarget,
} from "@/lib/notifications/data";
import { ParentNav } from "@/components/parent-nav";
import { ParentUploadDialog } from "@/components/parent/parent-upload-dialog";
import { CursiveGuideDialog } from "@/components/cursive-guide-dialog";
import { RubricReferenceDialog } from "@/components/rubric-reference-dialog";
import { useLinkedChildren, type LinkedChild } from "@/lib/hooks/use-parent-data";

interface ParentPortalContextValue {
  userId: string;
  notificationTarget: ParsedNotificationTarget;
  dismissNotificationTarget: (tab?: "grades" | null) => void;
  selectedChildId: string | null;
  setSelectedChildId: (id: string) => void;
  selectedChild: LinkedChild | null;
  children: LinkedChild[];
  isLoading: boolean;
  isError: boolean;
  isRetrying: boolean;
  retryChildren: () => void;
  uploadOpen: boolean;
  setUploadOpen: (open: boolean) => void;
  prefilledActivityId: string | undefined;
  openUploadDialog: (activityId?: string) => void;
  cursiveGuideOpen: boolean;
  setCursiveGuideOpen: (open: boolean) => void;
  openCursiveGuide: (initialLetterOrQuery?: string) => void;
  rubricOpen: boolean;
  setRubricOpen: (open: boolean) => void;
  openRubric: () => void;
  showScoreDetails: boolean;
  setShowScoreDetails: (next: boolean) => void;
  toggleScoreDetails: () => void;
}

const ParentPortalContext = createContext<ParentPortalContextValue | null>(null);

export function useParentPortal() {
  const ctx = useContext(ParentPortalContext);
  if (!ctx) {
    throw new Error("useParentPortal must be used within ParentPortalProvider");
  }
  return ctx;
}

interface ParentPortalProviderProps {
  user: { id: string; fullName: string; email: string };
  children: ReactNode;
}

export function ParentPortalProvider({ user, children: pageChildren }: ParentPortalProviderProps) {
  const {
    data: linkedChildren,
    isPending: isLoading,
    isError,
    isFetching: isRetrying,
    refetch: refetchChildren,
  } = useLinkedChildren(user.id);
  const retryChildren = useCallback(() => {
    void refetchChildren();
  }, [refetchChildren]);
  const [selectedChildIdState, setSelectedChildIdState] = useState<string | null>(null);
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const notificationTarget = useMemo<ParsedNotificationTarget>(
    () =>
      pathname === "/progress" ? parseParentNotificationTarget(searchParams) : { kind: "none" },
    [pathname, searchParams]
  );
  const requestedChild =
    notificationTarget.kind === "valid" ? notificationTarget.target.childId : null;
  const [uploadOpen, setUploadOpen] = useState(false);
  const [cursiveGuideOpen, setCursiveGuideOpen] = useState(false);
  const [rubricOpen, setRubricOpen] = useState(false);
  const [cursiveGuideInitialLetter, setCursiveGuideInitialLetter] = useState<string | undefined>();
  const [prefilledActivityId, setPrefilledActivityId] = useState<string | undefined>();

  // Derive the active selected child without cascading effect renders
  const selectedChildId =
    requestedChild && linkedChildren?.some((c) => c.id === requestedChild)
      ? requestedChild
      : selectedChildIdState && linkedChildren?.some((c) => c.id === selectedChildIdState)
        ? selectedChildIdState
        : (linkedChildren?.[0]?.id ?? null);

  const selectedChild = linkedChildren?.find((c) => c.id === selectedChildId) ?? null;

  const clearTargetUrl = useCallback(
    (tab?: "grades" | null) => {
      if (notificationTarget.kind === "none" && tab === undefined) return;
      const next = new URLSearchParams(searchParams.toString());
      for (const name of ["child", "activity", "submission", "view"]) next.delete(name);
      if (tab === "grades") next.set("tab", "grades");
      if (tab === null) next.delete("tab");
      router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
    },
    [notificationTarget.kind, pathname, router, searchParams]
  );
  const setSelectedChildId = useCallback(
    (id: string) => {
      setSelectedChildIdState(id);
      clearTargetUrl();
    },
    [clearTargetUrl]
  );
  const dismissNotificationTarget = useCallback(
    (tab?: "grades" | null) => {
      if (selectedChildId) setSelectedChildIdState(selectedChildId);
      clearTargetUrl(tab);
    },
    [clearTargetUrl, selectedChildId]
  );

  const openUploadDialog = useCallback((activityId?: string) => {
    setPrefilledActivityId(typeof activityId === "string" ? activityId : undefined);
    setUploadOpen(true);
  }, []);

  const openCursiveGuide = useCallback((initialLetterOrQuery?: string) => {
    setCursiveGuideInitialLetter(
      typeof initialLetterOrQuery === "string" ? initialLetterOrQuery : undefined
    );
    setCursiveGuideOpen(true);
  }, []);

  const openRubric = useCallback(() => {
    setRubricOpen(true);
  }, []);

  const showScoreDetails = true;
  const setShowScoreDetails = useCallback(() => {}, []);
  const toggleScoreDetails = useCallback(() => {}, []);

  const contextValue: ParentPortalContextValue = useMemo(
    () => ({
      userId: user.id,
      notificationTarget,
      dismissNotificationTarget,
      selectedChildId,
      setSelectedChildId,
      selectedChild,
      children: linkedChildren ?? [],
      isLoading,
      isError,
      isRetrying,
      retryChildren,
      uploadOpen,
      setUploadOpen,
      prefilledActivityId,
      openUploadDialog,
      cursiveGuideOpen,
      setCursiveGuideOpen,
      openCursiveGuide,
      rubricOpen,
      setRubricOpen,
      openRubric,
      showScoreDetails,
      setShowScoreDetails,
      toggleScoreDetails,
    }),
    [
      user.id,
      notificationTarget,
      dismissNotificationTarget,
      setSelectedChildId,
      selectedChildId,
      selectedChild,
      linkedChildren,
      isLoading,
      isError,
      isRetrying,
      retryChildren,
      uploadOpen,
      prefilledActivityId,
      openUploadDialog,
      cursiveGuideOpen,
      openCursiveGuide,
      rubricOpen,
      openRubric,
      showScoreDetails,
      setShowScoreDetails,
      toggleScoreDetails,
    ]
  );

  return (
    <ParentPortalContext.Provider value={contextValue}>
      <div className="bg-background text-foreground flex min-h-dvh flex-col">
        <ParentNav
          user={user}
          selectedChildId={selectedChildId}
          linkedChildren={linkedChildren ?? []}
          onChildChange={setSelectedChildId}
          onOpenRubric={openRubric}
          onOpenCursiveGuide={openCursiveGuide}
        />
        <main className="w-full min-w-0 flex-1 space-y-6 px-4 py-6 sm:px-6">{pageChildren}</main>
      </div>

      {/* Global Parent Modals: Upload, Cursive Guide, & How Scores Work */}
      {selectedChildId && selectedChild && (
        <ParentUploadDialog
          open={uploadOpen}
          onOpenChange={(open) => {
            setUploadOpen(open);
            if (!open) setPrefilledActivityId(undefined);
          }}
          childId={selectedChildId}
          childName={selectedChild.fullName}
          prefilledActivityId={prefilledActivityId}
        />
      )}

      <CursiveGuideDialog
        key={`${cursiveGuideInitialLetter ?? "all"}:${cursiveGuideOpen ? "open" : "closed"}`}
        open={cursiveGuideOpen}
        onOpenChange={(open) => {
          setCursiveGuideOpen(open);
          if (!open) setCursiveGuideInitialLetter(undefined);
        }}
        initialLetterId={cursiveGuideInitialLetter}
      />

      <RubricReferenceDialog
        open={rubricOpen}
        onOpenChange={setRubricOpen}
        variant="parent"
        showScoreDetails={showScoreDetails}
        onToggleScoreDetails={toggleScoreDetails}
      />
    </ParentPortalContext.Provider>
  );
}
