"use client";

import type { CSSProperties } from "react";
import {
  CircleCheck,
  Info,
  Loader2,
  OctagonX,
  TriangleAlert,
} from "lucide-react";
import { Toaster as Sonner, ToasterProps } from "sonner";

export function Toaster({ ...props }: ToasterProps) {
  return (
    <Sonner
      position="bottom-right"
      visibleToasts={4}
      gap={10}
      className="writewise-toaster toaster group"
      style={
        {
          "--normal-bg": "var(--toast-bg)",
          "--normal-text": "var(--toast-fg)",
          "--normal-border": "var(--toast-border)",
          "--border-radius": "0.75rem",
        } as CSSProperties
      }
      icons={{
        success: <CircleCheck className="size-4 shrink-0" aria-hidden="true" />,
        info: <Info className="size-4 shrink-0" aria-hidden="true" />,
        warning: <TriangleAlert className="size-4 shrink-0" aria-hidden="true" />,
        error: <OctagonX className="size-4 shrink-0" aria-hidden="true" />,
        loading: (
          <Loader2
            className="size-4 shrink-0 animate-spin"
            aria-hidden="true"
          />
        ),
      }}
      toastOptions={{
        duration: 4000,
      }}
      {...props}
    />
  );
}
