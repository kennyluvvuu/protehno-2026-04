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

export interface CreateUserPayload {
  name: string;
  email: string;
  password: string;
  role: "manager";
  fio?: string | null;
  mangoUserId?: number | null;
}

export interface CreateUserFromMangoPayload {
  name: string;
  fio?: string | null;
  email: string;
  password?: string;
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

export interface UpdateUserPayload {
  name?: string;
  fio?: string | null;
  email?: string;
  mangoUserId?: number | null;
  role?: "director" | "manager";
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

export const usersApi = {
  getAll: async (): Promise<User[]> => {
    const { data } = await api.get<User[]>("/users");
    return data;
  },

  getById: async (id: number): Promise<User> => {
    const { data } = await api.get<User>(`/users/${id}`);
    return data;
  },

  create: async (payload: CreateUserPayload): Promise<User> => {
    assertRequestCooldown("users:create", 1000);
    const { data } = await api.post<User>("/users/register", payload);
    return data;
  },

  update: async (id: number, payload: UpdateUserPayload): Promise<User> => {
    assertRequestCooldown(`users:update:${id}`, 800);
    const { data } = await api.patch<User>(`/users/${id}`, payload);
    return data;
  },

  createFromMango: async (
    payload: CreateUserFromMangoPayload,
  ): Promise<User> => {
    const requestKey =
      payload.mangoUserId != null
        ? `users:create-from-mango:${payload.mangoUserId}`
        : "users:create-from-mango";
    assertRequestCooldown(requestKey, 1000);
    const { data } = await api.post<User>(
      "/users/mango/create-local-user",
      payload,
    );
    return data;
  },

  remove: async (id: number): Promise<{ message: string }> => {
    assertRequestCooldown(`users:remove:${id}`, 800);
    const { data } = await api.delete<{ message: string }>(`/users/${id}`);
    return data;
  },

  setOwnMangoUserId: async (mangoUserId: number | null): Promise<User> => {
    assertRequestCooldown("users:set-own-mango-id", 800);
    const { data } = await api.patch<User>("/users/me/mango-user-id", {
      mangoUserId,
    });
    return data;
  },

  getByMangoUserId: async (mangoUserId: number): Promise<User> => {
    const { data } = await api.get<User>(`/users/mango/${mangoUserId}`);
    return data;
  },

  resetPassword: async (
    id: number,
    password: string,
  ): Promise<{ message?: string; ok?: boolean }> => {
    assertRequestCooldown(`users:reset-password:${id}`, 800);
    const { data } = await api.patch<{ message?: string; ok?: boolean }>(
      `/users/${id}/reset-password`,
      { password },
    );
    return data;
  },
};
