import type { AxiosError } from "axios"
import { useAuthStore } from "~/stores/useAuthStore"
import { api } from "./axios-client"

const handleAuthFailure = (): void => {
    useAuthStore.getState().reset()
    if (typeof window !== "undefined" && window.location.pathname !== "/login") {
        window.location.assign("/login")
    }
}

api.interceptors.response.use(
    (res) => res,
    (error: AxiosError) => {
        if (error.response?.status === 401) {
            handleAuthFailure()
        }
        return Promise.reject(error)
    },
)
