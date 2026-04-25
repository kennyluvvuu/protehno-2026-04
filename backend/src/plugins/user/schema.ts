import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { userTable } from "./model";

const userRoleSchema = z.enum(["director", "manager"]);
const fioSchema = z.string().min(1);

export const baseUserSchema = createSelectSchema(userTable);
export type BaseUser = z.infer<typeof baseUserSchema>;

export const createUserSchema = createInsertSchema(userTable)
    .omit({
        password_hash: true,
    })
    .extend({
        password: z.string(),
        role: z.array(userRoleSchema).nonempty(),
        fio: fioSchema.optional().nullable(),
    });
export type CreateUser = z.infer<typeof createUserSchema>;

export const getUserSchema = createSelectSchema(userTable)
    .omit({
        password_hash: true,
    })
    .extend({
        role: z.array(userRoleSchema),
        fio: fioSchema.nullable(),
    });
export type GetUser = z.infer<typeof getUserSchema>;
