"use client";

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { ParentNav } from "@/components/parent-nav";
import { useLinkedChildren, type LinkedChild } from "@/lib/hooks/use-parent-data";

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
  const [prefilledActivityId, setPrefilledActivityId] = useState<string | undefined>();

  // Derive the active selected child without cascading effect renders
  const selectedChildId =
    selectedChildIdState && linkedChildren?.some((c) => c.id === selectedChildIdState)
      ? selectedChildIdState
      : linkedChildren?.[0]?.id ?? null;

  const selectedChild =
    linkedChildren?.find((c) => c.id === selectedChildId) ?? null;

  const openUploadDialog = (activityId?: string) => {
    setPrefilledActivityId(activityId);
    setUploadOpen(true);
  };

  const contextValue: ParentPortalContextValue = {
    selectedChildId,
    setSelectedChildId,
    selectedChild,
    children: linkedChildren ?? [],
    isLoading,
    uploadOpen,
    setUploadOpen,
    prefilledActivityId,
    openUploadDialog,
  };

  return (
    <ParentPortalContext.Provider value={contextValue}>
      <div className="flex min-h-dvh flex-col bg-background text-foreground">
        <ParentNav
          user={user}
          selectedChildId={selectedChildId}
          linkedChildren={linkedChildren ?? []}
          onChildChange={setSelectedChildId}
          onUploadClick={() => openUploadDialog()}
        />
        <main className="flex-1 min-w-0 w-full px-4 sm:px-6 py-6 sm:py-8 space-y-6">
          {pageChildren}
        </main>
      </div>
    </ParentPortalContext.Provider>
  );
}
