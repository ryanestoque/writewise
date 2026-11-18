"use client";

import { createContext, useContext, useMemo, useState, type Dispatch, type SetStateAction, type ReactNode } from "react";

interface ReviewSession {
  scope: string;
  studentIds: string[];
}

const ReviewSessionContext = createContext<{
  session: ReviewSession | null;
  setSession: Dispatch<SetStateAction<ReviewSession | null>>;
} | null>(null);

/** Lives in the activity layout so worksheet route changes retain review order. */
export function ActivityReviewSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<ReviewSession | null>(null);
  const value = useMemo(() => ({ session, setSession }), [session]);
  return <ReviewSessionContext value={value}>{children}</ReviewSessionContext>;
}

export function useActivityReviewSession() {
  const context = useContext(ReviewSessionContext);
  if (!context) throw new Error("Activity review requires its session provider.");
  return context;
}
