import { z } from "zod"

export const createUserSchema = z.object({
    name: z
        .string()
        .trim()
        .min(2, { message: "Минимум 2 символа" }),
    email: z
        .string()
        .trim()
        .email({ message: "Некорректный email" }),
    password: z
        .string()
        .min(6, { message: "Минимум 6 символов" }),
})

export type CreateUserSchema = z.infer<typeof createUserSchema>
