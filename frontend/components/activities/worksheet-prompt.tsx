import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function WorksheetPrompt({
  text,
  preview = false,
  footer,
}: {
  text: string | null | undefined;
  preview?: boolean;
  footer?: ReactNode;
}) {
  const prompt = text?.trim();

  return (
    <div
      className="from-brand-50/20 via-surface to-brand-50/10 dark:from-card dark:to-card/80 border-brand-200/50 dark:border-border/60 shadow-warm-sm relative overflow-hidden rounded-xl border bg-linear-to-b"
    >
      <div className="p-3.5 pb-5 sm:p-4 sm:pb-6">
        <div className={cn("relative", preview && "max-h-[148px] overflow-hidden sm:max-h-[156px]")}>
          <div
            className="cursive-guidelines pointer-events-none absolute inset-0 z-0 overflow-hidden print:opacity-60"
            aria-hidden="true"
          />
          <p
            className={cn(
              "relative z-10 tracking-wide break-words print:text-black",
              preview ? "line-clamp-3" : "whitespace-pre-wrap select-all",
              prompt
                ? // impeccable-disable-next-line design-system-font-size -- optical alignment to 48px baseline ruling grid
                  "font-cursive text-foreground/90 text-[32px]/[48px] font-medium sm:text-[34px]/[48px] md:text-[36px]/[48px]"
                : "font-sans text-muted-foreground/70 text-base italic sm:text-lg"
            )}
          >
            {prompt || "No text specified"}
          </p>
          {preview && (
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-linear-to-t from-surface via-surface/70 to-transparent dark:from-card dark:via-card/70"
              aria-hidden="true"
            />
          )}
        </div>
      </div>
      {footer && (
        <div className="border-t border-border/50 bg-muted/30 px-3 py-0.5">
          {footer}
        </div>
      )}
    </div>
  );
}
