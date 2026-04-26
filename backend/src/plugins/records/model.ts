import {
    boolean,
    integer,
    pgTable,
    text,
    timestamp,
    jsonb,
} from "drizzle-orm/pg-core";
import { userTable } from "../user/model";

export const recordTable = pgTable("records", {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),

    // --- OWNERSHIP ---
    // nullable: Mango records are not owned by a platform user
    userId: integer("user_id").references(() => userTable.id, {
        onDelete: "set null",
    }),

    // --- SOURCE ---
    // "manual" = uploaded by a user via POST /records/upload
    // "mango"  = ingested from Mango Office VPBX webhook
    source: text("source").notNull().default("manual"),

    // --- INGESTION LIFECYCLE (Mango-specific, not relevant for manual uploads) ---
    // "ready"         — audio is available in storage (all manual uploads start here)
    // "pending_audio" — Mango call recorded, waiting for recording_id via record/added event
    // "downloading"   — actively downloading audio from Mango API
    // "no_audio"      — call exists but has no recording (missed call, etc.)
    // "failed"        — ingestion failed (download error, etc.)
    ingestionStatus: text("ingestion_status").notNull().default("ready"),
    ingestionError: text("ingestion_error"),

    // --- MANGO EXTERNAL IDENTIFIERS ---
    mangoEntryId: text("mango_entry_id"), // entry_id — main Mango call identifier
    mangoCallId: text("mango_call_id"), // call_id — specific call leg identifier
    mangoRecordingId: text("mango_recording_id"), // recording_id — audio file identifier
    mangoCommunicationId: text("mango_communication_id"), // for Mango speech API (future)
    mangoUserId: integer("mango_user_id"), // Mango employee user_id from events

    // --- CALL METADATA ---
    // Legacy normalized direction value kept for compatibility
    // "inbound" | "outbound" | "unknown"
    direction: text("direction"),
    // Explicit direction kind from Mango directional flags
    // "inbound" | "outbound" | "unknown"
    directionKind: text("direction_kind"),
    callerNumber: text("caller_number"), // phone number of caller
    calleeNumber: text("callee_number"), // phone number of callee
    lineNumber: text("line_number"), // Mango line/DID number
    extension: text("extension"), // internal extension number

    // --- CALL TIMESTAMPS ---
    callStartedAt: timestamp("call_started_at"), // when call was initiated
    callAnsweredAt: timestamp("call_answered_at"), // when call was answered (null if missed)
    callEndedAt: timestamp("call_ended_at"), // when call ended

    // --- CALL DURATION ---
    // separate from durationSec (which is audio/file duration from AI)
    talkDurationSec: integer("talk_duration_sec"), // seconds of actual conversation

    // --- CALL FLAGS ---
    isMissed: boolean("is_missed").notNull().default(false),
    hasAudio: boolean("has_audio").notNull().default(true),

    // --- EXISTING COLUMNS (unchanged semantics) ---
    callTo: text("call_to"),
    title: text("title"),
    durationSec: integer("duration_sec"), // filled by AI from audio analysis
    qualityScore: integer("quality_score"), // AI-derived call quality score from 0 to 100
    // fileUri is now nullable — missed calls and pre-download Mango records have no file
    fileUri: text("file_uri"),
    transcription: text("transcription"),
    summary: text("summary"),
    // AI processing status
    // "uploaded" | "queued" | "processing" | "done" | "failed" | "not_applicable"
    // "not_applicable" is used for missed calls with no audio to process
    status: text("status").notNull().default("uploaded"),
    error: text("error"),
    startedAt: timestamp("started_at"),
    finishedAt: timestamp("finished_at"),
    checkboxes: jsonb("checkboxes"),
});

export const tagsTable = pgTable("tags", {
    id: integer("id").primaryKey(),
    recordId: integer("record_id")
        .notNull()
        .references(() => recordTable.id, { onDelete: "cascade" }),
    tag: text("tag").notNull(),
});
