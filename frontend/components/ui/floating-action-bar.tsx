"use client";

import { memo, ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Kbd } from "@/components/ui/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CheckCheck, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FloatingActionBarProps {
  /** Number of currently selected items */
  selectedCount: number;
  /** Optional total count of items in current filtered view */
  totalCount?: number;
  /** Label for selected items (e.g., "activity" | "student" or { singular: "activity", plural: "activities" }) */
  itemLabel?: string | { singular: string; plural: string };
  /** Whether all filtered items are currently selected */
  allSelected?: boolean;
  /** Callback to select or toggle all filtered items */
  onSelectAll?: () => void;
  /** Callback to clear selection */
  onClearSelection: () => void;
  /** Action buttons rendered on the right side of the bar */
  children?: ReactNode;
  /** Accessible label for the region / toolbar */
  ariaLabel?: string;
  /** Additional container classes */
  className?: string;
}

export const FloatingActionBar = memo(function FloatingActionBar({
  selectedCount,
  totalCount,
  itemLabel = "item",
  allSelected = false,
  onSelectAll,
  onClearSelection,
  children,
  ariaLabel,
  className,
}: FloatingActionBarProps) {
  if (selectedCount <= 0) return null;

  const labels =
    typeof itemLabel === "string"
      ? itemLabel === "activity"
        ? { singular: "activity", plural: "activities" }
        : itemLabel === "student"
        ? { singular: "student", plural: "students" }
        : { singular: itemLabel, plural: `${itemLabel}s` }
      : itemLabel;

  const singular = labels.singular;
  const plural = labels.plural;
  const currentLabel = selectedCount === 1 ? singular : plural;
  const regionLabel = ariaLabel || `Batch ${plural} actions`;

  return (
    <TooltipProvider delay={200}>
      <aside
        role="region"
        aria-label={regionLabel}
        className={cn(
          "fixed inset-x-0 bottom-0 md:bottom-6 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 z-40 w-full md:w-auto md:max-w-2xl animate-in fade-in slide-in-from-bottom-4 motion-reduce:animate-none motion-reduce:transition-none duration-200 select-none",
          className
        )}
      >
        <span className="sr-only" aria-live="polite" aria-atomic="true">
          {selectedCount} {currentLabel} selected
          {typeof totalCount === "number" ? ` of ${totalCount}` : ""}. Batch actions available. Press Escape to clear selection.
        </span>

        <div className="bg-surface/95 dark:bg-card/95 backdrop-blur-md border-t border-x-0 border-b-0 md:border border-border/80 dark:border-border/60 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] dark:shadow-[0_-4px_20px_rgba(0,0,0,0.3)] md:shadow-[0_8px_30px_rgb(0,0,0,0.12)] dark:md:shadow-[0_8px_30px_rgb(0,0,0,0.4)] md:ring-1 md:ring-black/5 dark:md:ring-white/10 rounded-none md:rounded-full px-3 py-2 sm:px-4 md:px-3.5 md:py-2 pb-[max(0.75rem,calc(env(safe-area-inset-bottom)+0.5rem))] md:pb-2 flex items-center justify-between gap-1.5 sm:gap-2.5 text-foreground">
          {/* Left: Count Badge & Context */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 min-w-0">
            <Badge className="bg-brand-700 hover:bg-brand-800 dark:bg-primary dark:hover:bg-primary/90 text-white font-semibold text-xs px-2 sm:px-2.5 py-1 rounded-full shadow-2xs shrink-0 flex items-center gap-1 transition-colors">
              <span className="tabular-nums font-bold">{selectedCount}</span>
              <span className="hidden sm:inline">Selected</span>
              <span className="sm:hidden text-[11px]">Sel.</span>
            </Badge>

            {typeof totalCount === "number" && (
              <span className="text-xs text-muted-foreground hidden min-[480px]:inline truncate">
                of {totalCount}
              </span>
            )}

            {onSelectAll &&
              !allSelected &&
              typeof totalCount === "number" &&
              totalCount > selectedCount && (
                <button
                  type="button"
                  onClick={onSelectAll}
                  className="inline-flex items-center gap-1 text-[11px] text-primary hover:text-brand-700 dark:text-primary dark:hover:text-primary/80 font-medium ml-0.5 hover:underline underline-offset-2 transition-colors cursor-pointer shrink-0 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring rounded-sm px-1 py-0.5"
                  title={`Select all ${totalCount} ${plural}`}
                >
                  <CheckCheck className="w-3 h-3 text-primary shrink-0" />
                  <span className="hidden sm:inline">
                    Select all ({totalCount})
                  </span>
                  <span className="sm:hidden">All ({totalCount})</span>
                </button>
              )}
          </div>

          {/* Divider on larger screens if there are children actions */}
          {children && (
            <div
              className="h-4 w-px bg-border/80 hidden md:block"
              aria-hidden="true"
            />
          )}

          {/* Right: Action Buttons Group & Clear Selection */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            {children}

            {/* Clear Selection Button with Expanded Touch Target and Esc Shortcut */}
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    onClick={onClearSelection}
                    className="relative flex items-center justify-center h-8 w-8 sm:h-7.5 sm:w-7.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/80 active:scale-95 transition-all ml-0.5 after:absolute after:-inset-2.5 after:content-[''] shrink-0 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
                    aria-label="Clear selection (Esc)"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                }
              />
              <TooltipContent
                side="top"
                sideOffset={6}
                className="text-xs font-normal flex items-center gap-1.5"
              >
                <span>Clear selection</span>
                <Kbd className="text-[10px] h-4.5 px-1.5 py-0 bg-popover text-popover-foreground border border-border/80 font-mono shadow-2xs">
                  Esc
                </Kbd>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </aside>
    </TooltipProvider>
  );
});
