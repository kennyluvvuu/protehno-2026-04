import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { userTable } from "./model";

export const baseUserSchema = createSelectSchema(userTable);
export type BaseUser = z.infer<typeof baseUserSchema>;

export const createUserSchema = createInsertSchema(userTable)
    .omit({
        password_hash: true,
    })
    .extend({
        password: z.string(),
    });
export type CreateUser = z.infer<typeof createUserSchema>;

export const getUserSchema = createSelectSchema(userTable).omit({
    password_hash: true,
});
export type GetUser = z.infer<typeof getUserSchema>;
