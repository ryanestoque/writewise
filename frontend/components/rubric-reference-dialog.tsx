"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  SparklesIcon,
  CompassIcon,
  SpaceIcon,
  MoveVerticalIcon,
  ScalingIcon,
  CpuIcon,
  EyeIcon,
  CheckCircle2Icon,
} from "lucide-react";

interface RubricReferenceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const criteria = [
  {
    id: "formation",
    name: "Letter Formation",
    engine: "CNN",
    engineType: "neural",
    icon: SparklesIcon,
    target: "Clear loops, proper cursive joins, legible character structure",
    description:
      "Assesses the stroke geometry, loop closure, and characteristic cursive joinery of individual characters against the CCC cursive benchmark dataset.",
    diagnosticFocus:
      "Identifies malformed loops, disconnected joins, ambiguous letterforms, and irregular stroke transitions.",
  },
  {
    id: "slant",
    name: "Slant Angle",
    engine: "OpenCV",
    engineType: "cv",
    icon: CompassIcon,
    target: "60° – 75° consistent rightward inclination",
    description:
      "Measures the dominant stroke orientation across all ascending and descending letters using contour angle detection and line fitting.",
    diagnosticFocus:
      "Highlights erratic tilt fluctuations, vertical rigidity (<60°), or excessive over-slanting (>80°).",
  },
  {
    id: "spacing",
    name: "Spacing & Rhythm",
    engine: "OpenCV",
    engineType: "cv",
    icon: SpaceIcon,
    target: "Uniform letter gaps & ~1 letter width between words",
    description:
      "Analyzes horizontal connected component distances, intra-word letter rhythm, and inter-word margin consistency.",
    diagnosticFocus:
      "Detects cramped letter joins, irregular word gaps, or disjointed stroke gaps within words.",
  },
  {
    id: "baseline",
    name: "Baseline Alignment",
    engine: "OpenCV",
    engineType: "cv",
    icon: MoveVerticalIcon,
    target: "±2px deviation from writing guideline",
    description:
      "Detects physical worksheet guidelines and measures vertical baseline variance across each written word and sentence.",
    diagnosticFocus:
      "Flags undulating words, sagging letters, or floating text drifting off the bottom guide line.",
  },
  {
    id: "size",
    name: "Size Consistency",
    engine: "OpenCV",
    engineType: "cv",
    icon: ScalingIcon,
    target: "2:1 ratio for ascenders/descenders vs. x-height",
    description:
      "Calculates the ratio of lowercase body height (x-height) to ascender and descender heights across consecutive words.",
    diagnosticFocus:
      "Flags disproportionate lowercase letters, stunted ascender loops, or uneven line scale.",
  },
];

const scoringBands = [
  {
    band: "Advanced (90–100%)",
    color: "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800",
    desc: "Exemplary cursive discipline with fluid joins, uniform slant, and consistent baseline adherence.",
  },
  {
    band: "Proficient (75–89%)",
    color: "text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800",
    desc: "Strong cursive legibility with minor spacing or slant variations on complex letter joins.",
  },
  {
    band: "Developing (60–74%)",
    color: "text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800",
    desc: "Recognizable cursive structure with noticeable letterform irregularities or fluctuating baseline.",
  },
  {
    band: "Beginning (<60%)",
    color: "text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800",
    desc: "Frequent print-cursive hybrid letters, erratic slant angles, or significant baseline drift.",
  },
];

export function RubricReferenceDialog({
  open,
  onOpenChange,
}: RubricReferenceDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] p-0 overflow-hidden flex flex-col">
        <DialogHeader className="p-6 pb-4 border-b">
          <div>
            <DialogTitle className="text-lg">
              Handwriting Assessment Rubric Guide
            </DialogTitle>
            <DialogDescription className="mt-1 text-xs">
              WriteWise diagnostic criteria based on OpenCV computer vision & fine-tuned CNN inference.
            </DialogDescription>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 p-6 space-y-6 overflow-y-auto">
          {/* Section 1: The 5 Criteria */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              5 Diagnostic Assessment Criteria
            </h3>
            <div className="grid gap-3">
              {criteria.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-xl border bg-card/60 hover:bg-card transition-colors space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="size-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                          <Icon className="size-4" />
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-foreground">
                            {item.name}
                          </h4>
                          <p className="text-xs text-muted-foreground font-mono">
                            Target: {item.target}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant="secondary"
                        className="text-[10px] h-5 px-2 gap-1 shrink-0 font-medium"
                      >
                        {item.engineType === "neural" ? (
                          <CpuIcon className="size-3" />
                        ) : (
                          <EyeIcon className="size-3" />
                        )}
                        {item.engine}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {item.description}
                    </p>
                    <div className="flex items-start gap-1.5 text-[11px] text-muted-foreground/90 bg-muted/50 p-2 rounded-lg">
                      <CheckCircle2Icon className="size-3.5 text-primary shrink-0 mt-0.5" />
                      <span>{item.diagnosticFocus}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 2: Qualitative Bands */}
          <div className="pt-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Qualitative Scoring Bands
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {scoringBands.map((band) => (
                <div
                  key={band.band}
                  className={`p-3 rounded-xl border text-xs space-y-1 ${band.color}`}
                >
                  <p className="font-semibold text-xs">{band.band}</p>
                  <p className="opacity-90 leading-normal">{band.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
