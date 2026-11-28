import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

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
  const groupId = React.useId();
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
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
        block: "nearest",
        inline: "nearest",
      });
    }
  }, [value]);

  const handleScrollLeft = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: -200, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
    }
  };

  const handleScrollRight = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: 200, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
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
        <Button
          type="button"
          variant="outline"
          size="icon-xs"
          onClick={handleScrollLeft}
          aria-label="Scroll left"
          tabIndex={-1}
          className="absolute left-0 z-10 size-7 rounded-full bg-background/90 text-foreground shadow-xs backdrop-blur-xs transition-opacity hover:bg-muted dark:bg-background/90 dark:hover:bg-muted cursor-pointer"
        >
          <ChevronLeft className="size-4" />
        </Button>
      )}

      {/* Scrollable Container */}
      <div
        ref={scrollRef}
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

        <ToggleGroup
          value={[value]}
          multiple={false}
          spacing={1.5}
          onValueChange={(vals) => {
            if (vals.length > 0) {
              onChange(vals[0] as T);
            }
          }}
          aria-label={ariaLabel || label || "Filters"}
          className="flex items-center gap-1.5"
        >
          {items.map((item) => {
            const isSelected = value === item.id;
            const Icon = item.icon;

            return (
              <ToggleGroupItem
                key={item.id}
                value={item.id}
                variant="outline"
                size="sm"
                id={`${groupId}-pill-${item.id}`}
                disabled={item.disabled}
                className={cn(
                  "relative h-auto gap-1.5 px-3 py-1.5 min-h-[40px] sm:min-h-[32px] text-xs font-medium rounded-lg transition-all cursor-pointer touch-manipulation",
                  "after:absolute after:-inset-x-1 after:inset-y-0 after:content-['']",
                  isSelected
                    ? "bg-brand-700 dark:bg-primary text-white dark:text-primary-foreground border-brand-700 dark:border-primary hover:bg-brand-700 dark:hover:bg-primary aria-pressed:bg-brand-700 dark:aria-pressed:bg-primary aria-pressed:text-white dark:aria-pressed:text-primary-foreground shadow-warm-sm font-semibold"
                    : "bg-background text-muted-foreground border-border hover:bg-muted/60 hover:text-foreground dark:bg-background dark:hover:bg-muted/60",
                  pillClassName
                )}
              >
                {Icon && <Icon className="size-3.5 shrink-0" />}
                <span>{item.label}</span>
                {item.count !== undefined && (
                  <Badge
                    variant="secondary"
                    className={cn(
                      "h-auto text-xs font-semibold px-1.5 py-0.5 rounded-full tabular-nums transition-colors",
                      isSelected
                        ? "bg-white/20 dark:bg-primary-foreground/20 text-white dark:text-primary-foreground"
                        : "bg-muted text-foreground"
                    )}
                  >
                    {item.count}
                  </Badge>
                )}
              </ToggleGroupItem>
            );
          })}
        </ToggleGroup>
      </div>

      {/* Scroll Right Button */}
      {canScrollRight && (
        <Button
          type="button"
          variant="outline"
          size="icon-xs"
          onClick={handleScrollRight}
          aria-label="Scroll right"
          tabIndex={-1}
          className="absolute right-0 z-10 size-7 rounded-full bg-background/90 text-foreground shadow-xs backdrop-blur-xs transition-opacity hover:bg-muted dark:bg-background/90 dark:hover:bg-muted cursor-pointer"
        >
          <ChevronRight className="size-4" />
        </Button>
      )}
    </div>
  );
}

