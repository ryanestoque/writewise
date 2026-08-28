import { useQuery } from "@tanstack/react-query";
import { createClient } from "../supabase/client";
import { getBandFromScore, type ScoreBand } from "../utils/scoring";
import type { StudentScoreHistoryItem } from "./use-dashboard";

// --- Types ---

export interface LinkedChild {
  id: string;
  fullName: string;
  section: string;
}

export interface ChildLatestScores {
  submissionId: string;
  submissionDate: string;
  activityText: string;
  imagePath: string | null;
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

export interface TakeHomeActivity {
  id: string;
  targetText: string;
  createdAt: string;
}

// --- Hooks ---

export function useLinkedChildren() {
  const supabase = createClient();

  return useQuery({
    queryKey: ["parent-linked-children"],
    queryFn: async (): Promise<LinkedChild[]> => {
      // student_parent RLS: parent can view own links
      // student RLS: parent can view own child
      const { data, error } = await supabase
        .from("student_parent")
        .select("student:student_id(id, full_name, section)")
        .order("created_at");

      if (error) throw new Error(error.message);

      return (data || [])
        .map((row: Record<string, unknown>) => {
          const student = Array.isArray(row.student) ? row.student[0] : row.student;
          if (!student) return null;
          return {
            id: (student as { id: string }).id,
            fullName: (student as { full_name: string }).full_name,
            section: (student as { section: string }).section,
          };
        })
        .filter((child): child is LinkedChild => child !== null);
    },
  });
}

export function useChildLatestScores(childId: string | null) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["parent-child-latest-scores", childId],
    queryFn: async (): Promise<ChildLatestScores | null> => {
      if (!childId) return null;

      const { data, error } = await supabase
        .from("submission")
        .select(`
          id,
          created_at,
          status,
          image_path,
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
        `)
        .eq("student_id", childId)
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw new Error(error.message);

      // Find the latest completed submission that has scores
      for (const row of data || []) {
        const m = Array.isArray(row.measurement) ? row.measurement[0] : row.measurement;
        const ms = Array.isArray(row.manual_score) ? row.manual_score[0] : row.manual_score;
        if (!m?.composite_score && !ms) continue;

        const rawActivity = Array.isArray(row.activity) ? row.activity[0] : row.activity;
        const isCalibrated = m?.composite_score != null;

        let scores: ChildLatestScores["scores"];
        let bands: ChildLatestScores["bands"];

        if (isCalibrated) {
          scores = {
            letter_formation: m.letter_formation_score != null ? Number(m.letter_formation_score) : null,
            size_consistency: m.size_consistency_score != null ? Number(m.size_consistency_score) : null,
            spacing: m.spacing_score != null ? Number(m.spacing_score) : null,
            slant: m.slant_score != null ? Number(m.slant_score) : null,
            baseline_alignment: m.baseline_alignment_score != null ? Number(m.baseline_alignment_score) : null,
            composite: Number(m.composite_score),
          };
          bands = {
            letter_formation: getBandFromScore(scores.letter_formation),
            size_consistency: getBandFromScore(scores.size_consistency),
            spacing: getBandFromScore(scores.spacing),
            slant: getBandFromScore(scores.slant),
            baseline_alignment: getBandFromScore(scores.baseline_alignment),
            composite: getBandFromScore(scores.composite),
          };
        } else if (ms) {
          const lfScore = ms.letter_formation_score != null ? Number(ms.letter_formation_score) : null;
          const scScore = ms.size_consistency_score != null ? Number(ms.size_consistency_score) : null;
          const spScore = ms.spacing_score != null ? Number(ms.spacing_score) : null;
          const slScore = ms.slant_score != null ? Number(ms.slant_score) : null;
          const baScore = ms.baseline_alignment_score != null ? Number(ms.baseline_alignment_score) : null;
          const compScore =
            lfScore !== null && scScore !== null && spScore !== null && slScore !== null && baScore !== null
              ? (lfScore + scScore + spScore + slScore + baScore) / 5
              : null;

          scores = {
            letter_formation: lfScore,
            size_consistency: scScore,
            spacing: spScore,
            slant: slScore,
            baseline_alignment: baScore,
            composite: compScore,
          };
          bands = {
            letter_formation: ms.letter_formation_band ?? null,
            size_consistency: ms.size_consistency_band ?? null,
            spacing: ms.spacing_band ?? null,
            slant: ms.slant_band ?? null,
            baseline_alignment: ms.baseline_alignment_band ?? null,
            composite: compScore !== null ? getBandFromScore(compScore) : null,
          };
        } else {
          continue;
        }

        return {
          submissionId: row.id,
          submissionDate: row.created_at,
          activityText: (rawActivity as { target_text: string } | null)?.target_text || "Handwriting Activity",
          imagePath: (row.image_path as string) || null,
          scoreSource: isCalibrated ? "calibrated" : "manual",
          scores,
          bands,
        };
      }

      return null;
    },
    enabled: !!childId,
  });
}

export function useChildScoreHistory(childId: string | null) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["parent-child-score-history", childId],
    queryFn: async (): Promise<StudentScoreHistoryItem[]> => {
      if (!childId) return [];

      const { data, error } = await supabase
        .from("submission")
        .select(`
          id,
          created_at,
          status,
          image_path,
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
        .eq("student_id", childId)
        .eq("status", "completed")
        .order("created_at", { ascending: true });

      if (error) throw new Error(error.message);

      const history: StudentScoreHistoryItem[] = [];

      for (const row of data || []) {
        const rawMeasurement = Array.isArray(row.measurement) ? row.measurement[0] : row.measurement;
        const rawManual = Array.isArray(row.manual_score) ? row.manual_score[0] : row.manual_score;
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
          lfScore = rawManual.letter_formation_score != null ? Number(rawManual.letter_formation_score) : null;
          scScore = rawManual.size_consistency_score != null ? Number(rawManual.size_consistency_score) : null;
          spScore = rawManual.spacing_score != null ? Number(rawManual.spacing_score) : null;
          slScore = rawManual.slant_score != null ? Number(rawManual.slant_score) : null;
          baScore = rawManual.baseline_alignment_score != null ? Number(rawManual.baseline_alignment_score) : null;
          lfBand = rawManual.letter_formation_band ?? null;
          scBand = rawManual.size_consistency_band ?? null;
          spBand = rawManual.spacing_band ?? null;
          slBand = rawManual.slant_band ?? null;
          baBand = rawManual.baseline_alignment_band ?? null;
          if (lfScore !== null && scScore !== null && spScore !== null && slScore !== null && baScore !== null) {
            compScore = (lfScore + scScore + spScore + slScore + baScore) / 5;
          }
        }

        const compBand = compScore !== null ? getBandFromScore(compScore) : null;

        history.push({
          submissionId: row.id,
          submissionDate: row.created_at,
          activityId: (rawActivity as { id: string } | null)?.id || "",
          targetText: (rawActivity as { target_text: string } | null)?.target_text || "Handwriting Activity",
          isTakeHome: Boolean((rawActivity as { is_take_home?: boolean } | null)?.is_take_home),
          imagePath: (row.image_path as string) || null,
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
    enabled: !!childId,
  });
}

export function useTakeHomeActivities(childId: string | null) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["parent-take-home-activities", childId],
    queryFn: async (): Promise<TakeHomeActivity[]> => {
      const { data, error } = await supabase
        .from("activity")
        .select("id, target_text, created_at")
        .eq("is_take_home", true)
        .order("created_at", { ascending: false });

      if (error) throw new Error(error.message);

      return (data || []).map((row) => ({
        id: row.id,
        targetText: row.target_text,
        createdAt: row.created_at,
      }));
    },
    enabled: !!childId,
  });
}

export function useChildSubmissionForActivity(
  childId: string | null,
  activityId: string
) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["parent-child-submission", childId, activityId],
    queryFn: async () => {
      if (!childId || !activityId) return null;

      const { data, error } = await supabase
        .from("submission")
        .select(`
          id,
          status,
          rejection_code,
          measurement(composite_score)
        `)
        .eq("student_id", childId)
        .eq("activity_id", activityId)
        .order("created_at", { ascending: false })
        .limit(1);

      if (error) throw new Error(error.message);

      if (!data || data.length === 0) return null;

      const row = data[0];
      const m = Array.isArray(row.measurement) ? row.measurement[0] : row.measurement;
      const compositeScore = m?.composite_score != null ? Number(m.composite_score) : null;

      return {
        submissionId: row.id as string,
        status: row.status as string,
        rejectionCode: row.rejection_code as string | null,
        compositeScore,
        compositeBand: getBandFromScore(compositeScore),
      };
    },
    enabled: !!childId && !!activityId,
  });
}
