import { api } from "~/lib/axios-client";
import type { User } from "~/types/auth";

export interface CreateUserPayload {
  name: string;
  email: string;
  password: string;
  role: "manager";
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
};
