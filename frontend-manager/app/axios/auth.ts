import { api } from "~/lib/axios-client"
import type { LoginCredentials, RegisterPayload, User } from "~/types/auth"

export const authApi = {
    register: async (payload: RegisterPayload): Promise<User> => {
        const { data } = await api.post<User>("/users/register", payload)
        return data
    },
    login: async (credentials: LoginCredentials): Promise<User> => {
        const { data } = await api.post<User>("/login", credentials)
        return data
    },
    logout: async (): Promise<void> => {
        await api.post("/logout")
    },
    me: async (cookie?: string): Promise<User> => {
        const { data } = await api.get<User>("/users/me", {
            headers: cookie ? { cookie } : undefined,
        })
        return data
    },
}
