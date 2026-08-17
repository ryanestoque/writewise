import * as React from "react";
import { cn } from "@/lib/utils";

interface BrandIconProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
}

/**
 * WriteWise custom pen-flourish brand icon mark.
 * Combines an angled fountain pen nib with an organic cursive ink baseline loop.
 */
export function BrandIcon({ className, ...props }: BrandIconProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={cn("size-6 shrink-0", className)}
      {...props}
    >
      <defs>
        <linearGradient id="brand-nib-grad" x1="6" y1="4" x2="26" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.95" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.75" />
        </linearGradient>
      </defs>
      {/* Pen nib & body */}
      <path
        d="M19.5 4.5L27.5 12.5L16.5 23.5L9.5 24.5L10.5 17.5L19.5 4.5Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Pen nib tip breather hole & slit */}
      <path
        d="M13.5 14.5L18.5 19.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <circle cx="16" cy="17" r="1" fill="currentColor" />
      {/* Cursive ink flourish sweep along baseline */}
      <path
        d="M4.5 27C7 26 9.5 23.5 12 25C15 26.8 19 28 27.5 25"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
      />
    </svg>
  );
}

interface BrandLogoProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "md" | "lg";
  showSubtitle?: boolean;
  subtitleText?: string;
}

export function BrandLogo({
  size = "md",
  showSubtitle = false,
  subtitleText = "Cursive Assessment Portal",
  className,
  ...props
}: BrandLogoProps) {
  const iconSizes = {
    sm: "size-7 p-1.5 rounded-md",
    md: "size-10 p-2 rounded-xl",
    lg: "size-12 p-2.5 rounded-2xl",
  };

  const textSizes = {
    sm: "text-lg",
    md: "text-2xl",
    lg: "text-3xl",
  };

  return (
    <div className={cn("flex items-center gap-3", className)} {...props}>
      <div
        className={cn(
          "flex items-center justify-center bg-primary text-primary-foreground shadow-warm-sm transition-transform duration-200",
          iconSizes[size]
        )}
      >
        <BrandIcon className="size-full" />
      </div>
      <div className="flex flex-col text-left">
        <span
          className={cn(
            "font-heading font-bold tracking-tight text-foreground",
            textSizes[size]
          )}
        >
          Write<span className="text-primary">Wise</span>
        </span>
        {showSubtitle && (
          <span className="text-xs font-medium text-muted-foreground">
            {subtitleText}
          </span>
        )}
      </div>
    </div>
  );
}
