// app/lib/axios-interceptors.ts
import type { AxiosError, InternalAxiosRequestConfig } from "axios"
import { useAuthStore } from "~/stores/useAuthStore"
import { api, refreshClient } from "./axios-client"

interface RetriableConfig extends InternalAxiosRequestConfig {
    _retry?: boolean
}

let refreshPromise: Promise<void> | null = null

const refreshSession = async (): Promise<void> => {
    await refreshClient.post("/auth/refresh")
}

const handleAuthFailure = (): void => {
    useAuthStore.getState().reset()
    if (typeof window !== "undefined" && window.location.pathname !== "/login") {
        window.location.assign("/login")
    }
}

api.interceptors.response.use(
    (res) => res,
    async (error: AxiosError) => {
        const original = error.config as RetriableConfig | undefined
        const status = error.response?.status

        if (status !== 401 || !original || original._retry) {
            return Promise.reject(error)
        }

        original._retry = true

        try {
            refreshPromise ??= refreshSession().finally(() => {
                refreshPromise = null
            })
            await refreshPromise
            return api(original)
        } catch (refreshError) {
            handleAuthFailure()
            return Promise.reject(refreshError)
        }
    },
)
