import Elysia, { NotFoundError } from "elysia";
import {
    createMangoLocalUserSchema,
    createUserSchema,
    resetUserPasswordSchema,
    updateUserByDirectorSchema,
} from "./schema";
import UserService from "./service";
import z from "zod";
import { guardPlugin, type UserRole } from "../guard";
import RecordService from "../records/service";

const userLog = (...args: unknown[]) => console.log("[user]", ...args);

type ProtectedUserContext = {
    userId: number;
    userRole: UserRole;
    set: {
        status?: number | string;
    };
};

const assertDirector = (userRole: UserRole) => {
    return userRole === "director";
};

const userParamsSchema = z.object({ id: z.coerce.number().int().positive() });

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

                const user = await userService.createUser({
                    ...body,
                    role: "manager",
                });

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
        .use(guardPlugin(userService))
        .post(
            "/mango/create-local-user",
            async ({
                userService,
                body,
                request,
                userId,
                userRole,
                set,
            }: {
                userService: UserService;
                body: z.infer<typeof createMangoLocalUserSchema>;
                request: Request;
            } & ProtectedUserContext) => {
                if (!assertDirector(userRole)) {
                    set.status = 403;
                    return { message: "Forbidden" };
                }

                userLog("create local user from mango", {
                    method: request.method,
                    path: new URL(request.url).pathname,
                    actorUserId: userId,
                    mangoUserId: body.mangoUserId,
                    email: body.email,
                });

                const createdUser =
                    await userService.createUserByDirector(body);

                const linkedCount =
                    await recordService.assignUnownedMangoRecordsToUser(
                        body.mangoUserId,
                        createdUser.id,
                    );

                return {
                    ...createdUser,
                    linkedCount,
                };
            },
            {
                body: createMangoLocalUserSchema,
            },
        )
        .get(
            "/",
            async (context: { userService: UserService; request: Request }) => {
                const { userService, request } = context;
                const { userId, userRole, set } = context as typeof context &
                    ProtectedUserContext;

                if (!assertDirector(userRole)) {
                    set.status = 403;
                    return { message: "Forbidden" };
                }

                userLog("get users", {
                    method: request.method,
                    path: new URL(request.url).pathname,
                    userId,
                });

                return await userService.getAllUsers();
            },
        )
        .get(
            "/:id",
            async ({
                userService,
                params: { id },
                request,
                userId,
                userRole,
                set,
            }: {
                userService: UserService;
                params: { id: number };
                request: Request;
            } & ProtectedUserContext) => {
                if (!assertDirector(userRole)) {
                    set.status = 403;
                    return { message: "Forbidden" };
                }

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
                params: userParamsSchema,
            },
        )
        .patch(
            "/:id",
            async ({
                userService,
                params: { id },
                body,
                request,
                userId,
                userRole,
                set,
            }: {
                userService: UserService;
                params: { id: number };
                body: z.infer<typeof updateUserByDirectorSchema>;
                request: Request;
            } & ProtectedUserContext) => {
                if (!assertDirector(userRole)) {
                    set.status = 403;
                    return { message: "Forbidden" };
                }

                userLog("update user by director", {
                    method: request.method,
                    path: new URL(request.url).pathname,
                    actorUserId: userId,
                    targetUserId: id,
                    body,
                });

                const existingUser = await userService.getUserById(id);

                if (!existingUser) {
                    userLog("user not found for update", { id });
                    throw new NotFoundError("User not found");
                }

                const nextRole = body.role ?? existingUser.role;

                if (
                    existingUser.role === "director" &&
                    nextRole !== "director"
                ) {
                    const allUsers = await userService.getAllUsers();
                    const directorsCount = allUsers.filter(
                        (user) => user.role === "director",
                    ).length;

                    if (directorsCount <= 1) {
                        set.status = 400;
                        return {
                            message:
                                "Cannot remove the last director role from the system",
                        };
                    }
                }

                const updatedUser = await userService.updateUser(id, {
                    name: body.name,
                    fio: body.fio === undefined ? undefined : body.fio,
                    email: body.email,
                    mangoUserId:
                        body.mangoUserId === undefined
                            ? undefined
                            : body.mangoUserId,
                    mangoLogin:
                        body.mangoLogin === undefined
                            ? undefined
                            : body.mangoLogin,
                    mangoExtension:
                        body.mangoExtension === undefined
                            ? undefined
                            : body.mangoExtension,
                    mangoPosition:
                        body.mangoPosition === undefined
                            ? undefined
                            : body.mangoPosition,
                    mangoDepartment:
                        body.mangoDepartment === undefined
                            ? undefined
                            : body.mangoDepartment,
                    mangoMobile:
                        body.mangoMobile === undefined
                            ? undefined
                            : body.mangoMobile,
                    mangoOutgoingLine:
                        body.mangoOutgoingLine === undefined
                            ? undefined
                            : body.mangoOutgoingLine,
                    mangoAccessRoleId:
                        body.mangoAccessRoleId === undefined
                            ? undefined
                            : body.mangoAccessRoleId,
                    mangoGroups:
                        body.mangoGroups === undefined
                            ? undefined
                            : body.mangoGroups,
                    mangoSips:
                        body.mangoSips === undefined
                            ? undefined
                            : body.mangoSips,
                    mangoTelephonyNumbers:
                        body.mangoTelephonyNumbers === undefined
                            ? undefined
                            : body.mangoTelephonyNumbers,
                    role: body.role,
                });

                return updatedUser;
            },
            {
                params: userParamsSchema,
                body: updateUserByDirectorSchema,
            },
        )
        .delete(
            "/:id",
            async ({
                userService,
                params: { id },
                request,
                userId,
                userRole,
                set,
            }: {
                userService: UserService;
                params: { id: number };
                request: Request;
            } & ProtectedUserContext) => {
                if (!assertDirector(userRole)) {
                    set.status = 403;
                    return { message: "Forbidden" };
                }

                userLog("delete user by director", {
                    method: request.method,
                    path: new URL(request.url).pathname,
                    actorUserId: userId,
                    targetUserId: id,
                });

                const existingUser = await userService.getUserById(id);

                if (!existingUser) {
                    userLog("user not found for delete", { id });
                    throw new NotFoundError("User not found");
                }

                if (existingUser.id === userId) {
                    set.status = 400;
                    return {
                        message: "Director cannot delete themselves",
                    };
                }

                if (existingUser.role === "director") {
                    const allUsers = await userService.getAllUsers();
                    const directorsCount = allUsers.filter(
                        (user) => user.role === "director",
                    ).length;

                    if (directorsCount <= 1) {
                        set.status = 400;
                        return {
                            message: "Cannot delete the last director",
                        };
                    }
                }

                await userService.deleteUser(id);

                return {
                    message: "User deleted",
                };
            },
            {
                params: userParamsSchema,
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
        .get(
            "/mango/:mangoUserId",
            async ({ params, userService, set }) => {
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
            },
            {
                params: z.object({
                    mangoUserId: z.coerce.number().int().positive(),
                }),
            },
        )
        .patch(
            "/:id/reset-password",
            async ({
                userService,
                params: { id },
                body,
                request,
                userId,
                userRole,
                set,
            }: {
                userService: UserService;
                params: { id: number };
                body: z.infer<typeof resetUserPasswordSchema>;
                request: Request;
            } & ProtectedUserContext) => {
                if (!assertDirector(userRole)) {
                    set.status = 403;
                    return { message: "Forbidden" };
                }

                userLog("reset user password by director", {
                    method: request.method,
                    path: new URL(request.url).pathname,
                    actorUserId: userId,
                    targetUserId: id,
                });

                const existingUser = await userService.getUserById(id);

                if (!existingUser) {
                    userLog("user not found for password reset", { id });
                    throw new NotFoundError("User not found");
                }

                return await userService.resetUserPassword(id, body);
            },
            {
                params: userParamsSchema,
                body: resetUserPasswordSchema,
            },
        );
