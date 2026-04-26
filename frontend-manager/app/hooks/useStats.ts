import { useQuery } from "@tanstack/react-query";
import { statsApi, type AgentDashboard, type GlobalStatsParams, type StatsPeriod } from "~/axios/stats";

export type { StatsPeriod, GlobalStatsParams, AgentDashboard };

const STATS_AGENT_DASHBOARD_KEY = ["stats", "agent-dashboard"] as const;

export function useAgentDashboard(userId: number | null, params?: GlobalStatsParams) {
  return useQuery({
    queryKey: [...STATS_AGENT_DASHBOARD_KEY, userId, params ?? {}],
    queryFn: () => statsApi.getAgentDashboard(userId!, params),
    enabled: userId != null,
    staleTime: 30_000,
  });
}
