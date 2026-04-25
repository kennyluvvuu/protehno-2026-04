import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { recordTable } from "./model";
import z from "zod";
import { t, Static } from "elysia";

export const aiRecordStatusSchema = z.enum([
    "uploaded",
    "queued",
    "processing",
    "done",
    "failed",
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

export const getRecordSchema = createSelectSchema(recordTable).extend({
    status: aiRecordStatusSchema,
    tags: z.array(z.string()),
    checkboxes: aiCheckboxGroupsSchema.nullable(),
});
export type GetRecord = z.infer<typeof getRecordSchema>;

export const recordSummaryResultSchema = z.object({
    title: z.string().nullable().optional(),
    summary: z.string(),
    tags: z.array(z.string()),
    checkboxes: aiCheckboxGroupsSchema,
});
export type RecordSummaryResult = z.infer<typeof recordSummaryResultSchema>;

export const recordProcessingResultSchema = z.object({
    transcription: z.string(),
    title: z.string().nullable().optional(),
    durationSec: z.number().int().nonnegative().nullable(),
    summary: z.string(),
    tags: z.array(z.string()),
    checkboxes: aiCheckboxGroupsSchema,
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
