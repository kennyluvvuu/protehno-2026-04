import { integer, jsonb, pgTable, text } from "drizzle-orm/pg-core";

export const userTable = pgTable("users", {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    name: text().notNull(),
    fio: text(),
    role: text().notNull(),
    email: text().unique().notNull(),
    mangoUserId: integer("mango_user_id").unique(),
    mangoLogin: text("mango_login"),
    mangoExtension: text("mango_extension"),
    mangoPosition: text("mango_position"),
    mangoDepartment: text("mango_department"),
    mangoMobile: text("mango_mobile"),
    mangoOutgoingLine: text("mango_outgoing_line"),
    mangoAccessRoleId: integer("mango_access_role_id"),
    mangoGroups: jsonb("mango_groups"),
    mangoSips: jsonb("mango_sips"),
    mangoTelephonyNumbers: jsonb("mango_telephony_numbers"),
    password_hash: text().notNull(),
});
