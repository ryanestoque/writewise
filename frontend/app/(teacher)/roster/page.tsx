import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Roster — WriteWise",
};

export default function RosterPage() {
  return (
    <div>
      <h1 className="font-heading text-2xl font-semibold">Roster</h1>
      <p className="mt-2 text-muted-foreground">
        Manage your class roster here. Coming soon.
      </p>
    </div>
  );
}
