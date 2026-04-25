import { api } from "~/lib/axios-client"
import { assertRequestCooldown } from "~/lib/request-guard"
import type { Record, UploadResponse } from "~/types/record"

export interface UploadPayload {
    file: File
    title?: string
    callTo?: string
}

export const recordsApi = {
    upload: async (payload: UploadPayload): Promise<UploadResponse> => {
        assertRequestCooldown("records:upload", 1500)
        const form = new FormData()
        form.append("file", payload.file)
        if (payload.title) form.append("title", payload.title)
        if (payload.callTo) form.append("callTo", payload.callTo)
        const { data } = await api.post<UploadResponse>("/records/upload", form, {
            headers: { "Content-Type": "multipart/form-data" },
        })
        return data
    },
    getFeed: async (): Promise<Record[]> => {
        const { data } = await api.get<Record[]>("/records/feed")
        return data
    },
    getById: async (id: number): Promise<Record> => {
        const { data } = await api.get<Record>(`/records/${id}`)
        return data
    },
}
