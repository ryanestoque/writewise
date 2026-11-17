import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Submission Assessment",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
