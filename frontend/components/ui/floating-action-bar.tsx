"use client";

import { memo, ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Separator } from "@/components/ui/separator";
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
    <>
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {selectedCount > 0
          ? `${selectedCount} ${currentLabel} selected${typeof totalCount === "number" ? ` of ${totalCount}` : ""}. Batch actions available. Press Escape to clear selection.`
          : ""}
      </span>
      {selectedCount > 0 && (
        <TooltipProvider delay={200}>
          <aside
            role="region"
            aria-label={regionLabel}
            className={cn(
              "fixed inset-x-0 bottom-0 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:inset-x-auto md:bottom-6 md:left-1/2 md:-translate-x-1/2 md:pb-2.5 z-40 w-full md:w-auto md:max-w-2xl bg-popover text-popover-foreground border-t border-x-0 border-b-0 md:border border-border shadow-lg rounded-none md:rounded-full px-3 pt-2 sm:px-4 md:px-3.5 md:pt-2.5 flex items-center justify-between gap-1.5 sm:gap-2.5 animate-in fade-in slide-in-from-bottom-4 motion-reduce:animate-none motion-reduce:transition-none duration-200 select-none",
              className
            )}
          >
            {/* Left: Count Badge & Context */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 min-w-0">
              <Badge className="font-semibold text-xs px-2.5 py-1 rounded-full shrink-0 flex items-center gap-1">
                <span className="tabular-nums font-bold font-sans">{selectedCount}</span>
                <span className="hidden sm:inline">Selected</span>
                <span className="sm:hidden text-xs">Sel.</span>
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
                  <Button
                    type="button"
                    variant="link"
                    size="xs"
                    onClick={onSelectAll}
                    className="h-auto gap-1 text-xs font-medium ml-0.5 cursor-pointer shrink-0 px-1 py-0.5"
                    title={`Select all ${totalCount} ${plural}`}
                  >
                    <CheckCheck data-icon="inline-start" aria-hidden="true" />
                    <span className="hidden sm:inline">
                      Select all ({totalCount})
                    </span>
                    <span className="sm:hidden">All ({totalCount})</span>
                  </Button>
                )}
            </div>

            {/* Divider on larger screens if there are children actions */}
            {children && (
              <Separator
                orientation="vertical"
                className="h-4 hidden md:block"
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
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      onClick={onClearSelection}
                      className="relative size-8 sm:size-7 rounded-full text-muted-foreground hover:text-foreground ml-0.5 after:absolute after:-inset-2.5 after:content-[''] shrink-0 cursor-pointer"
                      aria-label="Clear selection (Esc)"
                    >
                      <X aria-hidden="true" />
                    </Button>
                  }
                />
                <TooltipContent
                  side="top"
                  sideOffset={6}
                  className="text-xs font-normal flex items-center gap-1.5"
                >
                  <span>Clear selection</span>
                  <Kbd className="text-xs h-5 px-1.5 py-0 bg-popover text-popover-foreground border border-border font-mono shadow-2xs">
                    Esc
                  </Kbd>
                </TooltipContent>
              </Tooltip>
            </div>
          </aside>
        </TooltipProvider>
      )}
    </>
  );
});
