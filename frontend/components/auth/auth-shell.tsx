import * as React from "react";
import { HandwritingGuidelineBackground } from "@/components/auth/handwriting-guideline-background";
import { AuthBackNav } from "@/components/auth/auth-back-nav";
import { cn } from "@/lib/utils";

export interface AuthShellProps {
  children: React.ReactNode;
  backHref?: string;
  backLabel?: string;
  className?: string;
}

/**
 * AuthShell wraps WriteWise authentication surfaces (Login, Sign up, Reset password)
 * with the signature handwriting guidelines background, back navigation to landing,
 * and choreographed entrance motion.
 */
export function AuthShell({
  children,
  backHref = "/",
  backLabel = "Back to home",
  className,
}: AuthShellProps) {
  return (
    <div className="relative flex min-h-dvh flex-col bg-background antialiased selection:bg-brand-200 selection:text-brand-900">
      <HandwritingGuidelineBackground />

      {/* Top Navigation Bar with Back Action */}
      <header className="w-full max-w-5xl mx-auto px-4 sm:px-6 pt-4 sm:pt-6 pb-2 flex items-center justify-between z-20 animate-auth-nav">
        <AuthBackNav href={backHref} label={backLabel} />
      </header>

      {/* Centered Main Auth Content */}
      <main
        id="auth-content"
        className={cn(
          "flex-1 flex items-center justify-center px-4 py-4 sm:py-8 z-10",
          className
        )}
      >
        <div className="w-full max-w-md animate-auth-card view-transition-auth-card">
          {children}
        </div>
      </main>
    </div>
  );
}
