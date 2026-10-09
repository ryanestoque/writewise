import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FilterPillItem<T extends string = string> {
  id: T;
  label: React.ReactNode;
  count?: number | string;
  icon?: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
}

export interface FilterPillsProps<T extends string = string> {
  items: FilterPillItem<T>[];
  value: T;
  onChange: (value: T) => void;
  label?: string;
  ariaLabel?: string;
  className?: string;
  containerClassName?: string;
  pillClassName?: string;
}

export function FilterPills<T extends string = string>({
  items,
  value,
  onChange,
  label,
  ariaLabel,
  className,
  containerClassName,
  pillClassName,
}: FilterPillsProps<T>) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = React.useState(false);
  const [canScrollRight, setCanScrollRight] = React.useState(false);

  const checkScroll = React.useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;

    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 2);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 2);
  }, []);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    checkScroll();

    const handleScroll = () => checkScroll();
    el.addEventListener("scroll", handleScroll, { passive: true });

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => checkScroll());
      resizeObserver.observe(el);
    } else {
      window.addEventListener("resize", handleScroll);
    }

    return () => {
      el.removeEventListener("scroll", handleScroll);
      if (resizeObserver) {
        resizeObserver.disconnect();
      } else {
        window.removeEventListener("resize", handleScroll);
      }
    };
  }, [checkScroll, items]);

  // Scroll active item into view when value changes
  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const selectedEl = el.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (selectedEl) {
      selectedEl.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "nearest",
      });
    }
  }, [value]);

  const handleScrollLeft = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: -200, behavior: "smooth" });
    }
  };

  const handleScrollRight = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: 200, behavior: "smooth" });
    }
  };

  // Determine dynamic mask style for visual fade on scrollable edges
  const maskStyle: React.CSSProperties = React.useMemo(() => {
    if (canScrollLeft && canScrollRight) {
      return {
        WebkitMaskImage:
          "linear-gradient(to right, transparent, black 28px, black calc(100% - 28px), transparent)",
        maskImage:
          "linear-gradient(to right, transparent, black 28px, black calc(100% - 28px), transparent)",
      };
    }
    if (canScrollLeft) {
      return {
        WebkitMaskImage:
          "linear-gradient(to right, transparent, black 28px, black 100%)",
        maskImage:
          "linear-gradient(to right, transparent, black 28px, black 100%)",
      };
    }
    if (canScrollRight) {
      return {
        WebkitMaskImage:
          "linear-gradient(to right, black 0%, black calc(100% - 28px), transparent)",
        maskImage:
          "linear-gradient(to right, black 0%, black calc(100% - 28px), transparent)",
      };
    }
    return {};
  }, [canScrollLeft, canScrollRight]);

  return (
    <div
      className={cn(
        "relative min-w-0 flex-1 flex items-center group/pills",
        containerClassName
      )}
    >
      {/* Scroll Left Button */}
      {canScrollLeft && (
        <button
          type="button"
          onClick={handleScrollLeft}
          aria-label="Scroll left"
          tabIndex={-1}
          className="absolute left-0 z-10 flex size-7 items-center justify-center rounded-full border border-border bg-background/90 text-foreground shadow-xs backdrop-blur-xs transition-opacity hover:bg-muted focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring cursor-pointer shrink-0"
        >
          <ChevronLeft className="size-4" />
        </button>
      )}

      {/* Scrollable Container */}
      <div
        ref={scrollRef}
        role="group"
        aria-label={ariaLabel || label || "Filters"}
        style={maskStyle}
        className={cn(
          "flex items-center gap-1.5 overflow-x-auto overflow-y-hidden py-1 pr-1 scrollbar-none max-w-full touch-pan-x touch-pan-y overscroll-x-contain transition-[mask-image]",
          className
        )}
      >
        {label && (
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mr-1 shrink-0 select-none">
            {label}
          </span>
        )}

        {items.map((item) => {
          const isSelected = value === item.id;
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              type="button"
              id={`filter-pill-${item.id}`}
              disabled={item.disabled}
              onClick={() => onChange(item.id)}
              aria-pressed={isSelected}
              className={cn(
                "relative inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 min-h-[34px] sm:min-h-[32px] text-xs font-medium rounded-lg border transition-all shrink-0 cursor-pointer",
                "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
                "after:absolute after:-inset-x-1 after:inset-y-0 after:content-['']",
                "disabled:pointer-events-none disabled:opacity-50",
                isSelected
                  ? "bg-brand-700 dark:bg-primary text-white dark:text-primary-foreground border-brand-700 dark:border-primary shadow-warm-sm font-semibold"
                  : "bg-background text-muted-foreground border-border hover:bg-muted/60 hover:text-foreground",
                pillClassName
              )}
            >
              {Icon && <Icon className="size-3.5 shrink-0" />}
              <span>{item.label}</span>
              {item.count !== undefined && (
                <span
                  className={cn(
                    "text-xs font-semibold px-1.5 py-0.5 rounded-full transition-colors",
                    isSelected
                      ? "bg-white/20 dark:bg-primary-foreground/20 text-white dark:text-primary-foreground"
                      : "bg-muted text-foreground"
                  )}
                >
                  {item.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Scroll Right Button */}
      {canScrollRight && (
        <button
          type="button"
          onClick={handleScrollRight}
          aria-label="Scroll right"
          tabIndex={-1}
          className="absolute right-0 z-10 flex size-7 items-center justify-center rounded-full border border-border bg-background/90 text-foreground shadow-xs backdrop-blur-xs transition-opacity hover:bg-muted focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring cursor-pointer shrink-0"
        >
          <ChevronRight className="size-4" />
        </button>
      )}
    </div>
  );
}

