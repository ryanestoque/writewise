"use client";

import {
  createContext,
  useContext,
  useState,
  useMemo,
  useCallback,
  type ReactNode,
} from "react";
import { ParentNav } from "@/components/parent-nav";
import { ParentUploadDialog } from "@/components/parent/parent-upload-dialog";
import { CursiveGuideDialog } from "@/components/cursive-guide-dialog";
import {
  useLinkedChildren,
  useTakeHomeActivities,
  type LinkedChild,
} from "@/lib/hooks/use-parent-data";

interface ParentPortalContextValue {
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
  user: { fullName: string; email: string };
  children: ReactNode;
}

export function ParentPortalProvider({
  user,
  children: pageChildren,
}: ParentPortalProviderProps) {
  const { data: linkedChildren, isLoading } = useLinkedChildren();
  const [selectedChildIdState, setSelectedChildId] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [cursiveGuideOpen, setCursiveGuideOpen] = useState(false);
  const [prefilledActivityId, setPrefilledActivityId] = useState<string | undefined>();

  // Derive the active selected child without cascading effect renders
  const selectedChildId =
    selectedChildIdState && linkedChildren?.some((c) => c.id === selectedChildIdState)
      ? selectedChildIdState
      : linkedChildren?.[0]?.id ?? null;

  const selectedChild =
    linkedChildren?.find((c) => c.id === selectedChildId) ?? null;

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
      <div className="flex min-h-dvh flex-col bg-background text-foreground">
        <ParentNav
          user={user}
          selectedChildId={selectedChildId}
          linkedChildren={linkedChildren ?? []}
          onChildChange={setSelectedChildId}
          onUploadClick={() => openUploadDialog()}
          onCursiveGuideClick={openCursiveGuide}
          hasActivities={hasActivities}
        />
        <main className="flex-1 min-w-0 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
          {pageChildren}
        </main>
      </div>

      {/* Global Parent Modals: Upload & DepEd Cursive Guide */}
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
        open={cursiveGuideOpen}
        onOpenChange={setCursiveGuideOpen}
      />
    </ParentPortalContext.Provider>
  );
}
