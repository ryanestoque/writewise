import { cn } from "@/lib/utils";

export function WorksheetPrompt({
  text,
  preview = false,
}: {
  text: string | null | undefined;
  preview?: boolean;
}) {
  const prompt = text?.trim();

  return (
    <div
      className={cn(
        "from-brand-50/20 via-surface to-brand-50/10 dark:from-card dark:to-card/80 border-brand-200/50 dark:border-border/60 shadow-warm-sm relative overflow-hidden rounded-xl border bg-linear-to-b p-3.5 pb-5 sm:p-4 sm:pb-6",
        preview && "mb-3.5"
      )}
    >
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
              ? "font-cursive text-foreground/90 text-[32px]/[48px] font-medium sm:text-[34px]/[48px] md:text-[36px]/[48px]"
              : "font-sans text-muted-foreground/70 text-base italic sm:text-lg"
          )}
        >
          {prompt || "No text specified"}
        </p>
      </div>
    </div>
  );
}
