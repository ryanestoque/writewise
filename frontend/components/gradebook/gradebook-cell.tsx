"use client";

import { useState, useRef, useEffect, useSyncExternalStore, type KeyboardEvent } from "react";
import { Pencil, SlidersHorizontal, Check, X, Loader2 } from "lucide-react";
import type { GradebookCell } from "@/lib/hooks/use-gradebook";
import { BandBadge } from "@/components/shared/band-badge";
import { validPointsInput } from "./points-field";
import { cn } from "@/lib/utils";

function formatStatus(status: string) {
  if (status === "Missing") return "Awaiting scan";
  return status;
}

function subscribeTouchDevice(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  const media = window.matchMedia("(pointer: coarse)");
  media.addEventListener("change", callback);
  window.addEventListener("resize", callback);
  return () => {
    media.removeEventListener("change", callback);
    window.removeEventListener("resize", callback);
  };
}

function getTouchSnapshot() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 768;
}

function getServerSnapshot() {
  return false;
}

export function GradebookCellButton({
  cell,
  onOpen,
  row,
  column,
  label,
  hasUnreadComments = false,
  onSaveScore,
  onNavigateDown,
  viewMode = "points",
}: {
  cell: GradebookCell;
  onOpen: () => void;
  row?: number;
  column?: number;
  label?: string;
  hasUnreadComments?: boolean;
  onSaveScore?: (score: string) => Promise<void>;
  onNavigateDown?: (row: number, column: number) => void;
  viewMode?: "points" | "diagnostic";
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [inputVal, setInputVal] = useState("");
  const [error, setError] = useState<string | null>(null);
  const isTouchDevice = useSyncExternalStore(subscribeTouchDevice, getTouchSnapshot, getServerSnapshot);
  const inputRef = useRef<HTMLInputElement>(null);

  const initialVal =
    cell.points_override !== null
      ? String(cell.points_override)
      : cell.final_points !== null
        ? String(cell.final_points)
        : "";

  function startEditing() {
    setInputVal(initialVal);
    setError(null);
    setIsEditing(true);
  }

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  if (!cell.applicable) {
    return <span className="text-muted-foreground block p-2 text-xs">Not assigned</span>;
  }

  const canEditScore =
    cell.points_possible !== null &&
    cell.coursework_status !== "Excused" &&
    typeof onSaveScore === "function";

  const statusLabel = formatStatus(cell.coursework_status);

  async function handleCommit() {
    if (!canEditScore || !onSaveScore) return;
    const trimmed = inputVal.trim();
    if (trimmed !== "" && !validPointsInput(trimmed, true, Number(cell.points_possible))) {
      setError(`0–${cell.points_possible}`);
      return;
    }
    setError(null);
    setIsSaving(true);
    try {
      await onSaveScore(trimmed);
      setIsEditing(false);
      if (typeof row === "number" && typeof column === "number" && onNavigateDown) {
        onNavigateDown(row, column);
      }
    } catch {
      setError("Failed");
    } finally {
      setIsSaving(false);
    }
  }

  function handleInputKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      void handleCommit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setIsEditing(false);
      setInputVal(initialVal);
      setError(null);
    }
  }

  function handleCellKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (isEditing) return;
    if (e.key === "Enter") {
      if (canEditScore) {
        e.preventDefault();
        startEditing();
      } else {
        e.preventDefault();
        onOpen();
      }
    } else if (e.key === " ") {
      e.preventDefault();
      onOpen();
    }
  }

  if (isEditing) {
    return (
      <div
        className="bg-card ring-2 ring-primary relative min-h-[5rem] w-full rounded-sm p-2 shadow-xs"
        data-gradecell-active
      >
        <div className="flex items-center gap-1.5">
          <input
            ref={inputRef}
            type="text"
            inputMode="decimal"
            disabled={isSaving}
            value={inputVal}
            onChange={(e) => {
              setInputVal(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={handleInputKeyDown}
            className={cn(
              "h-8 w-16 rounded-sm border px-1.5 text-center text-base sm:text-sm font-semibold tabular-nums focus:outline-none focus:ring-1 focus:ring-primary",
              error ? "border-destructive text-destructive" : "border-input bg-background"
            )}
            placeholder="—"
            aria-label={`Score for ${label ?? "cell"}`}
          />
          <span className="text-muted-foreground text-xs font-normal">/ {cell.points_possible}</span>
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              disabled={isSaving}
              onClick={() => void handleCommit()}
              aria-label="Save score"
              className="text-primary hover:bg-muted inline-flex size-6 items-center justify-center rounded-sm transition-colors"
            >
              {isSaving ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Check className="size-3.5" />
              )}
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={() => {
                setIsEditing(false);
                setInputVal(initialVal);
              }}
              aria-label="Cancel editing"
              className="text-muted-foreground hover:bg-muted inline-flex size-6 items-center justify-center rounded-sm transition-colors"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </div>
        {error ? (
          <span className="text-destructive mt-1 block text-xs">{error}</span>
        ) : (
          <span className="text-muted-foreground mt-1 block text-xs">
            Enter to save & advance ↓
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      role="group"
      aria-roledescription="grade cell"
      tabIndex={0}
      data-gradecell
      data-row={row}
      data-column={column}
      aria-label={`${label ?? "Work grade"}: ${statusLabel}, ${
        cell.final_points === null
          ? "no point grade"
          : `${cell.final_points} of ${cell.points_possible} points`
      }, ${
        cell.assessment_composite !== null
          ? `composite score ${Number(cell.assessment_composite).toFixed(1)}`
          : "no assessment"
      }, ${
        cell.points_possible === null
          ? "assessment only"
          : cell.publication === "released"
            ? "shared with parents"
            : "draft"
      }${hasUnreadComments ? ", unread comments" : ""}. Press Enter to edit score, Space to inspect details.`}
      onClick={() => {
        if (isTouchDevice) {
          onOpen();
        } else if (canEditScore) {
          startEditing();
        } else {
          onOpen();
        }
      }}
      onDoubleClick={onOpen}
      onKeyDown={handleCellKeyDown}
      className="group hover:bg-muted/70 hover:border-border/60 focus-visible:ring-ring focus-visible:border-ring relative flex min-h-[5rem] w-full flex-col justify-between rounded-sm border border-transparent p-2 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none cursor-pointer"
    >
      {viewMode === "diagnostic" ? (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-1.5 min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              {cell.assessment_composite !== null ? (
                <div className="flex items-center gap-1 min-w-0">
                  <BandBadge score={Number(cell.assessment_composite)} size="sm" />
                  <span className="text-xs font-semibold tabular-nums text-foreground">
                    {Number(cell.assessment_composite).toFixed(1)}
                  </span>
                  <span
                    className="inline-flex items-center px-1 rounded-xs text-xs uppercase font-semibold tracking-tight bg-muted text-muted-foreground"
                    title={cell.assessment_source === "manual" ? "Teacher rubric scored" : "AI CV/CNN evaluated"}
                  >
                    {cell.assessment_source === "manual" ? "T" : "AI"}
                  </span>
                </div>
              ) : statusLabel === "Awaiting scan" ? (
                <span className="text-xs text-muted-foreground italic flex items-center gap-1">
                  <span className="size-1 rounded-full bg-muted-foreground/60" />
                  Awaiting scan
                </span>
              ) : (
                <span className="text-xs text-muted-foreground italic">No assessment</span>
              )}

              {cell.late && (
                <span className="inline-flex items-center px-1 rounded text-xs font-medium bg-amber-500/15 text-amber-800 dark:text-amber-300">
                  Late
                </span>
              )}

              {hasUnreadComments && (
                <span
                  className="size-2 rounded-full bg-primary shrink-0"
                  title="Unread parent/teacher comments"
                  aria-label="Unread comments"
                />
              )}
            </div>

            <div
              className={cn(
                "flex items-center gap-0.5 transition-opacity shrink-0",
                isTouchDevice
                  ? "opacity-90"
                  : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
              )}
            >
              {canEditScore && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    startEditing();
                  }}
                  aria-label={`Edit score for ${label ?? "student"}`}
                  className="text-muted-foreground hover:text-foreground hover:bg-background/80 flex size-6 items-center justify-center rounded-sm transition-colors"
                >
                  <Pencil className="size-3" aria-hidden="true" />
                </button>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpen();
                }}
                aria-label={`Inspect details for ${label ?? "student"}`}
                className="text-muted-foreground hover:text-foreground hover:bg-background/80 flex size-6 items-center justify-center rounded-sm transition-colors"
              >
                <SlidersHorizontal className="size-3" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div
            className="flex items-center gap-1 pt-0.5"
            title="WriteWise 5 Criteria: Formation, Size, Spacing, Slant, Baseline"
          >
            {[
              { label: "F", name: "Formation" },
              { label: "S", name: "Size" },
              { label: "Sp", name: "Spacing" },
              { label: "Sl", name: "Slant" },
              { label: "B", name: "Baseline" },
            ].map((crit) => (
              <span
                key={crit.label}
                title={`${crit.name} criterion`}
                className={cn(
                  "inline-flex items-center justify-center px-1 py-0.5 rounded-xs text-xs font-mono font-medium",
                  cell.assessment_composite !== null
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground/60"
                )}
              >
                {crit.label}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-1.5 min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="block text-sm font-semibold tabular-nums text-foreground truncate">
                {cell.coursework_status === "Excused" ? (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground">
                    Excused
                  </span>
                ) : cell.points_possible === null ? (
                  <span className="text-xs text-muted-foreground font-normal">Diagnostic</span>
                ) : cell.final_points === null ? (
                  <span className="text-xs text-muted-foreground font-medium italic">No grade</span>
                ) : (
                  <>
                    {cell.final_points}{" "}
                    <span className="text-xs font-normal text-muted-foreground">
                      / {cell.points_possible}
                    </span>
                  </>
                )}
              </span>

              {cell.late && (
                <span className="inline-flex items-center px-1 rounded text-xs font-medium bg-amber-500/15 text-amber-800 dark:text-amber-300">
                  Late
                </span>
              )}

              {hasUnreadComments && (
                <span
                  className="size-2 rounded-full bg-primary shrink-0"
                  title="Unread parent/teacher comments"
                  aria-label="Unread comments"
                />
              )}
            </div>

            <div
              className={cn(
                "flex items-center gap-0.5 transition-opacity shrink-0",
                isTouchDevice
                  ? "opacity-90"
                  : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
              )}
            >
              {canEditScore && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    startEditing();
                  }}
                  aria-label={`Edit score for ${label ?? "student"}`}
                  className="text-muted-foreground hover:text-foreground hover:bg-background/80 flex size-6 items-center justify-center rounded-sm transition-colors"
                >
                  <Pencil className="size-3" aria-hidden="true" />
                </button>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpen();
                }}
                aria-label={`Inspect details for ${label ?? "student"}`}
                className="text-muted-foreground hover:text-foreground hover:bg-background/80 flex size-6 items-center justify-center rounded-sm transition-colors"
              >
                <SlidersHorizontal className="size-3" aria-hidden="true" />
              </button>
            </div>
          </div>

          {statusLabel === "Awaiting scan" && (
            <span className="text-muted-foreground flex items-center gap-1 text-xs">
              <span className="size-1 rounded-full bg-muted-foreground/60" />
              <span>Awaiting scan</span>
            </span>
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-1.5 mt-auto pt-1 border-t border-border/40">
        <div className="shrink-0">
          {viewMode === "diagnostic" ? (
            <span className="text-xs text-muted-foreground tabular-nums">
              {cell.final_points !== null ? `${cell.final_points}/${cell.points_possible} pts` : "No pts"}
            </span>
          ) : cell.assessment_composite !== null ? (
            <BandBadge score={Number(cell.assessment_composite)} size="sm" />
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </div>

        <div className="text-right truncate">
          {cell.points_possible !== null && cell.coursework_status !== "Excused" ? (
            cell.publication === "released" ? (
              <span
                className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400"
                title="Shared with parents"
              >
                <Check className="size-3 shrink-0" aria-hidden="true" />
                <span>Shared{cell.points_override !== null ? " (Ov)" : ""}</span>
              </span>
            ) : (
              <span
                className="inline-flex items-center gap-1 text-xs text-muted-foreground"
                title="Draft (not visible to parents yet)"
              >
                <span className="size-1.5 rounded-full bg-amber-500/80 shrink-0" />
                <span>Draft{cell.points_override !== null ? " · Ov" : ""}</span>
              </span>
            )
          ) : null}
        </div>
      </div>
    </div>
  );
}
