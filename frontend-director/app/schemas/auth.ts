import { z } from "zod"

export const loginSchema = z.object({
    email: z
        .string()
        .trim()
        .email({ message: "Некорректный email" }),
    password: z
        .string()
        .min(3, { message: "Минимум 3 символа" }),
})

export type LoginSchema = z.infer<typeof loginSchema>
