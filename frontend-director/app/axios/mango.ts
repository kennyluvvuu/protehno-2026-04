import { api } from "~/lib/axios-client";
import { assertRequestCooldown } from "~/lib/request-guard";
import type { User } from "~/types/auth";

export interface MangoTelephonyNumber {
  number: string;
  protocol: string | null;
  order: number | null;
  wait_sec: number | null;
  status: string | null;
}

export interface MangoCreateLocalUserDraft {
  name: string;
  fio: string | null;
  email: string;
  role: "manager";
  mangoUserId: number;
  mangoLogin?: string | null;
  mangoExtension?: string | null;
  mangoPosition?: string | null;
  mangoDepartment?: string | null;
  mangoMobile?: string | null;
  mangoOutgoingLine?: string | null;
  mangoAccessRoleId?: number | null;
  mangoGroups?: number[] | null;
  mangoSips?: string[] | null;
  mangoTelephonyNumbers?: MangoTelephonyNumber[] | null;
}

export interface MangoCandidateMatch {
  user: User;
  score: number;
  reasons: string[];
}

export interface MangoDirectoryCandidate {
  mangoUserId: number;
  name: string;
  email: string | null;
  department: string | null;
  position: string | null;
  accessRoleId: number | null;
  mobile: string | null;
  login: string | null;
  extension: string | null;
  outgoingLine: string | null;
  sips: string[];
  telephonyNumbers: MangoTelephonyNumber[];
  groups: number[];
  linkedUserId: number | null;
  linkedByMangoUserId: boolean;
  candidates: MangoCandidateMatch[];
  createLocalUserDraft: MangoCreateLocalUserDraft;
}

export interface MangoUsersCandidatesResponse {
  items: MangoDirectoryCandidate[];
}

export interface LinkMangoUserPayload {
  userId: number | null;
}

export interface LinkMangoUserResponse {
  ok: true;
  mangoUserId: number;
  linkedUserId: number | null;
  linkedCount?: number;
}

export interface MangoSyncPayload {
  startDate: string;
  endDate: string;
  limit?: number;
  offset?: number;
  maxPages?: number;
  pollIntervalMs?: number;
  maxAttempts?: number;
  downloadRecordings?: boolean;
}

export interface MangoSyncResponse {
  startDate?: string;
  endDate?: string;
  fetched?: number;
  created?: number;
  updated?: number;
  downloaded?: number;
  failedDownloads?: number;
  skippedNoAudio?: number;
  errors?: string[];
  [key: string]: unknown;
}

export interface MangoRefreshUsersResponse {
  [key: string]: unknown;
}

export const mangoApi = {
  getUsersCandidates: async (): Promise<MangoUsersCandidatesResponse> => {
    const { data } = await api.get<MangoUsersCandidatesResponse>(
      "/integrations/mango/users/candidates",
    );
    return data;
  },

  linkUser: async (
    mangoUserId: number,
    payload: LinkMangoUserPayload,
  ): Promise<LinkMangoUserResponse> => {
    assertRequestCooldown(`mango:link:${mangoUserId}`, 800);
    const { data } = await api.patch<LinkMangoUserResponse>(
      `/integrations/mango/users/${mangoUserId}/link`,
      payload,
    );
    return data;
  },

  sync: async (payload: MangoSyncPayload): Promise<MangoSyncResponse> => {
    assertRequestCooldown("mango:sync", 1500);
    const syncTimeoutMs = Number(
      import.meta.env.VITE_MANGO_SYNC_TIMEOUT ?? 30 * 60 * 1000,
    );
    const { data } = await api.post<MangoSyncResponse>(
      "/integrations/mango/sync",
      payload,
      { timeout: syncTimeoutMs },
    );
    return data;
  },

  refreshUsers: async (): Promise<MangoRefreshUsersResponse> => {
    assertRequestCooldown("mango:refresh-users", 1200);
    const { data } = await api.post<MangoRefreshUsersResponse>(
      "/integrations/mango/sync/users/refresh",
    );
    return data;
  },
};
