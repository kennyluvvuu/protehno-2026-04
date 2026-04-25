export type RecordStatus = "uploaded" | "queued" | "processing" | "done" | "failed" | "not_applicable"
export type IngestionStatus = "ready" | "pending_audio" | "downloading" | "no_audio" | "failed"
export type RecordSource = "manual" | "mango"

export interface CheckboxItem {
    label: string
    checked: boolean
}

export interface Checkboxes {
    tasks: CheckboxItem[]
    promises: CheckboxItem[]
    agreements: CheckboxItem[]
}

export interface Record {
    id: number
    userId: number | null
    source: RecordSource
    callTo: string | null
    title: string | null
    durationSec: number | null
    fileUri: string | null
    transcription: string | null
    summary: string | null
    status: RecordStatus
    error: string | null
    startedAt: string | null
    finishedAt: string | null
    checkboxes: Checkboxes | null
    tags: string[]
    ingestionStatus?: IngestionStatus
    ingestionError?: string | null
    callerNumber?: string | null
    calleeNumber?: string | null
    callStartedAt?: string | null
    talkDurationSec?: number | null
    isMissed?: boolean
    hasAudio?: boolean
}

export interface UploadResponse {
    id: number
    userId: number
    fileUri: string
    status: RecordStatus
    message: string
}

export type SortField = "title" | "callTo" | "durationSec" | "startedAt"
export type SortDir = "asc" | "desc"
