import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { recordTable } from "./model";
import z from "zod";
import { t, Static } from "elysia";

export const getRecordSchema = createSelectSchema(recordTable);
export type GetRecord = z.infer<typeof getRecordSchema>;

export const createRecordSchema = createInsertSchema(recordTable);
export type CreateRecord = z.infer<typeof createRecordSchema>;

export const uploadRecordSchema = t.Object({
    file: t.File({ filetype: "audio/*" }),
    userId: t.Number(),
    callTo: t.String(),
});
export type UploadRecord = Static<typeof uploadRecordSchema>;
