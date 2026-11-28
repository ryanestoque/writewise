"use client";

import { memo } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ArrowRightLeft, Download, Trash2 } from "lucide-react";
import { FloatingActionBar } from "@/components/shared/floating-action-bar";

interface FloatingBatchBarProps {
  /** Number of currently selected items */
  selectedCount: number;
  /** Total number of items in current filtered view */
  totalCount: number;
  /** Whether all filtered items are selected */
  allSelected?: boolean;
  /** Callback to toggle/select all filtered items */
  onSelectAll?: () => void;
  /** Callback to clear selection */
  onClearSelection: () => void;
  /** Callback to open batch move dialog */
  onMoveSection: () => void;
  /** Callback to export selected items to CSV */
  onExportCSV: () => void;
  /** Callback to open batch remove confirmation */
  onRemove: () => void;
  /** Whether batch removal is currently in flight */
  isRemoving?: boolean;
}

export const FloatingBatchBar = memo(function FloatingBatchBar({
  selectedCount,
  totalCount,
  allSelected = false,
  onSelectAll,
  onClearSelection,
  onMoveSection,
  onExportCSV,
  onRemove,
  isRemoving = false,
}: FloatingBatchBarProps) {
  return (
    <FloatingActionBar
      selectedCount={selectedCount}
      totalCount={totalCount}
      itemLabel="student"
      allSelected={allSelected}
      onSelectAll={onSelectAll}
      onClearSelection={onClearSelection}
      ariaLabel="Batch student actions"
    >
      {/* Move Section Action */}
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="outline"
              size="sm"
              onClick={onMoveSection}
              disabled={isRemoving}
              className="h-10 sm:h-8 px-2.5 sm:px-3 text-xs font-medium border-border/80 hover:bg-muted/80 hover:text-foreground active:scale-[0.97] transition-all motion-reduce:transform-none motion-reduce:transition-colors shrink-0 rounded-lg cursor-pointer"
              aria-label={`Move ${selectedCount} selected ${
                selectedCount === 1 ? "student" : "students"
              } to another section`}
            >
              <ArrowRightLeft data-icon="inline-start" className="text-muted-foreground" aria-hidden="true" />
              <span className="hidden sm:inline">Move Section</span>
              <span className="hidden min-[360px]:inline sm:hidden">Move</span>
            </Button>
          }
        />
        <TooltipContent
          side="top"
          sideOffset={6}
          className="text-xs font-normal"
        >
          Move {selectedCount} {selectedCount === 1 ? "student" : "students"} to
          another section
        </TooltipContent>
      </Tooltip>

      {/* Export CSV Action */}
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="outline"
              size="sm"
              onClick={onExportCSV}
              disabled={isRemoving}
              className="h-10 sm:h-8 px-2.5 sm:px-3 text-xs font-medium border-border/80 hover:bg-muted/80 hover:text-foreground active:scale-[0.97] transition-all motion-reduce:transform-none motion-reduce:transition-colors shrink-0 rounded-lg cursor-pointer"
              aria-label={`Export ${selectedCount} selected ${
                selectedCount === 1 ? "student" : "students"
              } to CSV`}
            >
              <Download data-icon="inline-start" className="text-muted-foreground" aria-hidden="true" />
              <span className="hidden sm:inline">Export</span>
              <span className="hidden min-[400px]:inline sm:hidden">
                Export
              </span>
            </Button>
          }
        />
        <TooltipContent
          side="top"
          sideOffset={6}
          className="text-xs font-normal"
        >
          Export {selectedCount} {selectedCount === 1 ? "student" : "students"}{" "}
          to CSV
        </TooltipContent>
      </Tooltip>

      {/* Remove Action */}
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="destructive"
              size="sm"
              onClick={onRemove}
              disabled={isRemoving}
              className="h-10 sm:h-8 px-2.5 sm:px-3 text-xs font-medium border border-destructive/20 active:scale-[0.97] transition-all motion-reduce:transform-none motion-reduce:transition-colors shrink-0 rounded-lg cursor-pointer"
              aria-label={`Remove ${selectedCount} selected ${
                selectedCount === 1 ? "student" : "students"
              } from roster`}
            >
              <Trash2 data-icon="inline-start" aria-hidden="true" />
              <span className="hidden sm:inline">Remove</span>
              <span className="hidden min-[360px]:inline sm:hidden">
                Remove
              </span>
            </Button>
          }
        />
        <TooltipContent
          side="top"
          sideOffset={6}
          className="text-xs font-normal"
        >
          Remove {selectedCount} {selectedCount === 1 ? "student" : "students"}{" "}
          from roster
        </TooltipContent>
      </Tooltip>
    </FloatingActionBar>
  );
});
