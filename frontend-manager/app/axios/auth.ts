import { api } from "~/lib/axios-client"
import type { LoginCredentials, User } from "~/types/auth"

export const authApi = {
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
