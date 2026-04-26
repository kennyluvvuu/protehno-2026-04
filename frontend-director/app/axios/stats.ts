import { api } from "~/lib/axios-client";

export type StatsPeriod = "7d" | "14d" | "30d" | "90d";

export type GlobalStatsParams =
  | { period?: StatsPeriod; startDate?: never; endDate?: never }
  | { startDate: string; endDate: string; period?: never };

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

export interface StatsRange {
  mode: "period" | "custom";
  period: StatsPeriod | "custom";
  start: string;
  end: string;
  days: number;
}

export interface GlobalStatsOverview {
  totalRecords: number;
  doneRecords: number;
  failedRecords: number;
  avgQualityScore: number | null;
  totalManagers: number;
  queuedRecords: number;
  processingRecords: number;
  uploadedRecords: number;
  notApplicableRecords: number;
  missedRecords: number;
  noAudioRecords: number;
  withAudioRecords: number;
  unassignedRecords: number;
  avgTalkDurationSec: number | null;
  avgProcessingDurationSec: number | null;
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

export interface StatsStatusItem {
  status: string;
  total: number;
}

export interface StatsIngestionStatusItem {
  ingestionStatus: string;
  total: number;
}

export interface StatsOwnership {
  assigned: number;
  unassigned: number;
  unassignedMango: number;
  unassignedManual: number;
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

export interface GlobalStatsByAgentItem {
  userId: number;
  name: string;
  total: number;
  done: number;
  failed: number;
  missed: number;
  avgTalkDurationSec: number | null;
  avgQualityScore: number | null;
}

export interface StatsOperational {
  mangoPendingAudio: number;
  mangoDownloading: number;
  mangoReady: number;
  mangoNoAudio: number;
  mangoIngestionFailed: number;
  aiQueued: number;
  aiProcessing: number;
  aiFailed: number;
  unassignedMango: number;
}

export interface AgentDashboardOperational {
  mangoPendingAudio: number;
  mangoDownloading: number;
  mangoReady: number;
  mangoNoAudio: number;
  mangoIngestionFailed: number;
  aiQueued: number;
  aiProcessing: number;
  aiFailed: number;
}

export interface GlobalStats {
  range: StatsRange;
  overview: GlobalStatsOverview;
  source: StatsSourceItem[];
  direction: StatsDirectionItem[];
  processingStatuses: StatsStatusItem[];
  ingestionStatuses: StatsIngestionStatusItem[];
  ownership: StatsOwnership;
  trend: StatsTrendItem[];
  byAgent: GlobalStatsByAgentItem[];
  operational: StatsOperational;
}

export interface AgentDashboard {
  agent: { userId: number; name: string; email: string };
  range: StatsRange;
  overview: AgentDashboardOverview;
  source: StatsSourceItem[];
  direction: StatsDirectionItem[];
  processingStatuses: StatsStatusItem[];
  ingestionStatuses: StatsIngestionStatusItem[];
  trend: StatsTrendItem[];
  operational: AgentDashboardOperational;
}

function buildParams(params?: GlobalStatsParams): Record<string, string> {
  if (!params) return {};
  if ("startDate" in params && params.startDate) {
    return { startDate: params.startDate, endDate: params.endDate };
  }
  return params.period ? { period: params.period } : {};
}

export const statsApi = {
  getOverview: async (period: StatsPeriod = "7d"): Promise<StatsOverview> => {
    const { data } = await api.get<StatsOverview>("/stats/overview", { params: { period } });
    return data;
  },

  getWeekly: async (period: StatsPeriod = "7d"): Promise<WeeklyStatsItem[]> => {
    const { data } = await api.get<WeeklyStatsItem[]>("/stats/weekly", { params: { period } });
    return data;
  },

  getByAgent: async (period: StatsPeriod = "7d"): Promise<StatsByAgentItem[]> => {
    const { data } = await api.get<StatsByAgentItem[]>("/stats/by-agent", { params: { period } });
    return data;
  },

  getGlobalStats: async (params?: GlobalStatsParams): Promise<GlobalStats> => {
    const { data } = await api.get<GlobalStats>("/stats/global", { params: buildParams(params) });
    return data;
  },

  getAgentDashboard: async (userId: number, params?: GlobalStatsParams): Promise<AgentDashboard> => {
    const { data } = await api.get<AgentDashboard>(`/stats/agent/${userId}/dashboard`, { params: buildParams(params) });
    return data;
  },
};
