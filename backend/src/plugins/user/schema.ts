import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { userTable } from "./model";

const userRoleSchema = z.enum(["director", "manager"]);
const fioSchema = z.string().min(1);
const passwordSchema = z.string().min(8);
const emailSchema = z.string().email();
const mangoStringSchema = z.string().min(1);
const mangoGroupsSchema = z.array(z.number().int());
const mangoStringArraySchema = z.array(z.string().min(1));
const mangoTelephonyNumberSchema = z.object({
    number: z.string().min(1),
    protocol: z.string().min(1).optional(),
    order: z.number().int().optional(),
    wait_sec: z.number().int().optional(),
    status: z.string().min(1).optional(),
});

export const baseUserSchema = createSelectSchema(userTable);
export type BaseUser = z.infer<typeof baseUserSchema>;

export const createUserSchema = createInsertSchema(userTable)
    .omit({
        password_hash: true,
    })
    .extend({
        password: passwordSchema,
        role: userRoleSchema,
        fio: fioSchema.optional().nullable(),
    });
export type CreateUser = z.infer<typeof createUserSchema>;

export const createMangoLocalUserSchema = z.object({
    name: z.string().min(1),
    fio: fioSchema.nullable().optional(),
    email: emailSchema,
    role: userRoleSchema.default("manager"),
    mangoUserId: z.number().int().positive(),
    mangoLogin: mangoStringSchema.nullable().optional(),
    mangoExtension: mangoStringSchema.nullable().optional(),
    mangoPosition: mangoStringSchema.nullable().optional(),
    mangoDepartment: mangoStringSchema.nullable().optional(),
    mangoMobile: mangoStringSchema.nullable().optional(),
    mangoOutgoingLine: mangoStringSchema.nullable().optional(),
    mangoAccessRoleId: z.number().int().nullable().optional(),
    mangoGroups: mangoGroupsSchema.nullable().optional(),
    mangoSips: mangoStringArraySchema.nullable().optional(),
    mangoTelephonyNumbers: z
        .array(mangoTelephonyNumberSchema)
        .nullable()
        .optional(),
    password: passwordSchema,
});
export type CreateMangoLocalUser = z.infer<typeof createMangoLocalUserSchema>;

export const updateUserByDirectorSchema = z.object({
    name: z.string().min(1).optional(),
    fio: fioSchema.nullable().optional(),
    email: emailSchema.optional(),
    mangoUserId: z.number().int().positive().nullable().optional(),
    mangoLogin: mangoStringSchema.nullable().optional(),
    mangoExtension: mangoStringSchema.nullable().optional(),
    mangoPosition: mangoStringSchema.nullable().optional(),
    mangoDepartment: mangoStringSchema.nullable().optional(),
    mangoMobile: mangoStringSchema.nullable().optional(),
    mangoOutgoingLine: mangoStringSchema.nullable().optional(),
    mangoAccessRoleId: z.number().int().nullable().optional(),
    mangoGroups: mangoGroupsSchema.nullable().optional(),
    mangoSips: mangoStringArraySchema.nullable().optional(),
    mangoTelephonyNumbers: z
        .array(mangoTelephonyNumberSchema)
        .nullable()
        .optional(),
    role: userRoleSchema.optional(),
});
export type UpdateUserPayload = z.infer<typeof updateUserByDirectorSchema>;

export const resetUserPasswordSchema = z.object({
    password: passwordSchema,
});
export type ResetUserPasswordPayload = z.infer<typeof resetUserPasswordSchema>;

export const getUserSchema = createSelectSchema(userTable)
    .omit({
        password_hash: true,
    })
    .extend({
        role: userRoleSchema,
        fio: fioSchema.nullable(),
        mangoLogin: z.string().nullable().optional(),
        mangoExtension: z.string().nullable().optional(),
        mangoPosition: z.string().nullable().optional(),
        mangoDepartment: z.string().nullable().optional(),
        mangoMobile: z.string().nullable().optional(),
        mangoOutgoingLine: z.string().nullable().optional(),
        mangoAccessRoleId: z.number().int().nullable().optional(),
        mangoGroups: mangoGroupsSchema.nullable().optional(),
        mangoSips: mangoStringArraySchema.nullable().optional(),
        mangoTelephonyNumbers: z
            .array(mangoTelephonyNumberSchema)
            .nullable()
            .optional(),
    });
export type GetUser = z.infer<typeof getUserSchema>;
