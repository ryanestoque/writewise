import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AuthBackNavProps {
  href?: string;
  label?: string;
  className?: string;
}

/**
 * Accessible back navigation control for WriteWise authentication pages.
 * Ensures a minimum 40px touch target on mobile viewports and keyboard focus indicators.
 */
export function AuthBackNav({
  href = "/",
  label = "Back to home",
  className,
}: AuthBackNavProps) {
  return (
    <Link
      href={href}
      className={cn(
        "group inline-flex items-center gap-2 rounded-full border border-border/80 bg-card/90 px-3.5 py-1.5 text-xs font-medium text-muted-foreground shadow-xs backdrop-blur-xs transition-all duration-200 hover:border-brand-300 hover:bg-card hover:text-foreground hover:shadow-warm-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary min-h-[40px] select-none",
        className
      )}
      aria-label={label}
    >
      <ArrowLeftIcon
        aria-hidden="true"
        className="size-4 shrink-0 transition-transform duration-200 ease-out group-hover:-translate-x-1 text-muted-foreground group-hover:text-primary"
      />
      <span>{label}</span>
    </Link>
  );
}

