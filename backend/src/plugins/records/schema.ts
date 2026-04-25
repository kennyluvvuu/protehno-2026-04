import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { recordTable } from "./model";
import z from "zod";
import { t, Static } from "elysia";

// --- EXISTING SCHEMAS (unchanged) ---

// IMPORTANT: "not_applicable" is added for missed calls that have no audio to process
export const aiRecordStatusSchema = z.enum([
    "uploaded",
    "queued",
    "processing",
    "done",
    "failed",
    "not_applicable",
]);
export type AiRecordStatus = z.infer<typeof aiRecordStatusSchema>;

export const aiCheckboxItemSchema = z.object({
    label: z.string(),
    checked: z.boolean(),
});
export type AiCheckboxItem = z.infer<typeof aiCheckboxItemSchema>;

export const aiCheckboxGroupsSchema = z.object({
    tasks: z.array(aiCheckboxItemSchema),
    promises: z.array(aiCheckboxItemSchema),
    agreements: z.array(aiCheckboxItemSchema),
});
export type AiCheckboxGroups = z.infer<typeof aiCheckboxGroupsSchema>;

export const createRecordSchema = createInsertSchema(recordTable);
export type CreateRecord = z.infer<typeof createRecordSchema>;

// Extended with new optional fields — frontend safely ignores unknown fields
export const getRecordSchema = createSelectSchema(recordTable).extend({
    status: aiRecordStatusSchema,
    tags: z.array(z.string()),
    checkboxes: aiCheckboxGroupsSchema.nullable(),
    qualityScore: z.number().min(0).max(100).nullable().optional(),
    // New fields — all optional so existing frontend code is not affected
    source: z.enum(["manual", "mango"]).optional(),
    ingestionStatus: z
        .enum(["ready", "pending_audio", "downloading", "no_audio", "failed"])
        .optional(),
    mangoEntryId: z.string().nullable().optional(),
    mangoRecordingId: z.string().nullable().optional(),
    mangoUserId: z.number().nullable().optional(),
    direction: z.string().nullable().optional(),
    callerNumber: z.string().nullable().optional(),
    calleeNumber: z.string().nullable().optional(),
    isMissed: z.boolean().optional(),
    hasAudio: z.boolean().optional(),
    callStartedAt: z.date().nullable().optional(),
    callAnsweredAt: z.date().nullable().optional(),
    callEndedAt: z.date().nullable().optional(),
    talkDurationSec: z.number().nullable().optional(),
});
export type GetRecord = z.infer<typeof getRecordSchema>;

export const recordSummaryResultSchema = z.object({
    title: z.string().nullable().optional(),
    summary: z.string(),
    tags: z.array(z.string()),
    checkboxes: aiCheckboxGroupsSchema,
    qualityScore: z.number().min(0).max(100).nullable(),
});
export type RecordSummaryResult = z.infer<typeof recordSummaryResultSchema>;

export const recordProcessingResultSchema = z.object({
    transcription: z.string(),
    title: z.string().nullable().optional(),
    durationSec: z.number().int().nonnegative().nullable(),
    summary: z.string(),
    tags: z.array(z.string()),
    checkboxes: aiCheckboxGroupsSchema,
    qualityScore: z.number().min(0).max(100).nullable(),
});
export type RecordProcessingResult = z.infer<
    typeof recordProcessingResultSchema
>;

export const uploadRecordSchema = t.Object({
    file: t.File({ filetype: "audio/*" }),
    title: t.Optional(t.String()),
    callTo: t.Optional(t.String()),
});
export type UploadRecord = Static<typeof uploadRecordSchema>;

export const recordStatusResponseSchema = t.Object({
    id: t.Number(),
    userId: t.Number(),
    fileUri: t.String(),
    status: t.Union([
        t.Literal("uploaded"),
        t.Literal("queued"),
        t.Literal("processing"),
        t.Literal("done"),
        t.Literal("failed"),
    ]),
    message: t.Optional(t.String()),
});
export type RecordStatusResponse = Static<typeof recordStatusResponseSchema>;

// --- NEW SCHEMAS ---

export const recordSourceSchema = z.enum(["manual", "mango"]);
export type RecordSource = z.infer<typeof recordSourceSchema>;

export const ingestionStatusSchema = z.enum([
    "ready",
    "pending_audio",
    "downloading",
    "no_audio",
    "failed",
]);
export type IngestionStatus = z.infer<typeof ingestionStatusSchema>;

// Used by MangoIngestionService to create a call record from Mango event data
export const createMangoRecordSchema = z.object({
    mangoEntryId: z.string(),
    mangoCallId: z.string().optional(),
    mangoUserId: z.number().int().positive().optional(),
    direction: z.enum(["inbound", "outbound", "unknown"]).optional(),
    callerNumber: z.string().optional(),
    calleeNumber: z.string().optional(),
    lineNumber: z.string().optional(),
    extension: z.string().optional(),
    callStartedAt: z.date().optional(),
    callAnsweredAt: z.date().optional(),
    callEndedAt: z.date().optional(),
    talkDurationSec: z.number().optional(),
    isMissed: z.boolean().default(false),
    callTo: z.string().optional(),
    title: z.string().optional(),
});
export type CreateMangoRecord = z.infer<typeof createMangoRecordSchema>;
