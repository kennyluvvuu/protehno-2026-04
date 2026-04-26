import { api } from "~/lib/axios-client";

export type StatsPeriod = "7d" | "14d" | "30d" | "90d";

export type GlobalStatsParams =
  | { period?: StatsPeriod; startDate?: never; endDate?: never }
  | { startDate: string; endDate: string; period?: never };

export interface StatsRange {
  mode: "period" | "custom";
  period: StatsPeriod | "custom";
  start: string;
  end: string;
  days: number;
}

export interface AgentDashboardOverview {
  totalRecords: number;
  doneRecords: number;
  failedRecords: number;
  avgQualityScore: number | null;
  queuedRecords: number;
  processingRecords: number;
  uploadedRecords: number;
  notApplicableRecords: number;
  missedRecords: number;
  noAudioRecords: number;
  withAudioRecords: number;
  avgTalkDurationSec: number | null;
  avgProcessingDurationSec: number | null;
}

export interface StatsTrendItem {
  date: string;
  total: number;
  done: number;
  failed: number;
  missed: number;
  noAudio: number;
  avgQualityScore: number | null;
}

export interface StatsSourceItem {
  source: string;
  total: number;
  done: number;
  failed: number;
  inProgress: number;
  missed: number;
  noAudio: number;
  avgQualityScore: number | null;
}

export interface StatsDirectionItem {
  direction: string;
  total: number;
  done: number;
  failed: number;
  missed: number;
  avgQualityScore: number | null;
}

export interface AgentDashboard {
  agent: { userId: number; name: string; email: string };
  range: StatsRange;
  overview: AgentDashboardOverview;
  source: StatsSourceItem[];
  direction: StatsDirectionItem[];
  trend: StatsTrendItem[];
}

function buildParams(params?: GlobalStatsParams): Record<string, string> {
  if (!params) return {};
  if ("startDate" in params && params.startDate) {
    return { startDate: params.startDate, endDate: params.endDate };
  }
  return params.period ? { period: params.period } : {};
}

export const statsApi = {
  getAgentDashboard: async (userId: number, params?: GlobalStatsParams): Promise<AgentDashboard> => {
    const { data } = await api.get<AgentDashboard>(`/stats/agent/${userId}/dashboard`, {
      params: buildParams(params),
    });
    return data;
  },
};
