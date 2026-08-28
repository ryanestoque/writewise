import type { Metadata } from "next";
import { ProgressPageContent } from "./progress-content";

export const metadata: Metadata = {
  title: "Child Progress — WriteWise",
  description:
    "View your child's cursive handwriting progress, diagnostic assessments, and assigned practice worksheets.",
};

export default function ProgressPage() {
  return <ProgressPageContent />;
}
