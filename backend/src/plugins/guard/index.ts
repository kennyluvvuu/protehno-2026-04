import jwt from "@elysiajs/jwt";
import Elysia, { t } from "elysia";

export const guardPlugin = () =>
    new Elysia()
        .use(
            jwt({
                name: "jwt",
                secret: Bun.env.JWT_SECRET!,
            }),
        )
        .derive({ as: "global" }, async ({ jwt, cookie, status }) => {
            const token = cookie.auth?.value as string;

            if (!token) {
                return status(401, { message: "Unauthorized" });
            }

            const decoded = await jwt.verify(token);
            if (!decoded) {
                return status(401, { message: "Unauthorized" });
            }

            return {
                userId: decoded.id as number,
            };
        });
