import { integer, pgTable, text } from "drizzle-orm/pg-core";

export const userTable = pgTable("users", {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    name: text().notNull(),
    email: text().unique().notNull(),
    password_hash: text().notNull(),
});
