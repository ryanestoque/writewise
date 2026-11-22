"use client";

import {
  useState,
  useRef,
  useEffect,
  useId,
  useSyncExternalStore,
  createContext,
  useContext,
  memo,
  type KeyboardEvent,
} from "react";
import { Pencil, SlidersHorizontal, Check, X, Loader2, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import type { GradebookCell } from "@/lib/hooks/use-gradebook";
import { BandBadge } from "@/components/shared/band-badge";
import { getBandFromScore, PARENT_BAND_EXPLANATIONS } from "@/lib/utils/scoring";
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

export function useIsTouchDevice() {
  return useSyncExternalStore(subscribeTouchDevice, getTouchSnapshot, getServerSnapshot);
}

export const TouchDeviceContext = createContext<boolean>(false);

export const CRITERIA_DEFINITIONS = [
  {
    key: "formation",
    label: "F",
    name: "Letter Formation",
    description: "Letter shape fidelity, ascender loops, and cursive connectors",
  },
  {
    key: "size",
    label: "S",
    name: "Size Consistency",
    description: "Proportionality between ascender, midline, and descender zones",
  },
  {
    key: "spacing",
    label: "Sp",
    name: "Spacing Rhythm",
    description: "Uniformity of inter-word and inter-letter cursive rhythm",
  },
  {
    key: "slant",
    label: "Sl",
    name: "Slant Regularity",
    description: "Consistent forward inclination angle (~13° target)",
  },
  {
    key: "baseline",
    label: "B",
    name: "Baseline Alignment",
    description: "Consistent resting on writing guideline with minimal drift",
  },
] as const;

export const GradebookCellButton = memo(function GradebookCellButton({
  cell,
  onOpen,
  row,
  column,
  label,
  hasUnreadComments = false,
  onSaveScore,
  onNavigateDown,
  viewMode = "points",
  isFocused = false,
  onFocusCell,
  isTouchDevice: propIsTouchDevice,
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
  isFocused?: boolean;
  onFocusCell?: () => void;
  isTouchDevice?: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [inputVal, setInputVal] = useState("");
  const [error, setError] = useState<string | null>(null);
  const contextTouch = useContext(TouchDeviceContext);
  const isTouchDevice = propIsTouchDevice ?? contextTouch;
  const inputRef = useRef<HTMLInputElement>(null);
  const cellRef = useRef<HTMLDivElement>(null);
  const cellId = useId();

  const initialVal =
    cell.points_override !== null
      ? String(cell.points_override)
      : cell.final_points !== null
        ? String(cell.final_points)
        : "";

  function startEditing(initialChar?: string) {
    setInputVal(initialChar ?? initialVal);
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
    return (
      <div
        data-gradecell
        data-row={row}
        data-column={column}
        tabIndex={isFocused ? 0 : -1}
        onFocus={onFocusCell}
        className="text-muted-foreground block p-2 text-xs select-none min-h-[5rem]"
      >
        Not assigned
      </div>
    );
  }

  const canEditScore =
    cell.points_possible !== null &&
    cell.coursework_status !== "Excused" &&
    typeof onSaveScore === "function";

  const statusLabel = formatStatus(cell.coursework_status);
  const compositeNum = cell.assessment_composite !== null ? Number(cell.assessment_composite) : null;
  const compositeBand = compositeNum !== null ? getBandFromScore(compositeNum) : null;
  const developmentalNote =
    compositeBand !== null
      ? PARENT_BAND_EXPLANATIONS[compositeBand]
      : statusLabel === "Awaiting scan"
        ? "Awaiting worksheet upload"
        : "No assessment recorded";

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
      toast.success(
        trimmed === ""
          ? `Cleared score for ${label ?? "student"}`
          : `Saved score (${trimmed} pts) for ${label ?? "student"}`
      );
      if (typeof row === "number" && typeof column === "number" && onNavigateDown) {
        onNavigateDown(row, column);
      }
    } catch {
      setError("Failed to save");
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
      cellRef.current?.focus();
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
    } else if (canEditScore && /^[0-9]$/.test(e.key)) {
      e.preventDefault();
      startEditing(e.key);
    }
  }

  if (isEditing) {
    return (
      <div
        ref={cellRef}
        className="bg-card ring-2 ring-primary relative min-h-[5rem] w-full rounded-sm p-2"
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
            aria-describedby={error ? `${cellId}-error` : `${cellId}-hint`}
          />
          <span className="text-muted-foreground text-xs font-normal">/ {cell.points_possible}</span>
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              disabled={isSaving}
              onClick={() => void handleCommit()}
              aria-label="Save score"
              className="text-primary hover:bg-muted relative after:absolute after:-inset-1.5 inline-flex size-7 items-center justify-center rounded-sm transition-colors cursor-pointer"
            >
              {isSaving ? (
                <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" />
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
                setError(null);
                cellRef.current?.focus();
              }}
              aria-label="Cancel editing"
              className="text-muted-foreground hover:bg-muted relative after:absolute after:-inset-1.5 inline-flex size-7 items-center justify-center rounded-sm transition-colors cursor-pointer"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </div>
        {error ? (
          <span id={`${cellId}-error`} role="alert" className="text-destructive mt-1 block text-xs">
            {error}
          </span>
        ) : (
          <span id={`${cellId}-hint`} className="text-muted-foreground mt-1 block text-xs">
            Enter to save & advance ↓
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      ref={cellRef}
      tabIndex={isFocused ? 0 : -1}
      data-gradecell
      data-row={row}
      data-column={column}
      aria-label={`${label ?? "Work grade"}: ${statusLabel}, ${
        cell.final_points === null
          ? "no point grade"
          : `${cell.final_points} of ${cell.points_possible} points`
      }, ${
        cell.assessment_composite !== null
          ? `composite score ${Math.round(Number(cell.assessment_composite))}%`
          : "no assessment"
      }, ${
        cell.points_possible === null
          ? "bands only"
          : cell.publication === "released"
            ? "released to parents"
            : "draft"
      }${hasUnreadComments ? ", unread comments" : ""}. Click or Space to inspect, Enter to edit score.`}
      onClick={() => {
        onFocusCell?.();
        onOpen();
      }}
      onFocus={() => {
        onFocusCell?.();
      }}
      onKeyDown={handleCellKeyDown}
      className={cn(
        "group hover:bg-muted/70 hover:border-border/60 relative flex min-h-[5rem] w-full flex-col justify-between rounded-sm border p-2 text-left transition-colors cursor-pointer focus-visible:outline-none",
        isFocused
          ? "border-primary/60 ring-2 ring-primary/40 bg-muted/40"
          : "border-transparent"
      )}
    >
      {viewMode === "diagnostic" ? (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-1.5 min-w-0">
            <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
              {cell.assessment_composite !== null ? (
                <div className="flex items-center gap-1 min-w-0">
                  <BandBadge score={Number(cell.assessment_composite)} size="sm" />
                  <span className="text-xs font-semibold tabular-nums text-foreground">
                    {Math.round(Number(cell.assessment_composite))}%
                  </span>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium tracking-tight bg-muted text-foreground border border-border/50">
                    {cell.assessment_source === "manual" ? "Teacher rubric" : "Calibrated"}
                  </span>
                </div>
              ) : statusLabel === "Awaiting scan" ? (
                <span className="text-xs text-muted-foreground italic flex items-center gap-1">
                  <span className="size-1.5 rounded-full bg-muted-foreground/60 shrink-0" />
                  Awaiting scan
                </span>
              ) : (
                <span className="text-xs text-muted-foreground italic">No assessment</span>
              )}

              {cell.late && (
                <span className="inline-flex items-center px-1 rounded text-xs font-medium bg-band-2/15 text-band-2-text border border-band-2/30">
                  Late
                </span>
              )}

              {hasUnreadComments && (
                <span
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-primary shrink-0"
                  title="Unread parent/teacher comments"
                >
                  <MessageSquare className="size-3" aria-hidden="true" />
                  <span>Unread</span>
                </span>
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
                  className="text-muted-foreground hover:text-foreground hover:bg-background/80 relative after:absolute after:-inset-1.5 flex size-6 items-center justify-center rounded-sm transition-colors cursor-pointer"
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
                className="text-muted-foreground hover:text-foreground hover:bg-background/80 relative after:absolute after:-inset-1.5 flex size-6 items-center justify-center rounded-sm transition-colors cursor-pointer"
              >
                <SlidersHorizontal className="size-3" aria-hidden="true" />
              </button>
            </div>
          </div>

          <p
            className="text-[11px] leading-tight text-muted-foreground line-clamp-2"
            title={developmentalNote}
          >
            {developmentalNote}
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-1.5 min-w-0">
            <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
              <span className="block text-sm font-semibold tabular-nums text-foreground truncate">
                {cell.coursework_status === "Excused" ? (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground">
                    Excused
                  </span>
                ) : cell.points_possible === null ? (
                  <span className="text-xs text-muted-foreground font-normal">Bands only</span>
                ) : cell.final_points === null ? (
                  <>
                    <span className="text-muted-foreground font-semibold">—</span>{" "}
                    <span className="text-xs font-normal text-muted-foreground">
                      / {cell.points_possible}
                    </span>
                  </>
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
                <span className="inline-flex items-center px-1 rounded text-xs font-medium bg-band-2/15 text-band-2-text border border-band-2/30">
                  Late
                </span>
              )}

              {hasUnreadComments && (
                <span
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-primary shrink-0"
                  title="Unread parent/teacher comments"
                >
                  <MessageSquare className="size-3" aria-hidden="true" />
                  <span>Unread</span>
                </span>
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
                  className="text-muted-foreground hover:text-foreground hover:bg-background/80 relative after:absolute after:-inset-1.5 flex size-6 items-center justify-center rounded-sm transition-colors cursor-pointer"
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
                className="text-muted-foreground hover:text-foreground hover:bg-background/80 relative after:absolute after:-inset-1.5 flex size-6 items-center justify-center rounded-sm transition-colors cursor-pointer"
              >
                <SlidersHorizontal className="size-3" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            {statusLabel === "Awaiting scan" ? (
              <span className="flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-muted-foreground/60 shrink-0" />
                <span>Awaiting scan</span>
              </span>
            ) : statusLabel === "Returned" ? (
              <span className="font-medium text-muted-foreground">Returned for revision</span>
            ) : statusLabel === "Turned in" ? (
              <span className="font-medium text-primary">Turned in</span>
            ) : cell.coursework_status !== "Excused" ? (
              <span className="text-muted-foreground/80">{statusLabel}</span>
            ) : null}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-1.5 mt-auto pt-1 border-t border-border/40">
        <div className="shrink-0">
          {viewMode === "diagnostic" ? (
            <span className="text-xs text-muted-foreground tabular-nums">
              {cell.points_possible === null
                ? "Bands only"
                : cell.final_points !== null
                  ? `${cell.final_points}/${cell.points_possible} pts`
                  : "No pts"}
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
                className="inline-flex items-center gap-1 text-xs font-medium text-band-4-text"
                title="Released to parent portal"
              >
                <Check className="size-3 shrink-0" aria-hidden="true" />
                <span>Released{cell.points_override !== null ? " (Overridden)" : ""}</span>
              </span>
            ) : (
              <span
                className="inline-flex items-center gap-1 text-xs text-muted-foreground"
                title="Draft (not visible to parents yet)"
              >
                <span className="size-1.5 rounded-full bg-band-2 shrink-0" />
                <span>Draft{cell.points_override !== null ? " · Overridden" : ""}</span>
              </span>
            )
          ) : null}
        </div>
      </div>
    </div>
  );
});
