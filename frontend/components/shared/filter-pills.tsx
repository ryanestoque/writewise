import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export interface FilterPillItem<T extends string = string> {
  id: T;
  label: React.ReactNode;
  count?: number | string;
  icon?: React.ComponentType<{
    className?: string;
    "aria-hidden"?: React.AriaAttributes["aria-hidden"];
    "data-icon"?: string;
  }>;
  disabled?: boolean;
  className?: string;
  badgeClassName?: string;
}

export interface FilterPillsProps<T extends string = string> {
  items: FilterPillItem<T>[];
  value: T;
  onChange: (value: T) => void;
  label?: string;
  ariaLabel?: string;
  trailing?: React.ReactNode;
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
  trailing,
  className,
  containerClassName,
  pillClassName,
}: FilterPillsProps<T>) {
  const groupId = React.useId();
  const scrollAreaRef = React.useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = React.useState(false);
  const [canScrollRight, setCanScrollRight] = React.useState(false);

  const getViewport = React.useCallback(() => {
    return (
      scrollAreaRef.current?.querySelector<HTMLElement>(
        '[data-slot="scroll-area-viewport"]'
      ) ?? null
    );
  }, []);

  const checkScroll = React.useCallback(() => {
    const el = getViewport();
    if (!el) return;

    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 2);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 2);
  }, [getViewport]);

  React.useEffect(() => {
    const el = getViewport();
    if (!el) return;

    const rafId = window.requestAnimationFrame(() => checkScroll());

    const handleScroll = () => checkScroll();
    el.addEventListener("scroll", handleScroll, { passive: true });

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => checkScroll());
      resizeObserver.observe(el);
      if (el.firstElementChild) {
        resizeObserver.observe(el.firstElementChild);
      }
    } else {
      window.addEventListener("resize", handleScroll);
    }

    return () => {
      window.cancelAnimationFrame(rafId);
      el.removeEventListener("scroll", handleScroll);
      if (resizeObserver) {
        resizeObserver.disconnect();
      } else {
        window.removeEventListener("resize", handleScroll);
      }
    };
  }, [checkScroll, getViewport, items]);

  // Scroll active item into view when value changes
  React.useEffect(() => {
    const el = getViewport();
    if (!el) return;

    const selectedEl = el.querySelector<HTMLElement>(
      '[data-pressed], [aria-pressed="true"]'
    );
    if (selectedEl) {
      selectedEl.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
        block: "nearest",
        inline: "nearest",
      });
    }
  }, [getViewport, value]);

  const handleScrollLeft = () => {
    const el = getViewport();
    if (el) {
      el.scrollBy({
        left: -200,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
    }
  };

  const handleScrollRight = () => {
    const el = getViewport();
    if (el) {
      el.scrollBy({
        left: 200,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
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
          className="absolute left-0 z-10 size-7 rounded-full bg-background/90 text-foreground shadow-xs backdrop-blur-xs transition-opacity hover:bg-muted cursor-pointer after:absolute after:-inset-2 md:after:hidden"
        >
          <ChevronLeft aria-hidden="true" />
        </Button>
      )}

      {/* Scrollable Container */}
      <ScrollArea
        ref={scrollAreaRef}
        orientation="horizontal"
        hideScrollbar
        style={maskStyle}
        viewportClassName="overscroll-x-contain"
        className={cn(
          "w-full min-w-0 touch-pan-x touch-pan-y transition-[mask-image]",
          className
        )}
      >
        <div className="flex w-max items-center gap-1.5 py-1 pr-1">
          {label && (
            <span className="mr-1 shrink-0 select-none text-xs font-semibold uppercase tracking-wider text-muted-foreground">
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
                    "relative h-auto min-h-10 gap-1.5 rounded-lg border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition-[color,background-color,border-color,box-shadow] cursor-pointer touch-manipulation hover:bg-muted/60 hover:text-foreground sm:min-h-8",
                    "data-pressed:border-primary data-pressed:bg-primary data-pressed:font-semibold data-pressed:text-primary-foreground data-pressed:shadow-warm-sm data-pressed:hover:bg-primary data-pressed:hover:text-primary-foreground",
                    "after:absolute after:-inset-x-1 after:inset-y-0 after:content-['']",
                    pillClassName,
                    item.className
                  )}
                >
                  {Icon && <Icon data-icon="inline-start" aria-hidden="true" />}
                  <span>{item.label}</span>
                  {item.count !== undefined && (
                    <Badge
                      variant="secondary"
                      className={cn(
                        "h-auto rounded-full px-1.5 py-0.5 text-xs font-semibold tabular-nums transition-colors",
                        isSelected &&
                          "bg-primary-foreground/20 text-primary-foreground",
                        item.badgeClassName
                      )}
                    >
                      {item.count}
                    </Badge>
                  )}
                </ToggleGroupItem>
              );
            })}
          </ToggleGroup>
          {trailing}
        </div>
      </ScrollArea>

      {/* Scroll Right Button */}
      {canScrollRight && (
        <Button
          type="button"
          variant="outline"
          size="icon-xs"
          onClick={handleScrollRight}
          aria-label="Scroll right"
          tabIndex={-1}
          className="absolute right-0 z-10 size-7 rounded-full bg-background/90 text-foreground shadow-xs backdrop-blur-xs transition-opacity hover:bg-muted cursor-pointer after:absolute after:-inset-2 md:after:hidden"
        >
          <ChevronRight aria-hidden="true" />
        </Button>
      )}
    </div>
  );
}

