import { api } from "~/lib/axios-client"
import type { Record } from "~/types/record"

export const recordsApi = {
    getFeed: async (): Promise<Record[]> => {
        const { data } = await api.get<Record[]>("/records/feed")
        return data
    },
    getById: async (id: number): Promise<Record> => {
        const { data } = await api.get<Record>(`/records/${id}`)
        return data
    },
}
