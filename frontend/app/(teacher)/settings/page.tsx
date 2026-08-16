import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Settings — WriteWise",
};

export default function SettingsPage() {
  return (
    <div>
      <h1 className="font-heading text-2xl font-semibold">Settings</h1>
      <p className="mt-2 text-muted-foreground">
        Account and profile settings. Coming soon.
      </p>
    </div>
  );
}
