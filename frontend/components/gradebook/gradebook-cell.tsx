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
import { Pencil, SlidersHorizontal, Check, X } from "lucide-react";
import { toast } from "@/components/ui/toast";
import type { GradebookCell } from "@/lib/hooks/use-gradebook";
import { BandBadge } from "@/components/shared/band-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
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
  const cellRef = useRef<HTMLButtonElement>(null);
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
        role="group"
        aria-label={`${label ? `${label}: ` : ""}Not assigned`}
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
      toast.add({
        type: "success",
        title:
          trimmed === ""
            ? `Cleared score for ${label ?? "student"}`
            : `Saved score (${trimmed} pts) for ${label ?? "student"}`,
      });
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
      requestAnimationFrame(() => cellRef.current?.focus());
    }
  }

  function handleCellKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
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
        className="bg-card ring-2 ring-primary relative min-h-[5rem] w-full rounded-sm p-2"
        data-gradecell-active
      >
        <Field
          data-invalid={Boolean(error) || undefined}
          data-disabled={isSaving || undefined}
          className="gap-1"
        >
          <div className="flex items-center gap-1.5">
            <Input
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
                "h-8 w-16 rounded-sm px-1.5 text-center text-base sm:text-sm font-semibold tabular-nums",
                error ? "border-destructive text-destructive" : "border-input bg-background"
              )}
              placeholder="—"
              aria-label={`Score for ${label ?? "cell"}`}
              aria-describedby={error ? `${cellId}-error` : `${cellId}-hint`}
              aria-invalid={Boolean(error) || undefined}
            />
            <span className="text-muted-foreground text-xs font-normal">/ {cell.points_possible}</span>
            <div className="ml-auto flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                disabled={isSaving}
                onClick={() => void handleCommit()}
                aria-label="Save score"
                className="text-primary relative after:absolute after:-inset-2 md:after:-inset-1.5 size-7 rounded-sm cursor-pointer"
              >
                {isSaving ? <Spinner /> : <Check aria-hidden="true" />}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                disabled={isSaving}
                onClick={() => {
                  setIsEditing(false);
                  setInputVal(initialVal);
                  setError(null);
                  requestAnimationFrame(() => cellRef.current?.focus());
                }}
                aria-label="Cancel editing"
                className="text-muted-foreground relative after:absolute after:-inset-2 md:after:-inset-1.5 size-7 rounded-sm cursor-pointer"
              >
                <X aria-hidden="true" />
              </Button>
            </div>
          </div>
          {error ? (
            <FieldError id={`${cellId}-error`} className="text-xs">
              {error}
            </FieldError>
          ) : (
            <FieldDescription id={`${cellId}-hint`} className="text-xs">
              Enter to save &amp; advance ↓
            </FieldDescription>
          )}
        </Field>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group hover:bg-muted/70 hover:border-border/60 relative min-h-[5rem] w-full rounded-sm border transition-colors",
        isFocused
          ? "border-primary/60 ring-2 ring-primary/40 bg-muted/40"
          : "border-transparent"
      )}
    >
      <Button
        type="button"
        variant="ghost"
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
        className="flex h-auto min-h-[5rem] w-full flex-col items-stretch justify-between rounded-sm p-2 text-left font-normal hover:bg-transparent cursor-pointer focus-visible:outline-none"
      >
        {viewMode === "diagnostic" ? (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-1.5 min-w-0 pr-12">
              <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                {cell.assessment_composite !== null ? (
                  <div className="flex items-center gap-1 min-w-0">
                    <BandBadge score={Number(cell.assessment_composite)} size="sm" />
                    <span className="text-xs font-semibold tabular-nums text-foreground">
                      {Math.round(Number(cell.assessment_composite))}%
                    </span>
                    <Badge
                      variant="outline"
                      className="h-auto px-1.5 py-0.5 rounded text-xs font-medium tracking-tight bg-muted text-foreground border-border/50"
                    >
                      {cell.assessment_source === "manual" ? "Teacher rubric" : "Calibrated"}
                    </Badge>
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
                  <Badge
                    variant="outline"
                    className="h-auto px-1 py-0 rounded text-xs font-medium bg-band-2/15 text-band-2-text border-band-2/30"
                  >
                    Late
                  </Badge>
                )}

                {hasUnreadComments && (
                  <Badge variant="secondary" title="Unread parent/teacher comments">
                    Unread
                  </Badge>
                )}
              </div>
            </div>

            <p
              className="text-xs leading-tight text-muted-foreground line-clamp-2"
              title={developmentalNote}
            >
              {developmentalNote}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-1.5 min-w-0 pr-12">
              <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                <span className="block text-sm font-semibold tabular-nums text-foreground truncate">
                  {cell.coursework_status === "Excused" ? (
                    <Badge
                      variant="secondary"
                      className="h-auto px-1.5 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground"
                    >
                      Excused
                    </Badge>
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
                  <Badge
                    variant="outline"
                    className="h-auto px-1 py-0 rounded text-xs font-medium bg-band-2/15 text-band-2-text border-band-2/30"
                  >
                    Late
                  </Badge>
                )}

                {hasUnreadComments && (
                  <Badge variant="secondary" title="Unread parent/teacher comments">
                    Unread
                  </Badge>
                )}
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

        <div className="mt-auto flex flex-col gap-1 pt-1">
          <Separator className="bg-border/40" />
          <div className="flex items-center justify-between gap-1.5">
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
      </Button>

      <div
        className={cn(
          "pointer-events-auto absolute top-2 right-2 z-10 flex items-center gap-0.5 transition-opacity",
          isTouchDevice
            ? "opacity-90"
            : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
        )}
      >
        {canEditScore && (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            tabIndex={-1}
            onClick={() => startEditing()}
            aria-label={`Edit score for ${label ?? "student"}`}
            className="text-muted-foreground hover:text-foreground hover:bg-background/80 relative after:absolute after:-inset-2.5 md:after:-inset-1.5 size-6 rounded-sm cursor-pointer"
          >
            <Pencil aria-hidden="true" />
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          tabIndex={-1}
          onClick={onOpen}
          aria-label={`Inspect details for ${label ?? "student"}`}
          className="text-muted-foreground hover:text-foreground hover:bg-background/80 relative after:absolute after:-inset-2.5 md:after:-inset-1.5 size-6 rounded-sm cursor-pointer"
        >
          <SlidersHorizontal aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
});
