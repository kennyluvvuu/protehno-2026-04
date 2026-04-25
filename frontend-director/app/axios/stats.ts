import { api } from "~/lib/axios-client";

export interface StatsOverview {
  totalRecords: number;
  doneRecords: number;
  failedRecords: number;
  avgQualityScore: number | null;
  totalManagers: number;
}

export interface WeeklyStatsItem {
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

export const statsApi = {
  getOverview: async (period: StatsPeriod = "7d"): Promise<StatsOverview> => {
    const { data } = await api.get<StatsOverview>("/stats/overview", {
      params: { period },
    });
    return data;
  },

  getWeekly: async (period: StatsPeriod = "7d"): Promise<WeeklyStatsItem[]> => {
    const { data } = await api.get<WeeklyStatsItem[]>("/stats/weekly", {
      params: { period },
    });
    return data;
  },

  getByAgent: async (
    period: StatsPeriod = "7d",
  ): Promise<StatsByAgentItem[]> => {
    const { data } = await api.get<StatsByAgentItem[]>("/stats/by-agent", {
      params: { period },
    });
    return data;
  },
};
