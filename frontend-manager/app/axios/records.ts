import { api } from "~/lib/axios-client"
import type { Record } from "~/types/record"

export const recordsApi = {
    upload: async (file: File): Promise<Record> => {
        const form = new FormData()
        form.append("file", file)
        const { data } = await api.post<Record>("/records/upload", form, {
            headers: { "Content-Type": "multipart/form-data" },
        })
        return data
    },
}
