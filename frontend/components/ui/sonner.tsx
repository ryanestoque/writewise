"use client";

import { Toaster as Sonner, ToasterProps } from "sonner";

export function Toaster({ ...props }: ToasterProps) {
  return (
    <Sonner
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-popover group-[.toaster]:text-popover-foreground group-[.toaster]:border-border group-[.toaster]:shadow-warm group-[.toaster]:rounded-xl font-sans",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:rounded-lg",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground group-[.toast]:rounded-lg",
          success:
            "group-[.toaster]:!border-primary/30 group-[.toaster]:!bg-primary/10 group-[.toaster]:!text-foreground dark:group-[.toaster]:!bg-primary/20 dark:group-[.toaster]:!border-primary/40",
          error:
            "group-[.toaster]:!border-destructive/30 group-[.toaster]:!bg-destructive/10 group-[.toaster]:!text-destructive dark:group-[.toaster]:!bg-destructive/20 dark:group-[.toaster]:!text-destructive dark:group-[.toaster]:!border-destructive/40",
          warning:
            "group-[.toaster]:!border-warning/30 group-[.toaster]:!bg-warning/15 group-[.toaster]:!text-warning-foreground dark:group-[.toaster]:!bg-warning/20 dark:group-[.toaster]:!text-warning dark:group-[.toaster]:!border-warning/40",
          info:
            "group-[.toaster]:!border-secondary group-[.toaster]:!bg-secondary/40 group-[.toaster]:!text-secondary-foreground dark:group-[.toaster]:!bg-secondary/20 dark:group-[.toaster]:!text-secondary-foreground",
        },
      }}
      {...props}
    />
  );
}
