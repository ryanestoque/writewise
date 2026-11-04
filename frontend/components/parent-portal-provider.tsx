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
import {
  useLinkedChildren,
  useTakeHomeActivities,
  type LinkedChild,
} from "@/lib/hooks/use-parent-data";

interface ParentPortalContextValue {
  userId: string;
  notificationTarget: ParsedNotificationTarget;
  dismissNotificationTarget: () => void;
  selectedChildId: string | null;
  setSelectedChildId: (id: string) => void;
  selectedChild: LinkedChild | null;
  children: LinkedChild[];
  isLoading: boolean;
  uploadOpen: boolean;
  setUploadOpen: (open: boolean) => void;
  prefilledActivityId: string | undefined;
  openUploadDialog: (activityId?: string) => void;
  cursiveGuideOpen: boolean;
  setCursiveGuideOpen: (open: boolean) => void;
  openCursiveGuide: () => void;
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
  const { data: linkedChildren, isLoading } = useLinkedChildren(user.id);
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
  const [prefilledActivityId, setPrefilledActivityId] = useState<string | undefined>();

  // Derive the active selected child without cascading effect renders
  const selectedChildId =
    notificationTarget.kind === "invalid"
      ? null
      : requestedChild
        ? linkedChildren?.some((c) => c.id === requestedChild)
          ? requestedChild
          : null
        : selectedChildIdState && linkedChildren?.some((c) => c.id === selectedChildIdState)
          ? selectedChildIdState
          : (linkedChildren?.[0]?.id ?? null);

  const selectedChild = linkedChildren?.find((c) => c.id === selectedChildId) ?? null;

  const clearTargetUrl = useCallback(() => {
    if (notificationTarget.kind === "none") return;
    const next = new URLSearchParams(searchParams.toString());
    for (const name of ["child", "activity", "submission"]) next.delete(name);
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
  }, [notificationTarget.kind, pathname, router, searchParams]);
  const setSelectedChildId = useCallback(
    (id: string) => {
      setSelectedChildIdState(id);
      clearTargetUrl();
    },
    [clearTargetUrl]
  );
  const dismissNotificationTarget = useCallback(() => {
    if (selectedChildId) setSelectedChildIdState(selectedChildId);
    clearTargetUrl();
  }, [clearTargetUrl, selectedChildId]);

  const { data: activities } = useTakeHomeActivities(selectedChildId);
  const hasActivities = (activities?.length ?? 0) > 0;

  const openUploadDialog = useCallback((activityId?: string) => {
    setPrefilledActivityId(activityId);
    setUploadOpen(true);
  }, []);

  const openCursiveGuide = useCallback(() => {
    setCursiveGuideOpen(true);
  }, []);

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
      uploadOpen,
      setUploadOpen,
      prefilledActivityId,
      openUploadDialog,
      cursiveGuideOpen,
      setCursiveGuideOpen,
      openCursiveGuide,
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
      uploadOpen,
      prefilledActivityId,
      openUploadDialog,
      cursiveGuideOpen,
      openCursiveGuide,
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
          onUploadClick={() => openUploadDialog()}
          onCursiveGuideClick={openCursiveGuide}
          hasActivities={hasActivities}
        />
        <main className="w-full min-w-0 flex-1 space-y-6 px-4 py-6 sm:px-6">
          {pageChildren}
        </main>
      </div>

      {/* Global Parent Modals: Upload & Cursive Guide */}
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

      <CursiveGuideDialog open={cursiveGuideOpen} onOpenChange={setCursiveGuideOpen} />
    </ParentPortalContext.Provider>
  );
}
