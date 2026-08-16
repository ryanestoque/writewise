import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Activities — WriteWise",
};

export default function ActivitiesPage() {
  return (
    <div>
      <h1 className="font-heading text-2xl font-semibold">Activities</h1>
      <p className="mt-2 text-muted-foreground">
        Create and manage handwriting activities here. Coming soon.
      </p>
    </div>
  );
}
