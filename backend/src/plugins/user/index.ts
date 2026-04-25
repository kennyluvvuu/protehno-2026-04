import Elysia, { NotFoundError } from "elysia";
import { createUserSchema } from "./schema";
import UserService from "./service";
import z from "zod";
import { guardPlugin } from "../guard";
import RecordService from "../records/service";

const userLog = (...args: unknown[]) => console.log("[user]", ...args);

export const userPlugin = (
    userService: UserService,
    recordService: RecordService,
) =>
    new Elysia({ prefix: "/users" })
        .onRequest(({ request }) => {
            userLog(
                "incoming request",
                request.method,
                new URL(request.url).pathname,
            );
        })
        .decorate("userService", userService)
        .post(
            "/register",
            async ({ body, userService, request }) => {
                userLog("register attempt", {
                    method: request.method,
                    path: new URL(request.url).pathname,
                    body,
                });

                const user = await userService.createUser(body);

                userLog("register success", {
                    path: new URL(request.url).pathname,
                    userId: user.id,
                });

                return user;
            },
            {
                body: createUserSchema,
            },
        )
        .use(guardPlugin())
        .get("/", async ({ userService, request, userId }) => {
            userLog("get users", {
                method: request.method,
                path: new URL(request.url).pathname,
                userId,
            });

            return await userService.getAllUsers();
        })
        .get(
            "/:id",
            async ({ userService, params: { id }, request, userId }) => {
                userLog("get user by id", {
                    method: request.method,
                    path: new URL(request.url).pathname,
                    id,
                    userId,
                });

                const user = await userService.getUserById(id);
                if (!user) {
                    userLog("user not found", { id });
                    throw new NotFoundError("User not found");
                }

                return user;
            },
            {
                params: z.object({ id: z.number() }),
            },
        )
        .get("/me", async ({ userService, userId, request }) => {
            userLog("get current user", {
                method: request.method,
                path: new URL(request.url).pathname,
                userId,
            });

            return await userService.getUserById(userId);
        })
        .patch(
            "/me/mango-user-id",
            async ({ body, userService, userId, request }) => {
                userLog("set mango user id", {
                    method: request.method,
                    path: new URL(request.url).pathname,
                    userId,
                    mangoUserId: body.mangoUserId,
                });

                const user = await userService.setMangoUserId(
                    userId,
                    body.mangoUserId,
                );

                if (body.mangoUserId) {
                    const linkedCount =
                        await recordService.assignUnownedMangoRecordsToUser(
                            body.mangoUserId,
                            userId,
                        );

                    userLog("linked existing mango records", {
                        userId,
                        mangoUserId: body.mangoUserId,
                        linkedCount,
                    });
                }

                return user;
            },
            {
                body: z.object({
                    mangoUserId: z.number().int().positive().nullable(),
                }),
            },
        )
        .get("/mango/:mangoUserId", async ({ params, userService, set }) => {
            const user = await userService.getUserByMangoUserId(
                params.mangoUserId,
            );

            if (!user) {
                set.status = 404;
                return {
                    message: "User not found",
                };
            }

            return user;
        }, {
            params: z.object({
                mangoUserId: z.coerce.number().int().positive(),
            }),
        });
