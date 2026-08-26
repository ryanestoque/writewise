import { useQuery } from "@tanstack/react-query";
import { createClient } from "../supabase/client";
import { getBandFromScore, type ScoreBand } from "../utils/scoring";

export interface StudentScoreSummary {
  studentId: string;
  fullName: string;
  section: string;
  latestSubmissionId: string | null;
  latestSubmissionDate: string | null;
  latestActivityText: string | null;
  scoreSource: "manual" | "calibrated" | "none";
  scores: {
    letter_formation: number | null;
    size_consistency: number | null;
    spacing: number | null;
    slant: number | null;
    baseline_alignment: number | null;
    composite: number | null;
  };
  bands: {
    letter_formation: ScoreBand | null;
    size_consistency: ScoreBand | null;
    spacing: ScoreBand | null;
    slant: ScoreBand | null;
    baseline_alignment: ScoreBand | null;
    composite: ScoreBand | null;
  };
}

export interface ClassAverages {
  letter_formation: number | null;
  size_consistency: number | null;
  spacing: number | null;
  slant: number | null;
  baseline_alignment: number | null;
  composite: number | null;
  scoredStudentsCount: number;
  totalStudentsCount: number;
  scoreSource: "manual" | "calibrated";
}

export function useDashboardScores() {
  const supabase = createClient();

  return useQuery({
    queryKey: ["dashboard-scores"],
    queryFn: async () => {
      // Query students linked to teacher with their submissions, manual scores, and measurement scores
      const { data, error } = await supabase
        .from("student")
        .select(`
          id,
          full_name,
          section,
          submissions:submission(
            id,
            created_at,
            status,
            activity:activity_id(
              id,
              target_text
            ),
            manual_score(
              letter_formation_band,
              letter_formation_score,
              size_consistency_band,
              size_consistency_score,
              spacing_band,
              spacing_score,
              slant_band,
              slant_score,
              baseline_alignment_band,
              baseline_alignment_score
            ),
            measurement(
              letter_formation_score,
              size_consistency_score,
              spacing_score,
              slant_score,
              baseline_alignment_score,
              composite_score
            )
          )
        `)
        .order("full_name");

      if (error) {
        throw new Error(error.message);
      }

      const students: StudentScoreSummary[] = [];
      let totalScored = 0;
      let hasCalibrated = false;

      const sumTotals = {
        letter_formation: 0,
        size_consistency: 0,
        spacing: 0,
        slant: 0,
        baseline_alignment: 0,
        composite: 0,
        count: 0,
      };

      for (const row of data || []) {
        const studentSubmissions = Array.isArray(row.submissions) ? row.submissions : [];
        // Filter only completed submissions that have either manual_score or measurement
        const scoredSubmissions = studentSubmissions
          .filter(
            (s: { status: string; manual_score?: unknown; measurement?: unknown }) =>
              s.status === "completed"
          )
          .sort(
            (a: { created_at: string }, b: { created_at: string }) =>
              new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );

        // Find the latest completed submission that actually has scores
        let latestWithScores: (typeof scoredSubmissions)[0] | null = null;
        for (const s of scoredSubmissions) {
          const m = Array.isArray(s.measurement) ? s.measurement[0] : s.measurement;
          const ms = Array.isArray(s.manual_score) ? s.manual_score[0] : s.manual_score;
          if (m?.composite_score != null || ms != null) {
            latestWithScores = s;
            break;
          }
        }

        if (!latestWithScores) {
          students.push({
            studentId: row.id,
            fullName: row.full_name,
            section: row.section,
            latestSubmissionId: null,
            latestSubmissionDate: null,
            latestActivityText: null,
            scoreSource: "none",
            scores: {
              letter_formation: null,
              size_consistency: null,
              spacing: null,
              slant: null,
              baseline_alignment: null,
              composite: null,
            },
            bands: {
              letter_formation: null,
              size_consistency: null,
              spacing: null,
              slant: null,
              baseline_alignment: null,
              composite: null,
            },
          });
          continue;
        }

        const rawMeasurement = Array.isArray(latestWithScores.measurement)
          ? latestWithScores.measurement[0]
          : latestWithScores.measurement;
        const rawManual = Array.isArray(latestWithScores.manual_score)
          ? latestWithScores.manual_score[0]
          : latestWithScores.manual_score;
        const rawActivity = Array.isArray(latestWithScores.activity)
          ? latestWithScores.activity[0]
          : latestWithScores.activity;

        // Phase 2 check: if measurement has calibrated scores
        const isCalibrated = rawMeasurement?.composite_score != null;
        if (isCalibrated) hasCalibrated = true;

        let lfScore: number | null = null;
        let scScore: number | null = null;
        let spScore: number | null = null;
        let slScore: number | null = null;
        let baScore: number | null = null;
        let compScore: number | null = null;

        let lfBand: ScoreBand | null = null;
        let scBand: ScoreBand | null = null;
        let spBand: ScoreBand | null = null;
        let slBand: ScoreBand | null = null;
        let baBand: ScoreBand | null = null;

        if (isCalibrated) {
          lfScore = Number(rawMeasurement.letter_formation_score);
          scScore = Number(rawMeasurement.size_consistency_score);
          spScore = Number(rawMeasurement.spacing_score);
          slScore = Number(rawMeasurement.slant_score);
          baScore = Number(rawMeasurement.baseline_alignment_score);
          compScore = Number(rawMeasurement.composite_score);

          lfBand = getBandFromScore(lfScore);
          scBand = getBandFromScore(scScore);
          spBand = getBandFromScore(spScore);
          slBand = getBandFromScore(slScore);
          baBand = getBandFromScore(baScore);
        } else if (rawManual) {
          lfScore =
            rawManual.letter_formation_score !== undefined &&
            rawManual.letter_formation_score !== null
              ? Number(rawManual.letter_formation_score)
              : null;
          scScore =
            rawManual.size_consistency_score !== undefined &&
            rawManual.size_consistency_score !== null
              ? Number(rawManual.size_consistency_score)
              : null;
          spScore =
            rawManual.spacing_score !== undefined && rawManual.spacing_score !== null
              ? Number(rawManual.spacing_score)
              : null;
          slScore =
            rawManual.slant_score !== undefined && rawManual.slant_score !== null
              ? Number(rawManual.slant_score)
              : null;
          baScore =
            rawManual.baseline_alignment_score !== undefined &&
            rawManual.baseline_alignment_score !== null
              ? Number(rawManual.baseline_alignment_score)
              : null;

          lfBand = rawManual.letter_formation_band ?? null;
          scBand = rawManual.size_consistency_band ?? null;
          spBand = rawManual.spacing_band ?? null;
          slBand = rawManual.slant_band ?? null;
          baBand = rawManual.baseline_alignment_band ?? null;

          if (
            lfScore !== null &&
            scScore !== null &&
            spScore !== null &&
            slScore !== null &&
            baScore !== null
          ) {
            compScore = (lfScore + scScore + spScore + slScore + baScore) / 5;
          }
        }

        const compBand = compScore !== null ? getBandFromScore(compScore) : null;

        if (compScore !== null) {
          totalScored++;
          sumTotals.letter_formation += lfScore ?? 0;
          sumTotals.size_consistency += scScore ?? 0;
          sumTotals.spacing += spScore ?? 0;
          sumTotals.slant += slScore ?? 0;
          sumTotals.baseline_alignment += baScore ?? 0;
          sumTotals.composite += compScore;
          sumTotals.count++;
        }

        students.push({
          studentId: row.id,
          fullName: row.full_name,
          section: row.section,
          latestSubmissionId: latestWithScores.id,
          latestSubmissionDate: latestWithScores.created_at,
          latestActivityText: rawActivity?.target_text || null,
          scoreSource: isCalibrated ? "calibrated" : rawManual ? "manual" : "none",
          scores: {
            letter_formation: lfScore,
            size_consistency: scScore,
            spacing: spScore,
            slant: slScore,
            baseline_alignment: baScore,
            composite: compScore,
          },
          bands: {
            letter_formation: lfBand,
            size_consistency: scBand,
            spacing: spBand,
            slant: slBand,
            baseline_alignment: baBand,
            composite: compBand,
          },
        });
      }

      const count = sumTotals.count || 1;
      const classAverages: ClassAverages = {
        letter_formation:
          sumTotals.count > 0 ? sumTotals.letter_formation / count : null,
        size_consistency:
          sumTotals.count > 0 ? sumTotals.size_consistency / count : null,
        spacing: sumTotals.count > 0 ? sumTotals.spacing / count : null,
        slant: sumTotals.count > 0 ? sumTotals.slant / count : null,
        baseline_alignment:
          sumTotals.count > 0 ? sumTotals.baseline_alignment / count : null,
        composite: sumTotals.count > 0 ? sumTotals.composite / count : null,
        scoredStudentsCount: totalScored,
        totalStudentsCount: students.length,
        scoreSource: hasCalibrated ? "calibrated" : "manual",
      };

      return { students, classAverages };
    },
  });
}

export interface StudentScoreHistoryItem {
  submissionId: string;
  submissionDate: string;
  activityId: string;
  targetText: string;
  isTakeHome: boolean;
  scoreSource: "manual" | "calibrated";
  compositeScore: number | null;
  compositeBand: ScoreBand | null;
  scores: {
    letter_formation: number | null;
    size_consistency: number | null;
    spacing: number | null;
    slant: number | null;
    baseline_alignment: number | null;
  };
  bands: {
    letter_formation: ScoreBand | null;
    size_consistency: ScoreBand | null;
    spacing: ScoreBand | null;
    slant: ScoreBand | null;
    baseline_alignment: ScoreBand | null;
  };
}

export function useStudentScoreHistory(studentId: string | null) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["student-score-history", studentId],
    queryFn: async () => {
      if (!studentId) return [];

      const { data, error } = await supabase
        .from("submission")
        .select(`
          id,
          created_at,
          status,
          activity:activity_id(
            id,
            target_text,
            is_take_home
          ),
          manual_score(
            letter_formation_band,
            letter_formation_score,
            size_consistency_band,
            size_consistency_score,
            spacing_band,
            spacing_score,
            slant_band,
            slant_score,
            baseline_alignment_band,
            baseline_alignment_score
          ),
          measurement(
            letter_formation_score,
            size_consistency_score,
            spacing_score,
            slant_score,
            baseline_alignment_score,
            composite_score
          )
        `)
        .eq("student_id", studentId)
        .eq("status", "completed")
        .order("created_at", { ascending: true });

      if (error) {
        throw new Error(error.message);
      }

      const history: StudentScoreHistoryItem[] = [];

      for (const row of data || []) {
        const rawMeasurement = Array.isArray(row.measurement)
          ? row.measurement[0]
          : row.measurement;
        const rawManual = Array.isArray(row.manual_score)
          ? row.manual_score[0]
          : row.manual_score;
        const rawActivity = Array.isArray(row.activity) ? row.activity[0] : row.activity;

        const isCalibrated = rawMeasurement?.composite_score != null;
        if (!isCalibrated && !rawManual) continue;

        let lfScore: number | null = null;
        let scScore: number | null = null;
        let spScore: number | null = null;
        let slScore: number | null = null;
        let baScore: number | null = null;
        let compScore: number | null = null;

        let lfBand: ScoreBand | null = null;
        let scBand: ScoreBand | null = null;
        let spBand: ScoreBand | null = null;
        let slBand: ScoreBand | null = null;
        let baBand: ScoreBand | null = null;

        if (isCalibrated) {
          lfScore = Number(rawMeasurement.letter_formation_score);
          scScore = Number(rawMeasurement.size_consistency_score);
          spScore = Number(rawMeasurement.spacing_score);
          slScore = Number(rawMeasurement.slant_score);
          baScore = Number(rawMeasurement.baseline_alignment_score);
          compScore = Number(rawMeasurement.composite_score);

          lfBand = getBandFromScore(lfScore);
          scBand = getBandFromScore(scScore);
          spBand = getBandFromScore(spScore);
          slBand = getBandFromScore(slScore);
          baBand = getBandFromScore(baScore);
        } else if (rawManual) {
          lfScore =
            rawManual.letter_formation_score !== undefined &&
            rawManual.letter_formation_score !== null
              ? Number(rawManual.letter_formation_score)
              : null;
          scScore =
            rawManual.size_consistency_score !== undefined &&
            rawManual.size_consistency_score !== null
              ? Number(rawManual.size_consistency_score)
              : null;
          spScore =
            rawManual.spacing_score !== undefined && rawManual.spacing_score !== null
              ? Number(rawManual.spacing_score)
              : null;
          slScore =
            rawManual.slant_score !== undefined && rawManual.slant_score !== null
              ? Number(rawManual.slant_score)
              : null;
          baScore =
            rawManual.baseline_alignment_score !== undefined &&
            rawManual.baseline_alignment_score !== null
              ? Number(rawManual.baseline_alignment_score)
              : null;

          lfBand = rawManual.letter_formation_band ?? null;
          scBand = rawManual.size_consistency_band ?? null;
          spBand = rawManual.spacing_band ?? null;
          slBand = rawManual.slant_band ?? null;
          baBand = rawManual.baseline_alignment_band ?? null;

          if (
            lfScore !== null &&
            scScore !== null &&
            spScore !== null &&
            slScore !== null &&
            baScore !== null
          ) {
            compScore = (lfScore + scScore + spScore + slScore + baScore) / 5;
          }
        }

        const compBand = compScore !== null ? getBandFromScore(compScore) : null;

        history.push({
          submissionId: row.id,
          submissionDate: row.created_at,
          activityId: rawActivity?.id || "",
          targetText: rawActivity?.target_text || "Handwriting Activity",
          isTakeHome: Boolean(rawActivity?.is_take_home),
          scoreSource: isCalibrated ? "calibrated" : "manual",
          compositeScore: compScore,
          compositeBand: compBand,
          scores: {
            letter_formation: lfScore,
            size_consistency: scScore,
            spacing: spScore,
            slant: slScore,
            baseline_alignment: baScore,
          },
          bands: {
            letter_formation: lfBand,
            size_consistency: scBand,
            spacing: spBand,
            slant: slBand,
            baseline_alignment: baBand,
          },
        });
      }

      return history;
    },
    enabled: !!studentId,
  });
}
