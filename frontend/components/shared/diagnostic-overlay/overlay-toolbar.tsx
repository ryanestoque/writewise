"use client";

import { memo } from "react";
import type { CriterionFilter, DiagnosticOverlayData } from "./types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  Layers,
  PenTool,
  AlignJustify,
  Compass,
  Ruler,
  Maximize2,
} from "lucide-react";

interface OverlayToolbarProps {
  overlay: DiagnosticOverlayData | null | undefined;
  activeCriterion: CriterionFilter;
  onChangeCriterion: (criterion: CriterionFilter) => void;
  visible: boolean;
  onToggleVisible: (visible: boolean) => void;
  className?: string;
}

interface FilterItem {
  id: CriterionFilter;
  label: string;
  icon: typeof Layers;
  getAttentionCount: (overlay: DiagnosticOverlayData) => number;
}

const FILTERS: FilterItem[] = [
  {
    id: "all",
    label: "All Guides",
    icon: Layers,
    getAttentionCount: (ov) => ov.summary.attention_item_count,
  },
  {
    id: "letter_formation",
    label: "Formation",
    icon: PenTool,
    getAttentionCount: (ov) =>
      ov.letter_formation.annotations.filter((a) => a.severity === "needs_attention")
        .length,
  },
  {
    id: "spacing",
    label: "Spacing",
    icon: AlignJustify,
    getAttentionCount: (ov) =>
      ov.spacing.annotations.filter((a) => a.severity === "needs_attention").length,
  },
  {
    id: "slant",
    label: "Slant",
    icon: Compass,
    getAttentionCount: (ov) =>
      ov.slant.annotations.filter((a) => a.severity === "needs_attention").length,
  },
  {
    id: "baseline_alignment",
    label: "Baseline",
    icon: Ruler,
    getAttentionCount: (ov) =>
      ov.baseline.annotations.filter((a) => a.severity === "needs_attention").length,
  },
  {
    id: "size_consistency",
    label: "Size",
    icon: Maximize2,
    getAttentionCount: (ov) =>
      ov.size.annotations.filter((a) => a.severity === "needs_attention").length,
  },
];

export const OverlayToolbar = memo(function OverlayToolbar({
  overlay,
  activeCriterion,
  onChangeCriterion,
  visible,
  onToggleVisible,
  className,
}: OverlayToolbarProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-2 p-2 rounded-xl bg-muted/40 border border-border/70 backdrop-blur-xs text-xs",
        className
      )}
    >
      {/* 1. Filter Pills */}
      <div
        role="group"
        aria-label="Worksheet diagnostic criteria filters"
        className="flex flex-wrap items-center gap-1"
      >
        {FILTERS.map((item) => {
          const Icon = item.icon;
          const isSelected = activeCriterion === item.id;
          const count = overlay ? item.getAttentionCount(overlay) : 0;

          return (
            <Button
              key={item.id}
              type="button"
              variant={isSelected ? "default" : "ghost"}
              size="sm"
              disabled={!visible}
              onClick={() => onChangeCriterion(item.id)}
              aria-pressed={isSelected}
              className={cn(
                "h-10 sm:h-8 min-h-[40px] sm:min-h-[32px] px-3 sm:px-2 text-xs sm:text-[11px] font-medium rounded-lg gap-1.5 transition-all cursor-pointer",
                isSelected
                  ? "bg-brand-600 hover:bg-brand-700 text-white shadow-2xs"
                  : "hover:bg-muted text-muted-foreground hover:text-foreground",
                !visible && "opacity-50 cursor-not-allowed"
              )}
            >
              <Icon className="size-3" aria-hidden="true" />
              <span>{item.label}</span>
              {count > 0 && (
                <Badge
                  variant="secondary"
                  className={cn(
                    "px-1.5 py-0 h-4 text-[10px] font-bold rounded-full",
                    isSelected
                      ? "bg-white/20 text-white"
                      : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200"
                  )}
                >
                  {count}
                </Badge>
              )}
            </Button>
          );
        })}
      </div>

      {/* 2. Master Visibility Toggle */}
      <div className="flex items-center gap-2 pl-2 border-l border-border/60 ml-auto">
        <Switch
          id="toggle-diagnostic-overlay"
          checked={visible}
          onCheckedChange={onToggleVisible}
          className="cursor-pointer scale-90 sm:scale-75"
        />
        <Label
          htmlFor="toggle-diagnostic-overlay"
          className="text-xs sm:text-[11px] font-medium text-muted-foreground cursor-pointer select-none"
        >
          {visible ? "Overlay on" : "Overlay off"}
        </Label>
      </div>
    </div>
  );
});
