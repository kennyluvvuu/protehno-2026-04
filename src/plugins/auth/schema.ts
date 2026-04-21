import z from "zod";
import { createUserSchema } from "../user/schema";

export const loginSchema = createUserSchema.omit({
    name: true,
});
export type Login = z.infer<typeof loginSchema>;
