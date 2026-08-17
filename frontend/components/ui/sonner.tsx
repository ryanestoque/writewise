"use client";

import { Toaster as Sonner, ToasterProps } from "sonner";

export function Toaster({ ...props }: ToasterProps) {
  return (
    <Sonner
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-surface group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-warm-lg group-[.toaster]:rounded-xl font-sans",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:rounded-lg",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground group-[.toast]:rounded-lg",
          success:
            "group-[.toaster]:!border-brand-300 group-[.toaster]:!bg-brand-50 group-[.toaster]:!text-brand-950",
          error:
            "group-[.toaster]:!border-red-200 group-[.toaster]:!bg-red-50 group-[.toaster]:!text-red-950",
          warning:
            "group-[.toaster]:!border-amber-200 group-[.toaster]:!bg-amber-50 group-[.toaster]:!text-amber-950",
          info:
            "group-[.toaster]:!border-sky-200 group-[.toaster]:!bg-sky-50 group-[.toaster]:!text-sky-950",
        },
      }}
      {...props}
    />
  );
}
