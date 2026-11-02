import { useQuery } from "@tanstack/react-query";

type ScoringEngine = "manual" | "calibrated";

export function useScoringEngine() {
  return useQuery({
    queryKey: ["scoring-engine"],
    queryFn: async (): Promise<ScoringEngine> => {
      const response = await fetch("/api/health", { cache: "no-store" });
      if (!response.ok) throw new Error("Unable to confirm scoring mode");

      const health: unknown = await response.json();
      if (
        typeof health !== "object" ||
        health === null ||
        !("scoring_engine" in health) ||
        (health.scoring_engine !== "manual" && health.scoring_engine !== "calibrated")
      ) {
        throw new Error("Invalid scoring mode response");
      }

      return health.scoring_engine;
    },
    retry: false,
  });
}
