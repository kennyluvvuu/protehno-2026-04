import Elysia, { NotFoundError } from "elysia";
import { createUserSchema } from "./schema";
import UserService from "./service";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import z from "zod";

export const userPlugin = (userService: UserService, prefix: string) =>
    new Elysia({ prefix: prefix })
        .decorate("userService", userService)
        .post(
            "/register",
            async ({ body, userService }) => {
                return await userService.createUser(body);
            },
            {
                body: createUserSchema,
            },
        )
        .get("/", async ({ userService }) => {
            return await userService.getAllUsers();
        })
        .get(
            "/:id",
            async ({ userService, params: { id } }) => {
                const user = await userService.getUserById(id);
                if (!user) throw new NotFoundError("User not found");
                return user;
            },
            {
                params: z.object({ id: z.number() }),
            },
        );
