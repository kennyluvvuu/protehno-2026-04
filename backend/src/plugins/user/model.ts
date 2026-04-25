import { integer, pgTable, text } from "drizzle-orm/pg-core";

export const userTable = pgTable("users", {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    name: text().notNull(),
    fio: text(),
    role: text().notNull(),
    email: text().unique().notNull(),
    mangoUserId: integer("mango_user_id").unique(),
    password_hash: text().notNull(),
});
