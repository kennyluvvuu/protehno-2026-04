import jwt from "@elysiajs/jwt";
import Elysia from "elysia";
import UserService from "../user/service";
import type { GetUser } from "../user/schema";

export type UserRole = "director" | "manager";

export type GuardContextUser = Pick<GetUser, "id" | "role">;

type JwtPayload = {
    id?: number;
    role?: string;
};

export const guardPlugin = (userService: UserService) =>
    new Elysia()
        .use(
            jwt({
                name: "jwt",
                secret: Bun.env.JWT_SECRET!,
            }),
        )
        .derive({ as: "global" }, async ({ jwt, cookie, request, status }) => {
            const serviceApiKey = Bun.env.SERVICE_API_KEY?.trim();
            const requestApiKey = request.headers.get("x-api-key")?.trim();

            if (
                typeof serviceApiKey === "string" &&
                serviceApiKey.length > 0 &&
                requestApiKey === serviceApiKey
            ) {
                const users = await userService.getAllUsers();
                const director = users.find((user) => user.role === "director");

                if (!director) {
                    return status(500, {
                        message:
                            "Service auth failed: no director user available",
                    });
                }

                const currentUser: GuardContextUser = {
                    id: director.id,
                    role: "director",
                };

                return {
                    userId: currentUser.id,
                    userRole: currentUser.role,
                    currentUser,
                };
            }

            const token = cookie.auth?.value;

            if (typeof token !== "string" || token.length === 0) {
                return status(401, { message: "Unauthorized" });
            }

            const decoded = (await jwt.verify(token)) as JwtPayload | false;

            if (!decoded || typeof decoded.id !== "number") {
                return status(401, { message: "Unauthorized" });
            }

            const user = await userService.getUserById(decoded.id);

            if (!user) {
                return status(401, { message: "Unauthorized" });
            }

            const currentUser: GuardContextUser = {
                id: user.id,
                role: user.role as UserRole,
            };

            return {
                userId: currentUser.id,
                userRole: currentUser.role,
                currentUser,
            };
        });
