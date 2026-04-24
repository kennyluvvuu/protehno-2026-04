import { integer, pgTable, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { userTable } from "../user/model";

export const recordTable = pgTable("records", {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    userId: integer("user_id")
        .notNull()
        .references(() => userTable.id, { onDelete: "cascade" }),
    callTo: text("call_to"),
    durationSec: integer("duration_sec"),
    fileUri: text("file_uri").notNull(),
    transcription: text("transcription"),
    summary: text("summary"),
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
