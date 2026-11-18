import type { Metadata } from "next";
import { ActivityReviewSessionProvider } from "@/components/activities/activity-review-session";

export const metadata: Metadata = {
  title: "Activity Details",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <ActivityReviewSessionProvider>{children}</ActivityReviewSessionProvider>;
}
