import { api } from "~/lib/axios-client";
import type { Credentials, UserData } from "~/types/auth";

export const authApi = {
    register: async (user: UserData) => api.post('/auth/register', user),
    authentication: async (credentials: Credentials) => api.post('/auth/authentication', credentials),
    logout: async () => api.get('/auth/logout')
}