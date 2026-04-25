import { z } from "zod"

export const loginSchema = z.object({
    email: z
        .string({ error: "Должна быть строка" })
        .trim()
        .email({ error: "Некорректный email" }),
    password: z
        .string({ error: "Должна быть строка" })
        .min(3, { error: "Должна быть не меньше 3 символов" }),
})

export type LoginSchema = z.infer<typeof loginSchema>

export const registerSchema = z.object({
    name: z
        .string({ error: "Должна быть строка" })
        .trim()
        .min(2, { error: "Должна быть не меньше 2 символов" }),
    email: z
        .string({ error: "Должна быть строка" })
        .trim()
        .email({ error: "Некорректный email" }),
    password: z
        .string({ error: "Должна быть строка" })
        .min(3, { error: "Должна быть не меньше 3 символов" }),
})

export type RegisterSchema = z.infer<typeof registerSchema>
