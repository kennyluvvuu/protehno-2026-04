import { useQuery } from "@tanstack/react-query";
import { api } from "~/lib/axios-client";

export interface StatsOverview {
  totalRecords: number;
  doneRecords: number;
  failedRecords: number;
  avgQualityScore: number | null;
  totalManagers: number;
}

export interface StatsWeeklyItem {
  date: string;
  total: number;
  done: number;
}

export interface StatsByAgentItem {
  userId: number;
  name: string;
  total: number;
  avgQualityScore: number | null;
}

export type StatsPeriod = "7d" | "14d" | "30d";

const STATS_OVERVIEW_KEY = ["stats", "overview"] as const;
const STATS_WEEKLY_KEY = ["stats", "weekly"] as const;
const STATS_BY_AGENT_KEY = ["stats", "by-agent"] as const;
const DEFAULT_STATS_PERIOD: StatsPeriod = "7d";

async function getOverview(
  period: StatsPeriod = DEFAULT_STATS_PERIOD,
): Promise<StatsOverview> {
  const { data } = await api.get<StatsOverview>("/stats/overview", {
    params: { period },
  });
  return data;
}

async function getWeekly(
  period: StatsPeriod = DEFAULT_STATS_PERIOD,
): Promise<StatsWeeklyItem[]> {
  const { data } = await api.get<StatsWeeklyItem[]>("/stats/weekly", {
    params: { period },
  });
  return data;
}

async function getByAgent(
  period: StatsPeriod = DEFAULT_STATS_PERIOD,
): Promise<StatsByAgentItem[]> {
  const { data } = await api.get<StatsByAgentItem[]>("/stats/by-agent", {
    params: { period },
  });
  return data;
}

export function useStatsOverview(period: StatsPeriod = DEFAULT_STATS_PERIOD) {
  return useQuery({
    queryKey: [...STATS_OVERVIEW_KEY, period],
    queryFn: () => getOverview(period),
  });
}

export function useStatsWeekly(period: StatsPeriod = DEFAULT_STATS_PERIOD) {
  return useQuery({
    queryKey: [...STATS_WEEKLY_KEY, period],
    queryFn: () => getWeekly(period),
  });
}

export function useStatsByAgent(period: StatsPeriod = DEFAULT_STATS_PERIOD) {
  return useQuery({
    queryKey: [...STATS_BY_AGENT_KEY, period],
    queryFn: () => getByAgent(period),
  });
}
