import { api } from "~/lib/axios-client"

export interface HealthStatus {
    status: "ok" | "error"
}

export const healthApi = {
    check: async (): Promise<HealthStatus> => {
        const { data } = await api.get<HealthStatus>("/health")
        return data
    },
}
