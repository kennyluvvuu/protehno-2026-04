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
        .derive({ as: "global" }, async ({ jwt, cookie, status }) => {
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
