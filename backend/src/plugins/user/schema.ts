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
        role: userRoleSchema,
        fio: fioSchema.optional().nullable(),
    });
export type CreateUser = z.infer<typeof createUserSchema>;

export const updateUserByDirectorSchema = z.object({
    name: z.string().min(1).optional(),
    fio: fioSchema.nullable().optional(),
    email: z.string().email().optional(),
    mangoUserId: z.number().int().positive().nullable().optional(),
    role: userRoleSchema.optional(),
});
export type UpdateUserPayload = z.infer<typeof updateUserByDirectorSchema>;

export const getUserSchema = createSelectSchema(userTable)
    .omit({
        password_hash: true,
    })
    .extend({
        role: userRoleSchema,
        fio: fioSchema.nullable(),
    });
export type GetUser = z.infer<typeof getUserSchema>;
