import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard — WriteWise",
};

export default function DashboardPage() {
  return (
    <div>
      <h1 className="font-heading text-2xl font-semibold">Dashboard</h1>
      <p className="mt-2 text-muted-foreground">
        Welcome to WriteWise. Your class overview will appear here.
      </p>
    </div>
  );
}
