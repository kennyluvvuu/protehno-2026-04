export interface Record {
    id: number
    userId: number
    callTo: string | null
    durationSec: number | null
    fileUri: string
    transcription: string | null
    summary: string | null
}

export type SortField = "name" | "callTo" | "durationSec" | "id"
export type SortDir = "asc" | "desc"
