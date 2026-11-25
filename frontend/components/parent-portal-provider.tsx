"use client";

import { createContext, useContext, useState, useMemo, useCallback, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  parseParentNotificationTarget,
  type ParsedNotificationTarget,
} from "@/lib/notifications/data";
import { ParentNav } from "@/components/parent-nav";
import { useLinkedChildren, type LinkedChild } from "@/lib/hooks/use-parent-data";

const EMPTY_LINKED_CHILDREN: LinkedChild[] = [];

const ParentUploadDialog = dynamic(
  () => import("@/components/parent/parent-upload-dialog").then((m) => m.ParentUploadDialog),
  { ssr: false }
);
const CursiveGuideDialog = dynamic(
  () => import("@/components/cursive-guide-dialog").then((m) => m.CursiveGuideDialog),
  { ssr: false }
);
const RubricReferenceDialog = dynamic(
  () => import("@/components/rubric-reference-dialog").then((m) => m.RubricReferenceDialog),
  { ssr: false }
);

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
  const [uploadOpen, setUploadOpenState] = useState(false);
  const [uploadMounted, setUploadMounted] = useState(false);
  const [cursiveGuideOpen, setCursiveGuideOpenState] = useState(false);
  const [cursiveGuideMounted, setCursiveGuideMounted] = useState(false);
  const [rubricOpen, setRubricOpenState] = useState(false);
  const [rubricMounted, setRubricMounted] = useState(false);
  const [cursiveGuideInitialLetter, setCursiveGuideInitialLetter] = useState<string | undefined>();
  const [prefilledActivityId, setPrefilledActivityId] = useState<string | undefined>();

  const setUploadOpen = useCallback((open: boolean) => {
    if (open) setUploadMounted(true);
    setUploadOpenState(open);
  }, []);
  const setCursiveGuideOpen = useCallback((open: boolean) => {
    if (open) setCursiveGuideMounted(true);
    setCursiveGuideOpenState(open);
  }, []);
  const setRubricOpen = useCallback((open: boolean) => {
    if (open) setRubricMounted(true);
    setRubricOpenState(open);
  }, []);

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
    setUploadMounted(true);
    setUploadOpenState(true);
  }, []);

  const openCursiveGuide = useCallback((initialLetterOrQuery?: string) => {
    setCursiveGuideInitialLetter(
      typeof initialLetterOrQuery === "string" ? initialLetterOrQuery : undefined
    );
    setCursiveGuideMounted(true);
    setCursiveGuideOpenState(true);
  }, []);

  const openRubric = useCallback(() => {
    setRubricMounted(true);
    setRubricOpenState(true);
  }, []);

  const contextValue: ParentPortalContextValue = useMemo(
    () => ({
      userId: user.id,
      notificationTarget,
      dismissNotificationTarget,
      selectedChildId,
      setSelectedChildId,
      selectedChild,
      children: linkedChildren ?? EMPTY_LINKED_CHILDREN,
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
      setUploadOpen,
      prefilledActivityId,
      openUploadDialog,
      cursiveGuideOpen,
      setCursiveGuideOpen,
      openCursiveGuide,
      rubricOpen,
      setRubricOpen,
      openRubric,
    ]
  );

  return (
    <ParentPortalContext.Provider value={contextValue}>
      <div className="bg-background text-foreground flex min-h-svh flex-col overflow-x-clip">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground focus:shadow-warm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          Skip to main content
        </a>
        <ParentNav
          user={user}
          selectedChildId={selectedChildId}
          linkedChildren={linkedChildren ?? EMPTY_LINKED_CHILDREN}
          onChildChange={setSelectedChildId}
          onOpenRubric={openRubric}
          onOpenCursiveGuide={openCursiveGuide}
        />
        <main id="main-content" tabIndex={-1} className="w-full min-w-0 flex-1 pt-14 print:pt-0 outline-none">
          {pageChildren}
        </main>
      </div>

      {/* Global Parent Modals: Upload, Cursive Guide, & How Scores Work (lazy-mounted on demand) */}
      {uploadMounted && selectedChildId && selectedChild && (
        <ParentUploadDialog
          open={uploadOpen}
          onOpenChange={(open) => {
            setUploadOpenState(open);
            if (!open) setPrefilledActivityId(undefined);
          }}
          childId={selectedChildId}
          childName={selectedChild.fullName}
          prefilledActivityId={prefilledActivityId}
        />
      )}

      {cursiveGuideMounted && (
        <CursiveGuideDialog
          key={`${cursiveGuideInitialLetter ?? "all"}:${cursiveGuideOpen ? "open" : "closed"}`}
          open={cursiveGuideOpen}
          onOpenChange={(open) => {
            setCursiveGuideOpenState(open);
            if (!open) setCursiveGuideInitialLetter(undefined);
          }}
          initialLetterId={cursiveGuideInitialLetter}
        />
      )}

      {rubricMounted && (
        <RubricReferenceDialog
          open={rubricOpen}
          onOpenChange={setRubricOpenState}
          variant="parent"
        />
      )}
    </ParentPortalContext.Provider>
  );
}
