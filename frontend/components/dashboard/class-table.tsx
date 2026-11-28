"use client";

import { useMemo, useRef, useEffect } from "react";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { SearchInput } from "@/components/ui/search-input";
import { FilterPills, type FilterPillItem } from "@/components/ui/filter-pills";
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
import {
  RUBRIC_CRITERIA,
  RUBRIC_BANDS,
  getBandFromScore,
  getBandMeta,
} from "@/lib/utils/scoring";
import { BandBadge } from "@/components/shared/band-badge";
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

export type BandFilter =
  | "all"
  | "needs_improvement"
  | "developing"
  | "satisfactory"
  | "excellent"
  | "unrated";

export interface ClassTableProps {
  students?: StudentScoreSummary[];
  filteredStudents: StudentScoreSummary[];
  isLoading?: boolean;
  onSelectStudent: (student: StudentScoreSummary) => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  selectedSection: string;
  onSectionChange: (value: string) => void;
  selectedBand: BandFilter;
  onBandChange: (value: BandFilter) => void;
  sortField: SortField;
  onSortChange: (field: SortField, direction?: SortDirection) => void;
  sortDirection: SortDirection;
  onClearFilters: () => void;
  className?: string;
}

const EMPTY_STUDENTS: StudentScoreSummary[] = [];

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
    description: "Student full name and section",
  },
  {
    field: "section",
    label: "Section",
    shortLabel: "Section",
    description: "Class section",
  },
  {
    field: "letter_formation",
    label: "Letter Formation",
    shortLabel: "Letter Form.",
    isNumeric: true,
    description: "Cursive loops and stroke closures",
  },
  {
    field: "size_consistency",
    label: "Size Consistency",
    shortLabel: "Size Cons.",
    isNumeric: true,
    description: "Letter heights on 3-line ruling",
  },
  {
    field: "spacing",
    label: "Spacing",
    shortLabel: "Spacing",
    isNumeric: true,
    description: "Inter-word and letter spacing",
  },
  {
    field: "slant",
    label: "Slant Angle",
    shortLabel: "Slant",
    isNumeric: true,
    description: "Forward slant consistency and parallel tilt",
  },
  {
    field: "baseline_alignment",
    label: "Baseline Alignment",
    shortLabel: "Baseline",
    isNumeric: true,
    description: "Alignment along the baseline ruling",
  },
  {
    field: "composite",
    label: "Overall Score",
    shortLabel: "Overall",
    isNumeric: true,
    description: "Average across all 5 criteria",
  },
];

export function ClassTable({
  students = EMPTY_STUDENTS,
  filteredStudents,
  isLoading = false,
  onSelectStudent,
  searchQuery,
  onSearchChange,
  selectedSection,
  onSectionChange,
  selectedBand,
  onBandChange,
  sortField,
  onSortChange,
  sortDirection,
  onClearFilters,
  className,
}: ClassTableProps) {
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Global keyboard shortcut: press '/' to focus search input (Cmd/Ctrl+K is reserved for Upload Worksheet)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Do not intercept shortcuts if any modal dialog is currently active
      if (
        document.querySelector('[role="dialog"]') !== null ||
        document.querySelector('[data-slot="dialog-content"]') !== null
      ) {
        return;
      }

      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable ||
          target.tagName === "SELECT");

      if (!isInput && e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey) {
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
    const counts: Record<BandFilter, number> = {
      all: students.length,
      needs_improvement: 0,
      developing: 0,
      satisfactory: 0,
      excellent: 0,
      unrated: 0,
    };

    students.forEach((s) => {
      const score = s.scores.composite;
      if (score === null || score === undefined) {
        counts.unrated++;
      } else {
        const band = getBandFromScore(score);
        if (band) {
          counts[band]++;
        } else {
          counts.unrated++;
        }
      }
    });

    return [
      { id: "all", label: "All Tiers", count: counts.all },
      { id: "needs_improvement", label: "Needs Improvement", count: counts.needs_improvement },
      { id: "developing", label: "Developing", count: counts.developing },
      { id: "satisfactory", label: "Satisfactory", count: counts.satisfactory },
      { id: "excellent", label: "Excellent", count: counts.excellent },
      { id: "unrated", label: "Unrated", count: counts.unrated },
    ];
  }, [students]);

  const hasActiveFilters =
    searchQuery.trim() !== "" || selectedSection !== "all" || selectedBand !== "all";

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      onSortChange(field, sortDirection === "asc" ? "desc" : "asc");
    } else {
      // Default to ascending for criterion scores so weakest students float to the top
      onSortChange(field, "asc");
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown data-icon="inline-end" className="text-muted-foreground/40" aria-hidden="true" />;
    }
    return sortDirection === "asc" ? (
      <ArrowUp data-icon="inline-end" className="text-primary" aria-hidden="true" />
    ) : (
      <ArrowDown data-icon="inline-end" className="text-primary" aria-hidden="true" />
    );
  };

  if (!isLoading && students.length === 0) {
    return (
      <Card>
        <CardContent className="p-8">
          <Empty>
            <EmptyMedia variant="icon" className="bg-secondary text-secondary-foreground rounded-full size-14 [&_svg:not([class*='size-'])]:size-7">
              <Users aria-hidden="true" />
            </EmptyMedia>
            <EmptyHeader>
              <EmptyTitle>No Students on Roster</EmptyTitle>
              <EmptyDescription>
                Add students to your roster to start tracking handwriting scores.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button nativeButton={false} render={<Link href="/roster" />}>
                <Users data-icon="inline-start" aria-hidden="true" />
                Go to Class Roster
              </Button>
            </EmptyContent>
          </Empty>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn("flex flex-col gap-3.5", className)}>
      {/* Search and Filter Controls */}
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="w-full sm:w-72">
            <SearchInput
              ref={searchInputRef}
              placeholder="Search student or section..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              onClear={() => onSearchChange("")}
              className="w-full"
            />
          </div>

          {sections.length > 1 && (
            <div className="min-w-0 overflow-y-hidden">
              <FilterPills
                items={sectionPills}
                value={selectedSection}
                onChange={onSectionChange}
              />
            </div>
          )}
        </div>

        {/* Diagnostic Performance Tier Filter Pills */}
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-2 min-w-0 overflow-y-hidden flex-1">
            <span className="text-[11px] font-semibold text-muted-foreground shrink-0 uppercase tracking-wider hidden sm:inline">
              Tier:
            </span>
            <FilterPills
              ariaLabel="Filter by performance tier"
              items={bandPills}
              value={selectedBand}
              onChange={(val) => onBandChange(val as BandFilter)}
            />
          </div>
          {hasActiveFilters && (
            <Button
              type="button"
              variant="link"
              size="xs"
              onClick={onClearFilters}
              className="shrink-0 min-h-[40px] sm:min-h-[36px] px-2 text-xs cursor-pointer"
            >
              Clear filters
            </Button>
          )}
        </div>
      </div>

      {/* Mobile Student Cards (<640px) — avoids horizontal scrolling a 9-column table on phones */}
      <div className="sm:hidden flex flex-col gap-2.5">
        {/* Compact mobile sort bar */}
        <Field orientation="horizontal" className="justify-between gap-2">
          <FieldLabel htmlFor="mobile-student-sort" className="text-xs font-medium text-muted-foreground shrink-0">
            Sort by
          </FieldLabel>
          <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
            <Select
              items={COLUMNS.map((col) => ({ value: col.field, label: col.label }))}
              value={sortField}
              onValueChange={(value) => {
                if (value) onSortChange(value as SortField, "asc");
              }}
            >
              <SelectTrigger
                id="mobile-student-sort"
                aria-label="Sort by"
                className="min-h-10 min-w-0 flex-1 max-w-[200px] border-border bg-background"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectGroup>
                  {COLUMNS.map((col) => (
                    <SelectItem key={col.field} value={col.field}>
                      {col.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => onSortChange(sortField, sortDirection === "asc" ? "desc" : "asc")}
              aria-label={`Sort direction: ${sortDirection === "asc" ? "ascending" : "descending"}. Click to toggle.`}
              className="min-h-10 min-w-10 cursor-pointer"
            >
              {sortDirection === "asc" ? (
                <ArrowUp className="text-primary" aria-hidden="true" />
              ) : (
                <ArrowDown className="text-primary" aria-hidden="true" />
              )}
            </Button>
          </div>
        </Field>

        {isLoading ? (
          <div className="flex flex-col gap-2.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        ) : filteredStudents.length === 0 ? (
          <Card size="sm">
            <CardContent className="p-0">
              <Empty className="py-10 px-4 gap-3">
                <EmptyMedia variant="icon">
                  <SearchX aria-hidden="true" />
                </EmptyMedia>
                <EmptyHeader>
                  <EmptyTitle className="text-base">No students match your filter</EmptyTitle>
                  <EmptyDescription className="text-xs">
                    Try clearing your search or filters.
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onClearFilters}
                    className="min-h-11 px-4 text-xs cursor-pointer"
                  >
                    Reset filters
                  </Button>
                </EmptyContent>
              </Empty>
            </CardContent>
          </Card>
        ) : (
          <ItemGroup className="gap-2.5 sm:hidden">
            {filteredStudents.map((student) => {
              const hasScores = student.scores.composite !== null;
              const lowestCriterion = hasScores
                ? RUBRIC_CRITERIA.map((c) => ({
                    shortName: c.shortName,
                    score: student.scores[c.criterionKey],
                  }))
                    .filter((c): c is { shortName: string; score: number } => c.score !== null)
                    .sort((a, b) => a.score - b.score)[0] ?? null
                : null;

              return (
                <Item
                  key={student.studentId}
                  variant="outline"
                  size="sm"
                  render={
                    <button
                      type="button"
                      onClick={() => onSelectStudent(student)}
                      className="min-h-11 w-full bg-card text-left hover:bg-muted/50 cursor-pointer"
                    />
                  }
                >
                  <ItemContent className="min-w-0">
                    <ItemTitle className="w-full">
                      <span className="text-sm font-semibold text-foreground truncate">
                        {student.fullName}
                      </span>
                      <span className="text-xs font-normal text-muted-foreground shrink-0">
                        {student.section}
                      </span>
                    </ItemTitle>
                    {lowestCriterion ? (
                      <ItemDescription className="text-xs tabular-nums line-clamp-1">
                        Focus: <span className="font-medium text-foreground">{lowestCriterion.shortName}</span> ({lowestCriterion.score.toFixed(1)}%)
                      </ItemDescription>
                    ) : (
                      <ItemDescription className="text-xs italic line-clamp-1">
                        Not yet graded
                      </ItemDescription>
                    )}
                  </ItemContent>

                  <ItemActions className="shrink-0">
                    {hasScores && student.scores.composite !== null ? (
                      <div className="flex flex-col items-end gap-1 text-right">
                        <span className="font-sans text-sm font-bold tabular-nums text-foreground">
                          {student.scores.composite.toFixed(1)}%
                        </span>
                        <BandBadge score={student.scores.composite} size="sm" showDot={false} />
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground/70">Unrated</span>
                    )}
                    <ChevronRight className="size-4 text-muted-foreground/60 shrink-0" aria-hidden="true" />
                  </ItemActions>
                </Item>
              );
            })}
          </ItemGroup>
        )}

        <p className="text-xs text-muted-foreground px-1">
          Showing <strong className="text-foreground">{filteredStudents.length}</strong> of{" "}
          {students.length} students
        </p>
      </div>

      {/* Main Table (Tablet & Desktop >=640px) — flat 1px border per DESIGN.md elevation rule */}
      <Card className="hidden sm:block p-0 gap-0 shadow-none">
        <CardContent className="p-0 overflow-x-auto">
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
                      className={cn(
                        "text-xs font-semibold text-foreground py-3 select-none",
                        col.isNumeric ? "text-right" : "text-left"
                      )}
                    >
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <Button
                              type="button"
                              variant="ghost"
                              size="xs"
                              onClick={() => handleSort(col.field)}
                              className={cn(
                                "w-full h-auto py-1 px-0 font-semibold hover:bg-transparent hover:text-primary",
                                col.isNumeric ? "justify-end" : "justify-start"
                              )}
                            />
                          }
                        >
                          <span>{col.label}</span>
                          {getSortIcon(col.field)}
                        </TooltipTrigger>
                        {col.description && (
                          <TooltipContent
                            side="top"
                            className="text-xs max-w-[200px] text-center font-normal"
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
                    <TableRow key={i} className="border-b border-border/50">
                      <TableCell colSpan={9} className="py-4 px-4">
                        <Skeleton className="h-6 w-full rounded-md" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : filteredStudents.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={9} className="p-0">
                      <Empty className="py-12 px-4 gap-3">
                        <EmptyMedia variant="icon">
                          <SearchX aria-hidden="true" />
                        </EmptyMedia>
                        <EmptyHeader>
                          <EmptyTitle className="text-base">No students match your filter</EmptyTitle>
                          <EmptyDescription className="text-xs">
                            Try clearing your search or filters.
                          </EmptyDescription>
                        </EmptyHeader>
                        <EmptyContent>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={onClearFilters}
                            className="min-h-9 text-xs cursor-pointer"
                          >
                            Reset filters
                          </Button>
                        </EmptyContent>
                      </Empty>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredStudents.map((student) => {
                    const hasScores = student.scores.composite !== null;

                    return (
                      <TableRow
                        key={student.studentId}
                        onClick={() => onSelectStudent(student)}
                        className="group cursor-pointer hover:bg-muted/30 transition-colors border-b border-border/60"
                      >
                        {/* Student Name — semantic Button keeps <tr> as a native table row for screen readers */}
                        <TableCell className="py-3 px-4 font-medium">
                          <div className="min-w-0">
                            <Button
                              type="button"
                              variant="link"
                              size="xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectStudent(student);
                              }}
                              aria-label={`View handwriting diagnostics for ${student.fullName}`}
                              className="h-auto p-0 text-left font-semibold text-foreground group-hover:text-primary max-w-full justify-start overflow-hidden"
                            >
                              <span className="truncate">{student.fullName}</span>
                            </Button>
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
                            <ScoreCell score={student.scores.composite} />
                          ) : (
                            <span className="text-xs text-muted-foreground/60 italic">Unrated</span>
                          )}
                        </TableCell>

                        {/* Action Chevron */}
                        <TableCell className="py-3 pr-4 pl-0 text-right">
                          <ChevronRight className="size-4 text-muted-foreground/40 group-hover:text-foreground group-hover:translate-x-0.5 transition-all motion-reduce:transform-none motion-reduce:transition-colors inline-block" aria-hidden="true" />
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TooltipProvider>
        </CardContent>

        <Separator />

        {/* Table Footer Count & Dual-Signal 4-Band Legend */}
        <CardFooter className="px-4 py-2.5 bg-muted/20 flex-wrap justify-between gap-x-4 gap-y-2 text-xs text-muted-foreground">
          <span>
            Showing <strong className="text-foreground">{filteredStudents.length}</strong> of{" "}
            {students.length} students
          </span>
          <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1" aria-label="Score band legend">
            {RUBRIC_BANDS.map((band) => {
              const range =
                band.band === "needs_improvement"
                  ? "0–24%"
                  : band.band === "developing"
                    ? "25–49%"
                    : band.band === "satisfactory"
                      ? "50–74%"
                      : "75–100%";
              return (
                <span key={band.band} className="inline-flex items-center gap-1.5">
                  <span className={cn("size-2 rounded-full shrink-0", band.dotColor)} aria-hidden="true" />
                  <span className="font-medium text-foreground">{band.label}</span>
                  <span className="tabular-nums">({range})</span>
                </span>
              );
            })}
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}

function ScoreCell({ score }: { score: number | null | undefined }) {
  if (score === null || score === undefined) {
    return <span className="text-xs text-muted-foreground/50 tabular-nums">—</span>;
  }

  const meta = getBandMeta(getBandFromScore(score));

  return (
    <div className="inline-flex items-center gap-1.5 justify-end">
      <span className="font-sans text-xs font-medium tabular-nums text-foreground">
        {score.toFixed(1)}%
      </span>
      <span className="sr-only">({meta.label})</span>
      <span
        className={cn("size-2 rounded-full shrink-0", meta.dotColor)}
        aria-hidden="true"
        title={meta.label}
      />
    </div>
  );
}
