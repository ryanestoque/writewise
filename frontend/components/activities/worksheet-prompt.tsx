import type { ReactNode } from "react";
import { Separator } from "@/components/ui/separator";
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
      className="from-primary/5 via-card to-primary/5 border-border/80 shadow-warm-sm relative overflow-hidden rounded-xl border bg-linear-to-b"
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
              preview ? "line-clamp-3" : "whitespace-pre-wrap",
              prompt
                ? // impeccable-disable-next-line design-system-font-size -- optical alignment to 48px baseline ruling grid
                  "font-cursive text-foreground/90 text-[32px]/[48px] font-medium sm:text-[34px]/[48px] md:text-[36px]/[48px]"
                : "font-sans text-muted-foreground/70 text-base italic sm:text-lg"
            )}
          >
            {prompt || "No text specified"}
          </p>
        </div>
      </div>
      {footer && (
        <>
          <Separator />
          <div className="bg-muted/30 px-3 py-1">
            {footer}
          </div>
        </>
      )}
    </div>
  );
}
