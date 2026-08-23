import * as React from "react";
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
  return (
    <div
      className={cn(
        "relative min-w-0 flex-1 flex items-center",
        containerClassName
      )}
    >
      <div
        role="group"
        aria-label={ariaLabel || label || "Filters"}
        className={cn(
          "flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none max-w-full touch-pan-x overscroll-x-contain",
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
                "relative inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[34px] sm:min-h-[32px] text-xs font-medium rounded-lg border transition-all shrink-0 cursor-pointer",
                "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
                "after:absolute after:-inset-1 after:content-['']",
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
                    "text-[10px] font-medium px-1.5 py-0.2 rounded-full transition-colors",
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
    </div>
  );
}
