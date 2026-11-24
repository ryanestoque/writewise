import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "bg-muted dark:bg-foreground/10 animate-pulse motion-reduce:animate-none rounded-2xl",
        className
      )}
      {...props}
    />
  );
}

export { Skeleton };
