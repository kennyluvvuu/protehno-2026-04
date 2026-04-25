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

export const statsApi = {
  getOverview: async (): Promise<StatsOverview> => {
    const { data } = await api.get<StatsOverview>("/stats/overview");
    return data;
  },

  getWeekly: async (): Promise<WeeklyStatsItem[]> => {
    const { data } = await api.get<WeeklyStatsItem[]>("/stats/weekly");
    return data;
  },

  getByAgent: async (): Promise<StatsByAgentItem[]> => {
    const { data } = await api.get<StatsByAgentItem[]>("/stats/by-agent");
    return data;
  },
};
