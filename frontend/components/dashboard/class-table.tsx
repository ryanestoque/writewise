"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { buttonVariants } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { FilterPills, type FilterPillItem } from "@/components/ui/filter-pills";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Users,
  SearchX,
  ChevronRight,
} from "lucide-react";
import type { StudentScoreSummary } from "@/lib/hooks/use-dashboard";
import { BandBadge } from "@/components/shared/band-badge";
import { getBandMeta } from "@/lib/utils/scoring";
import { cn } from "@/lib/utils";

export type SortField =
  | "fullName"
  | "section"
  | "letter_formation"
  | "size_consistency"
  | "spacing"
  | "slant"
  | "baseline_alignment"
  | "composite";

export type SortDirection = "asc" | "desc";

interface ClassTableProps {
  students?: StudentScoreSummary[];
  isLoading?: boolean;
  onSelectStudent: (student: StudentScoreSummary) => void;
  className?: string;
}

function getInitials(name: string) {
  if (!name) return "";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const AVATAR_PALETTES = [
  "bg-amber-100 text-amber-900 border-amber-300/70 dark:bg-amber-950/80 dark:text-amber-200 dark:border-amber-800",
  "bg-emerald-100 text-emerald-900 border-emerald-300/70 dark:bg-emerald-950/80 dark:text-emerald-200 dark:border-emerald-800",
  "bg-blue-100 text-blue-900 border-blue-300/70 dark:bg-blue-950/80 dark:text-blue-200 dark:border-blue-800",
  "bg-purple-100 text-purple-900 border-purple-300/70 dark:bg-purple-950/80 dark:text-purple-200 dark:border-purple-800",
  "bg-brand-100 text-brand-900 border-brand-300/70 dark:bg-brand-950/80 dark:text-brand-200 dark:border-brand-800",
  "bg-rose-100 text-rose-900 border-rose-300/70 dark:bg-rose-950/80 dark:text-rose-200 dark:border-rose-800",
];

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_PALETTES.length;
  return AVATAR_PALETTES[index];
}

export type BandFilter = "all" | "intervention" | "satisfactory" | "excellent" | "unrated";

const COLUMNS: Array<{
  field: SortField;
  label: string;
  shortLabel: string;
  isNumeric?: boolean;
  description?: string;
}> = [
  {
    field: "fullName",
    label: "Student Name",
    shortLabel: "Student",
    description: "Student full name and assigned section",
  },
  {
    field: "section",
    label: "Section",
    shortLabel: "Section",
    description: "Grade 3 class section roster",
  },
  {
    field: "letter_formation",
    label: "Letter Formation",
    shortLabel: "Letter Form.",
    isNumeric: true,
    description: "Proper cursive loops and complete stroke closures (target 100%)",
  },
  {
    field: "size_consistency",
    label: "Size Consistency",
    shortLabel: "Size Cons.",
    isNumeric: true,
    description: "Proportion and height across 3-line penmanship ruling",
  },
  {
    field: "spacing",
    label: "Spacing Regularity",
    shortLabel: "Spacing",
    isNumeric: true,
    description: "Inter-word rhythm and character separation spacing",
  },
  {
    field: "slant",
    label: "Slant Angle",
    shortLabel: "Slant",
    isNumeric: true,
    description: "Uniform forward slant tilt (target 60°–68° angle)",
  },
  {
    field: "baseline_alignment",
    label: "Baseline Alignment",
    shortLabel: "Baseline",
    isNumeric: true,
    description: "Letters resting stably along bottom ruling baseline",
  },
  {
    field: "composite",
    label: "Overall Composite",
    shortLabel: "Overall",
    isNumeric: true,
    description: "Equal-weighted average across all 5 diagnostic criteria",
  },
];

export function ClassTable({
  students = [],
  isLoading = false,
  onSelectStudent,
  className,
}: ClassTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSection, setSelectedSection] = useState<string>("all");
  const [selectedBand, setSelectedBand] = useState<BandFilter>("all");
  const [sortField, setSortField] = useState<SortField>("composite");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Global keyboard shortcut: press '/' or 'Cmd/Ctrl+K' to focus search input
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable ||
          target.tagName === "SELECT");

      if (
        !isInput &&
        (e.key === "/" ||
          ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k"))
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  // Available sections for FilterPills
  const sections = useMemo(() => {
    const set = new Set<string>();
    students.forEach((s) => {
      if (s.section) set.add(s.section);
    });
    return Array.from(set).sort();
  }, [students]);

  const sectionPills: FilterPillItem[] = useMemo(() => {
    return [
      { id: "all", label: "All Sections", count: students.length },
      ...sections.map((sec) => ({
        id: sec,
        label: sec,
        count: students.filter((s) => s.section === sec).length,
      })),
    ];
  }, [sections, students]);

  // Band / Performance tier counts for FilterPills
  const bandPills: FilterPillItem[] = useMemo(() => {
    const counts = {
      all: students.length,
      intervention: 0,
      satisfactory: 0,
      excellent: 0,
      unrated: 0,
    };

    students.forEach((s) => {
      const score = s.scores.composite;
      if (score === null || score === undefined) {
        counts.unrated++;
      } else if (score < 50) {
        counts.intervention++;
      } else if (score < 75) {
        counts.satisfactory++;
      } else {
        counts.excellent++;
      }
    });

    return [
      { id: "all", label: "All Tiers", count: counts.all },
      { id: "intervention", label: "Needs Support (<50%)", count: counts.intervention },
      { id: "satisfactory", label: "Satisfactory (50–74%)", count: counts.satisfactory },
      { id: "excellent", label: "Proficient (≥75%)", count: counts.excellent },
      { id: "unrated", label: "Unrated", count: counts.unrated },
    ];
  }, [students]);

  // Filtering & Sorting
  const filteredAndSortedStudents = useMemo(() => {
    return students
      .filter((student) => {
        const matchesSearch =
          searchQuery === "" ||
          student.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          student.section.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesSection =
          selectedSection === "all" || student.section === selectedSection;

        const score = student.scores.composite;
        let matchesBand = true;
        if (selectedBand === "unrated") {
          matchesBand = score === null || score === undefined;
        } else if (selectedBand === "intervention") {
          matchesBand = score !== null && score !== undefined && score < 50;
        } else if (selectedBand === "satisfactory") {
          matchesBand = score !== null && score !== undefined && score >= 50 && score < 75;
        } else if (selectedBand === "excellent") {
          matchesBand = score !== null && score !== undefined && score >= 75;
        }

        return matchesSearch && matchesSection && matchesBand;
      })
      .sort((a, b) => {
        let valA: string | number | null = null;
        let valB: string | number | null = null;

        if (sortField === "fullName") {
          valA = a.fullName.toLowerCase();
          valB = b.fullName.toLowerCase();
        } else if (sortField === "section") {
          valA = a.section.toLowerCase();
          valB = b.section.toLowerCase();
        } else if (sortField === "composite") {
          valA = a.scores.composite;
          valB = b.scores.composite;
        } else {
          valA = a.scores[sortField];
          valB = b.scores[sortField];
        }

        // Handle nulls: unrated always placed at bottom regardless of direction
        if (valA === null && valB === null) return 0;
        if (valA === null) return 1;
        if (valB === null) return -1;

        if (typeof valA === "string" && typeof valB === "string") {
          return sortDirection === "asc"
            ? valA.localeCompare(valB)
            : valB.localeCompare(valA);
        }

        const numA = Number(valA);
        const numB = Number(valB);
        return sortDirection === "asc" ? numA - numB : numB - numA;
      });
  }, [students, searchQuery, selectedSection, selectedBand, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      // Default to ascending for criterion scores so weakest students float to the top
      setSortDirection("asc");
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="size-3.5 text-muted-foreground/40 ml-1 shrink-0" />;
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="size-3.5 text-brand-600 dark:text-brand-400 ml-1 shrink-0" />
    ) : (
      <ArrowDown className="size-3.5 text-brand-600 dark:text-brand-400 ml-1 shrink-0" />
    );
  };

  if (!isLoading && students.length === 0) {
    return (
      <div className="p-8 rounded-xl border border-border bg-card shadow-warm">
        <Empty>
          <EmptyMedia>
            <div className="p-3 bg-brand-100 text-brand-700 dark:bg-brand-950 dark:text-brand-300 rounded-full">
              <Users className="size-8" />
            </div>
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle>No Students on Roster</EmptyTitle>
            <EmptyDescription>
              Add your students to start assigning activities and tracking handwriting diagnostics.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Link
              href="/roster"
              className={cn(
                buttonVariants({ variant: "default" }),
                "bg-primary hover:bg-brand-700 text-primary-foreground font-semibold rounded-xl"
              )}
            >
              <Users className="size-4 mr-2" /> Go to Class Roster
            </Link>
          </EmptyContent>
        </Empty>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3.5", className)}>
      {/* Search and Filter Controls */}
      <div className="space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="w-full sm:w-72">
            <SearchInput
              ref={searchInputRef}
              placeholder="Search student or section..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onClear={() => setSearchQuery("")}
              className="w-full"
            />
          </div>

          {sections.length > 1 && (
            <div className="overflow-x-auto pb-1 sm:pb-0">
              <FilterPills
                items={sectionPills}
                value={selectedSection}
                onChange={setSelectedSection}
              />
            </div>
          )}
        </div>

        {/* Diagnostic Performance Tier Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="text-[11px] font-semibold text-muted-foreground shrink-0 uppercase tracking-wider hidden sm:inline">
            Tier:
          </span>
          <FilterPills
            items={bandPills}
            value={selectedBand}
            onChange={(val) => setSelectedBand(val as BandFilter)}
          />
        </div>
      </div>

      {/* Main Table (Desktop & Tablet) */}
      <div className="relative rounded-xl border border-border bg-card shadow-warm overflow-hidden">
        {/* Mobile horizontal scroll hint gradient */}
        <div
          className="pointer-events-none absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-card/80 to-transparent sm:hidden z-10"
          aria-hidden="true"
        />

        <div className="overflow-x-auto">
          <TooltipProvider delay={200}>
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow className="hover:bg-transparent border-b border-border/80">
                  {COLUMNS.map((col) => (
                    <TableHead
                      key={col.field}
                      scope="col"
                      aria-sort={
                        sortField === col.field
                          ? sortDirection === "asc"
                            ? "ascending"
                            : "descending"
                          : "none"
                      }
                      onClick={() => handleSort(col.field)}
                      className={cn(
                        "text-xs font-semibold text-foreground py-3 cursor-pointer select-none transition-colors hover:text-brand-700 dark:hover:text-brand-300",
                        col.isNumeric ? "text-right" : "text-left"
                      )}
                    >
                      <Tooltip>
                        <TooltipTrigger
                          className={cn(
                            "inline-flex items-center gap-0.5 cursor-pointer bg-transparent border-0 p-0 text-inherit font-inherit",
                            col.isNumeric ? "justify-end" : "justify-start"
                          )}
                        >
                          <span className="hidden sm:inline">{col.label}</span>
                          <span className="sm:hidden">{col.shortLabel}</span>
                          {getSortIcon(col.field)}
                        </TooltipTrigger>
                        {col.description && (
                          <TooltipContent
                            side="top"
                            className="text-[11px] max-w-[200px] text-center font-normal"
                          >
                            {col.description}
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </TableHead>
                  ))}
                  <TableHead className="w-10 py-3">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>

            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="animate-pulse border-b border-border/50">
                    <TableCell colSpan={9} className="py-4 px-4">
                      <div className="h-6 bg-muted/60 rounded-md w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : filteredAndSortedStudents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-12 text-center">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <SearchX className="size-8 text-muted-foreground/60" />
                      <p className="text-sm font-semibold text-foreground">No students match your filter</p>
                      <p className="text-xs text-muted-foreground">Try clearing your search query or changing selected section.</p>
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery("");
                          setSelectedSection("all");
                          setSelectedBand("all");
                        }}
                        className={cn(
                          buttonVariants({ variant: "outline", size: "sm" }),
                          "mt-2 rounded-lg text-xs cursor-pointer"
                        )}
                      >
                        Reset filters
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredAndSortedStudents.map((student) => {
                  const hasScores = student.scores.composite !== null;

                  return (
                    <TableRow
                      key={student.studentId}
                      onClick={() => onSelectStudent(student)}
                      className="group cursor-pointer hover:bg-muted/30 transition-colors border-b border-border/60 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                      tabIndex={0}
                      role="button"
                      aria-label={`View handwriting drill-down diagnostics for ${student.fullName}`}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onSelectStudent(student);
                        }
                      }}
                    >
                      {/* Student Name */}
                      <TableCell className="py-3 px-4 font-medium">
                        <div className="flex items-center gap-3">
                          <Avatar
                            className={cn(
                              "size-8 border text-xs font-semibold shrink-0",
                              getAvatarColor(student.fullName)
                            )}
                          >
                            <AvatarFallback>{getInitials(student.fullName)}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-foreground group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors truncate">
                              {student.fullName}
                            </p>
                            <p className="text-[11px] text-muted-foreground sm:hidden truncate">
                              {student.section}
                            </p>
                          </div>
                        </div>
                      </TableCell>

                      {/* Section */}
                      <TableCell className="py-3 px-4 text-xs text-muted-foreground">
                        <span className="truncate block max-w-[120px]">{student.section}</span>
                      </TableCell>

                      {/* Letter Formation */}
                      <TableCell className="py-3 px-4 text-right">
                        <ScoreCell score={student.scores.letter_formation} />
                      </TableCell>

                      {/* Size Consistency */}
                      <TableCell className="py-3 px-4 text-right">
                        <ScoreCell score={student.scores.size_consistency} />
                      </TableCell>

                      {/* Spacing */}
                      <TableCell className="py-3 px-4 text-right">
                        <ScoreCell score={student.scores.spacing} />
                      </TableCell>

                      {/* Slant */}
                      <TableCell className="py-3 px-4 text-right">
                        <ScoreCell score={student.scores.slant} />
                      </TableCell>

                      {/* Baseline */}
                      <TableCell className="py-3 px-4 text-right">
                        <ScoreCell score={student.scores.baseline_alignment} />
                      </TableCell>

                      {/* Overall Composite */}
                      <TableCell className="py-3 px-4 text-right">
                        {hasScores ? (
                          <div className="flex items-center justify-end gap-2">
                            <span className="font-heading text-xs font-bold tabular-nums text-foreground">
                              {student.scores.composite?.toFixed(1)}%
                            </span>
                            <BandBadge
                              score={student.scores.composite}
                              size="sm"
                              showDot={false}
                            />
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground/60 italic">Unrated</span>
                        )}
                      </TableCell>

                      {/* Action Chevron */}
                      <TableCell className="py-3 pr-4 pl-0 text-right">
                        <ChevronRight className="size-4 text-muted-foreground/40 group-hover:text-foreground group-hover:translate-x-0.5 transition-all inline-block" />
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          </TooltipProvider>
        </div>

        {/* Table Footer Count */}
        <div className="px-4 py-2.5 bg-muted/20 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Showing <strong className="text-foreground">{filteredAndSortedStudents.length}</strong> of{" "}
            {students.length} students
          </span>
          <span className="hidden sm:inline text-[11px]">
            Click any row to open detailed student diagnostic trends
          </span>
        </div>
      </div>
    </div>
  );
}

function ScoreCell({ score }: { score: number | null | undefined }) {
  if (score === null || score === undefined) {
    return <span className="text-xs text-muted-foreground/50 tabular-nums">—</span>;
  }

  const meta = getBandMeta(
    score >= 75
      ? "excellent"
      : score >= 50
        ? "satisfactory"
        : score >= 25
          ? "developing"
          : "needs_improvement"
  );

  return (
    <div className="inline-flex items-center gap-1.5 justify-end">
      <span className="font-sans text-xs font-medium tabular-nums text-foreground">
        {score.toFixed(1)}%
      </span>
      <span className="sr-only">({meta.label})</span>
      <span
        className={cn("w-2 h-2 rounded-full shrink-0", meta.dotColor)}
        aria-hidden="true"
        title={meta.label}
      />
    </div>
  );
}
