import { api } from "~/lib/axios-client";
import type { User } from "~/types/auth";

export interface CreateUserPayload {
  name: string;
  email: string;
  password: string;
  role: "manager";
  fio?: string | null;
  mangoUserId?: number | null;
}

export interface UpdateUserPayload {
  name?: string;
  fio?: string | null;
  email?: string;
  mangoUserId?: number | null;
  role?: "director" | "manager";
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
    const { data } = await api.post<User>("/users/register", payload);
    return data;
  },

  update: async (id: number, payload: UpdateUserPayload): Promise<User> => {
    const { data } = await api.patch<User>(`/users/${id}`, payload);
    return data;
  },

  remove: async (id: number): Promise<{ message: string }> => {
    const { data } = await api.delete<{ message: string }>(`/users/${id}`);
    return data;
  },

  setOwnMangoUserId: async (mangoUserId: number | null): Promise<User> => {
    const { data } = await api.patch<User>("/users/me/mango-user-id", {
      mangoUserId,
    });
    return data;
  },

  getByMangoUserId: async (mangoUserId: number): Promise<User> => {
    const { data } = await api.get<User>(`/users/mango/${mangoUserId}`);
    return data;
  },
};
