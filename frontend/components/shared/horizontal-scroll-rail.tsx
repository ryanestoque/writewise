"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface HorizontalScrollRailProps {
  children: React.ReactNode;
  className?: string;
  viewportClassName?: string;
  scrollStep?: number;
}

/**
 * Single-line horizontal scroll rail with edge-fade masks and left/right
 * navigation buttons when content overflows, so off-screen items remain
 * discoverable on both touch and mouse/desktop viewports.
 */
export function HorizontalScrollRail({
  children,
  className,
  viewportClassName,
  scrollStep = 200,
}: HorizontalScrollRailProps) {
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
  }, [checkScroll, getViewport, children]);

  const scrollByDirection = (direction: -1 | 1) => {
    const el = getViewport();
    if (!el) return;
    el.scrollBy({
      left: direction * scrollStep,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  };

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
    <div className={cn("relative min-w-0 w-full flex items-center", className)}>
      {canScrollLeft && (
        <Button
          type="button"
          variant="outline"
          size="icon-xs"
          onClick={() => scrollByDirection(-1)}
          aria-label="Scroll left"
          tabIndex={-1}
          className="absolute left-0 z-10 size-7 rounded-full bg-background/95 text-foreground shadow-xs backdrop-blur-xs transition-opacity hover:bg-muted cursor-pointer after:absolute after:-inset-2 md:after:hidden"
        >
          <ChevronLeft aria-hidden="true" />
        </Button>
      )}

      <ScrollArea
        ref={scrollAreaRef}
        orientation="horizontal"
        hideScrollbar
        style={maskStyle}
        viewportClassName={cn("overscroll-x-contain", viewportClassName)}
        className="w-full min-w-0 touch-pan-x touch-pan-y transition-[mask-image]"
      >
        {children}
      </ScrollArea>

      {canScrollRight && (
        <Button
          type="button"
          variant="outline"
          size="icon-xs"
          onClick={() => scrollByDirection(1)}
          aria-label="Scroll right"
          tabIndex={-1}
          className="absolute right-0 z-10 size-7 rounded-full bg-background/95 text-foreground shadow-xs backdrop-blur-xs transition-opacity hover:bg-muted cursor-pointer after:absolute after:-inset-2 md:after:hidden"
        >
          <ChevronRight aria-hidden="true" />
        </Button>
      )}
    </div>
  );
}
