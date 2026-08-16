import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Progress — WriteWise",
};

export default function ProgressPage() {
  return (
    <div className="text-center">
      <h1 className="font-heading text-2xl font-semibold">
        Parent Portal
      </h1>
      <p className="mt-2 text-muted-foreground">
        The parent portal is coming soon. You&apos;ll be able to view your
        child&apos;s handwriting progress here.
      </p>
    </div>
  );
}
