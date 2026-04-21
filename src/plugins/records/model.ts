import { integer, pgTable, text } from "drizzle-orm/pg-core";
import { userTable } from "../user/model";

export const recordTable = pgTable("records", {
    id: integer("id").primaryKey(),
    userId: integer("user_id")
        .notNull()
        .references(() => userTable.id, { onDelete: "cascade" }),
    callTo: text("call_to").notNull(),
    durationSec: integer("duration_sec").notNull(),
    fileUri: text("file_uri"),
    transcription: text("transcription"),
    summary: text("summary"),
});
