"use client";

import { memo } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ArrowRightLeft, Download, Trash2 } from "lucide-react";
import { FloatingActionBar } from "@/components/ui/floating-action-bar";

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
              className="h-8 px-2 sm:px-3 text-xs font-medium border-border/80 hover:bg-muted/80 hover:text-foreground active:scale-[0.97] transition-all shrink-0 rounded-lg cursor-pointer"
              aria-label={`Move ${selectedCount} selected ${
                selectedCount === 1 ? "student" : "students"
              } to another section`}
            >
              <ArrowRightLeft className="w-3.5 h-3.5 sm:mr-1.5 text-muted-foreground shrink-0" />
              <span className="hidden sm:inline">Move Section</span>
              <span className="sm:hidden hidden min-[360px]:inline">Move</span>
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
              className="h-8 px-2 sm:px-3 text-xs font-medium border-border/80 hover:bg-muted/80 hover:text-foreground active:scale-[0.97] transition-all shrink-0 rounded-lg cursor-pointer"
              aria-label={`Export ${selectedCount} selected ${
                selectedCount === 1 ? "student" : "students"
              } to CSV`}
            >
              <Download className="w-3.5 h-3.5 sm:mr-1.5 text-muted-foreground shrink-0" />
              <span className="hidden sm:inline">Export</span>
              <span className="sm:hidden hidden min-[400px]:inline">
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
              className="h-8 px-2 sm:px-3 text-xs font-medium bg-destructive/10 text-destructive hover:bg-destructive hover:text-white border border-destructive/20 active:scale-[0.97] transition-all shrink-0 rounded-lg cursor-pointer"
              aria-label={`Remove ${selectedCount} selected ${
                selectedCount === 1 ? "student" : "students"
              } from roster`}
            >
              <Trash2 className="w-3.5 h-3.5 sm:mr-1.5 shrink-0" />
              <span className="hidden sm:inline">Remove</span>
              <span className="sm:hidden hidden min-[360px]:inline">
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
