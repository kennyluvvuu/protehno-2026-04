import { useQuery } from "@tanstack/react-query";
import {
  statsApi,
  type AgentDashboard,
  type GlobalStats,
  type GlobalStatsParams,
  type StatsPeriod,
  type StatsOverview,
  type WeeklyStatsItem,
  type StatsByAgentItem,
} from "~/axios/stats";

export type {
  StatsPeriod,
  GlobalStatsParams,
  GlobalStats,
  AgentDashboard,
  StatsOverview,
  WeeklyStatsItem as StatsWeeklyItem,
  StatsByAgentItem,
};

const STATS_OVERVIEW_KEY = ["stats", "overview"] as const;
const STATS_WEEKLY_KEY = ["stats", "weekly"] as const;
const STATS_BY_AGENT_KEY = ["stats", "by-agent"] as const;
const STATS_GLOBAL_KEY = ["stats", "global"] as const;
const STATS_AGENT_DASHBOARD_KEY = ["stats", "agent-dashboard"] as const;

const DEFAULT_PERIOD: StatsPeriod = "7d";

export function useStatsOverview(period: StatsPeriod = DEFAULT_PERIOD) {
  return useQuery({
    queryKey: [...STATS_OVERVIEW_KEY, period],
    queryFn: () => statsApi.getOverview(period),
  });
}

export function useStatsWeekly(period: StatsPeriod = DEFAULT_PERIOD) {
  return useQuery({
    queryKey: [...STATS_WEEKLY_KEY, period],
    queryFn: () => statsApi.getWeekly(period),
  });
}

export function useStatsByAgent(period: StatsPeriod = DEFAULT_PERIOD) {
  return useQuery({
    queryKey: [...STATS_BY_AGENT_KEY, period],
    queryFn: () => statsApi.getByAgent(period),
  });
}

export function useGlobalStats(params?: GlobalStatsParams) {
  return useQuery({
    queryKey: [...STATS_GLOBAL_KEY, params ?? {}],
    queryFn: () => statsApi.getGlobalStats(params),
    staleTime: 30_000,
  });
}

export function useAgentDashboard(userId: number | null, params?: GlobalStatsParams) {
  return useQuery({
    queryKey: [...STATS_AGENT_DASHBOARD_KEY, userId, params ?? {}],
    queryFn: () => statsApi.getAgentDashboard(userId!, params),
    enabled: userId != null,
    staleTime: 30_000,
  });
}
