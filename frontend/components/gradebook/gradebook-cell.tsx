"use client";

import type { GradebookCell } from "@/lib/hooks/use-gradebook";
import { BandBadge } from "@/components/shared/band-badge";

export function GradebookCellButton({
  cell,
  onOpen,
  row,
  column,
  label,
}: {
  cell: GradebookCell;
  onOpen: () => void;
  row?: number;
  column?: number;
  label?: string;
}) {
  if (!cell.applicable) return <span className="text-muted-foreground text-xs">Not assigned</span>;
  return (
    <button
      type="button"
      data-gradecell
      data-row={row}
      data-column={column}
      aria-label={`${label ?? "Work grade"}: ${cell.coursework_status}, ${cell.final_points === null ? "no point grade" : `${cell.final_points} of ${cell.points_possible} points`}, ${cell.points_possible === null ? "assessment only" : cell.publication === "released" ? "shared" : "draft"}`}
      onClick={onOpen}
      className="hover:bg-muted focus-visible:ring-ring min-h-20 w-full rounded-md p-2 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none"
    >
      <span className="block text-sm font-semibold tabular-nums">
        {cell.coursework_status === "Excused"
          ? "Excused"
          : cell.points_possible === null
            ? "Assessment only"
            : cell.final_points === null
              ? "No grade"
              : `${cell.final_points} / ${cell.points_possible}`}
      </span>
      <span className="text-muted-foreground mt-1 block text-xs">
        {cell.coursework_status}
        {cell.late ? " · Late" : ""}
      </span>
      {cell.points_possible !== null && cell.coursework_status !== "Excused" && (
        <span className="mt-1 block text-xs">
          {cell.publication === "released" ? "Shared" : "Draft"}
          {cell.points_override !== null ? " · Override" : ""}
        </span>
      )}
      {cell.assessment_composite !== null && (
        <span className="mt-2 block">
          <BandBadge score={Number(cell.assessment_composite)} size="sm" />
        </span>
      )}
    </button>
  );
}
