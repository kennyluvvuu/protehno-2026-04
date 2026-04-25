export type RecordStatus = "uploaded" | "queued" | "processing" | "done" | "failed" | "not_applicable"
export type IngestionStatus = "ready" | "pending_audio" | "downloading" | "no_audio" | "failed"
export type RecordSource = "manual" | "mango"

export interface Checkboxes {
    tasks: string[]
    promises: string[]
    agreements: string[]
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
    // Mango-only fields
    ingestionStatus?: IngestionStatus
    ingestionError?: string | null
    mangoEntryId?: number | null
    mangoCallId?: number | null
    mangoUserId?: number | null
    direction?: string | null
    callerNumber?: string | null
    calleeNumber?: string | null
    callStartedAt?: string | null
    callAnsweredAt?: string | null
    callEndedAt?: string | null
    talkDurationSec?: number | null
    isMissed?: boolean
    hasAudio?: boolean
}

export type SortField = "title" | "callTo" | "durationSec" | "startedAt"
export type SortDir = "asc" | "desc"
