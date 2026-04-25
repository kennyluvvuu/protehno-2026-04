import { z } from "zod"

export const loginSchema = z.object({
    name: z
    .string({ error: "Должна быть строка" })
    .trim()
    .min(3, { error: "Должна быть не меньше 3 символов" }),
    password: z
    .string({ error: "Должна быть строка" })
    .trim()
    .min(3, { error: "Должна быть не меньше 3 символов" }),
})

export type LoginSchema = z.infer<typeof loginSchema>