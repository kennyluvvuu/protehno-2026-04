import { useQuery } from "@tanstack/react-query"
import { api } from "~/lib/axios-client"

export interface StatsOverview {
  totalRecords: number
  doneRecords: number
  failedRecords: number
  avgQualityScore: number | null
  totalManagers: number
}

export interface StatsWeeklyItem {
  date: string
  total: number
  done: number
}

export interface StatsByAgentItem {
  userId: number
  name: string
  total: number
  avgQualityScore: number | null
}

const STATS_OVERVIEW_KEY = ["stats", "overview"] as const
const STATS_WEEKLY_KEY = ["stats", "weekly"] as const
const STATS_BY_AGENT_KEY = ["stats", "by-agent"] as const

async function getOverview(): Promise<StatsOverview> {
  const { data } = await api.get<StatsOverview>("/stats/overview")
  return data
}

async function getWeekly(): Promise<StatsWeeklyItem[]> {
  const { data } = await api.get<StatsWeeklyItem[]>("/stats/weekly")
  return data
}

async function getByAgent(): Promise<StatsByAgentItem[]> {
  const { data } = await api.get<StatsByAgentItem[]>("/stats/by-agent")
  return data
}

export function useStatsOverview() {
  return useQuery({
    queryKey: STATS_OVERVIEW_KEY,
    queryFn: getOverview,
  })
}

export function useStatsWeekly() {
  return useQuery({
    queryKey: STATS_WEEKLY_KEY,
    queryFn: getWeekly,
  })
}

export function useStatsByAgent() {
  return useQuery({
    queryKey: STATS_BY_AGENT_KEY,
    queryFn: getByAgent,
  })
}
