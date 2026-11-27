"use client";

import { forwardRef } from "react";
import {
  Turnstile,
  type TurnstileInstance,
  type TurnstileProps,
} from "@marsidev/react-turnstile";
import { cn } from "@/lib/utils";

export const ResponsiveTurnstile = forwardRef<
  TurnstileInstance | undefined,
  TurnstileProps
>(function ResponsiveTurnstile({ className, options, ...props }, ref) {
  return (
    <div className={cn("my-1 flex w-full justify-center", className)}>
      <Turnstile
        {...props}
        options={{
          ...options,
          size: options?.size ?? "flexible",
        }}
        ref={ref}
      />
    </div>
  );
});
