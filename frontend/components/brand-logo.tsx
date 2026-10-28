import * as React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

export interface BrandIconProps
  extends Omit<React.ComponentProps<typeof Image>, "src" | "alt"> {
  className?: string;
  alt?: string;
  size?: number;
  priority?: boolean;
}

/**
 * WriteWise custom brand icon mark.
 * Uses the official calligraphic 'W' fountain-pen icon.
 */
export function BrandIcon({
  className,
  alt = "WriteWise Icon",
  size = 48,
  priority = false,
  ...props
}: BrandIconProps) {
  return (
    <Image
      src="/images/app_icons/writewise-app-icon-180.png"
      alt={alt}
      width={size}
      height={size}
      priority={priority}
      className={cn("object-contain shrink-0 rounded-2xl", className)}
      {...props}
    />
  );
}

export interface BrandLogoProps
  extends React.HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "md" | "lg" | "xl";
  variant?: "logo" | "mark";
  showSubtitle?: boolean;
  subtitleText?: string;
  priority?: boolean;
  imageClassName?: string;
}

/**
 * WriteWise brand logo component.
 * Supports the official full horizontal logo (`variant="logo"`) or the mark + text combination (`variant="mark"`).
 */
export function BrandLogo({
  size = "md",
  variant = "logo",
  showSubtitle = false,
  subtitleText = "Cursive Assessment Portal",
  priority = false,
  imageClassName,
  className,
  ...props
}: BrandLogoProps) {
  if (variant === "logo") {
    const heightClasses = {
      sm: "h-7.5 w-auto",
      md: "h-9 w-auto",
      lg: "h-12 w-auto",
      xl: "h-16 sm:h-20 w-auto",
    };

    return (
      <div className={cn("inline-flex items-center gap-2.5", className)} {...props}>
        <Image
          src="/images/app_icons/writewise-logo.png"
          alt="WriteWise"
          width={280}
          height={109}
          priority={priority}
          className={cn("object-contain select-none", heightClasses[size], imageClassName)}
        />
        {showSubtitle && (
          <span className="text-xs font-medium text-muted-foreground border-l border-border pl-2.5 py-0.5 whitespace-nowrap">
            {subtitleText}
          </span>
        )}
      </div>
    );
  }

  const iconSizes = {
    sm: "size-7 rounded-lg",
    md: "size-9 rounded-xl",
    lg: "size-11 rounded-2xl",
    xl: "size-14 rounded-2xl",
  };

  const textSizes = {
    sm: "text-lg",
    md: "text-2xl",
    lg: "text-3xl",
    xl: "text-4xl",
  };

  return (
    <div className={cn("flex items-center gap-2.5", className)} {...props}>
      <div
        className={cn(
          "flex items-center justify-center bg-card border border-border/80 shadow-xs overflow-hidden shrink-0",
          iconSizes[size]
        )}
      >
        <BrandIcon className="size-full object-contain p-0.5" priority={priority} />
      </div>
      <div className="flex flex-col text-left">
        <span
          className={cn(
            "font-heading font-bold tracking-tight text-foreground leading-none",
            textSizes[size]
          )}
        >
          Write<span className="text-primary">Wise</span>
        </span>
        {showSubtitle && (
          <span className="text-xs font-medium text-muted-foreground mt-0.5">
            {subtitleText}
          </span>
        )}
      </div>
    </div>
  );
}
