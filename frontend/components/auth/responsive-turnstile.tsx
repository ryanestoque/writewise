"use client";

import { forwardRef, useEffect, useRef, useState } from "react";
import {
  Turnstile,
  type TurnstileInstance,
  type TurnstileProps,
} from "@marsidev/react-turnstile";

type ResponsiveTurnstileProps = Omit<TurnstileProps, "onExpire"> & {
  onExpire: () => void;
};

export const ResponsiveTurnstile = forwardRef<
  TurnstileInstance | undefined,
  ResponsiveTurnstileProps
>(function ResponsiveTurnstile({ onExpire, options, ...props }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onExpireRef = useRef(onExpire);
  const [size, setSize] = useState<"compact" | "flexible" | null>(null);

  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let currentSize: "compact" | "flexible" | null = null;
    const observer = new ResizeObserver(([entry]) => {
      // Cloudflare's flexible widget requires at least 300px of actual space.
      const nextSize = entry.contentRect.width >= 300 ? "flexible" : "compact";
      if (nextSize === currentSize) return;
      currentSize = nextSize;
      // Changing size replaces the challenge, so discard its previous token.
      onExpireRef.current();
      setSize(nextSize);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="min-h-[65px] w-full min-w-0">
      {size && (
        <Turnstile
          {...props}
          ref={ref}
          onExpire={onExpire}
          options={{ ...options, size }}
        />
      )}
    </div>
  );
});
