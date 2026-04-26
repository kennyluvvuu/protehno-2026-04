export type RecordStatus =
  | "uploaded"
  | "queued"
  | "processing"
  | "done"
  | "failed"
  | "not_applicable";
export type IngestionStatus =
  | "ready"
  | "pending_audio"
  | "downloading"
  | "no_audio"
  | "failed";
export type RecordSource = "manual" | "mango";
export type DirectionKind = "inbound" | "outbound" | "unknown";

export interface CheckboxItem {
  label: string;
  checked: boolean;
}

export interface Checkboxes {
  tasks: CheckboxItem[];
  promises: CheckboxItem[];
  agreements: CheckboxItem[];
}

export interface Record {
  id: number;
  userId: number | null;
  source: RecordSource;
  ingestionStatus?: IngestionStatus;
  ingestionError?: string | null;
  mangoEntryId?: string | null;
  mangoCallId?: string | null;
  mangoRecordingId?: string | null;
  mangoCommunicationId?: string | null;
  mangoUserId?: number | null;
  direction?: string | null;
  directionKind?: DirectionKind | null;
  callerNumber?: string | null;
  calleeNumber?: string | null;
  lineNumber?: string | null;
  extension?: string | null;
  callStartedAt?: string | null;
  callAnsweredAt?: string | null;
  callEndedAt?: string | null;
  talkDurationSec?: number | null;
  isMissed?: boolean;
  hasAudio?: boolean;
  callTo: string | null;
  title: string | null;
  durationSec: number | null;
  qualityScore?: number | null;
  fileUri: string | null;
  transcription: string | null;
  summary: string | null;
  status: RecordStatus;
  error: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  checkboxes: Checkboxes | null;
  tags: string[];
}

export interface UploadResponse {
  id: number;
  userId: number;
  fileUri: string;
  status: RecordStatus;
  message: string;
}

export type SortField = "title" | "callTo" | "durationSec" | "startedAt";
export type SortDir = "asc" | "desc";
