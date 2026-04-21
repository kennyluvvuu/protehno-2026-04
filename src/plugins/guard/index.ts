import bearer from "@elysiajs/bearer";
import jwt from "@elysiajs/jwt";
import Elysia from "elysia";

export const guardPlugin = () =>
    new Elysia()
        .use(
            jwt({
                name: "jwt",
                secret: Bun.env.JWT_SECRET!,
            }),
        )
        .use(bearer())
        .derive({ as: "global" }, async ({ jwt, bearer, status }) => {
            if (!bearer) {
                return status(401, { message: "Unauthorized" });
            }
            const decoded = await jwt.verify(bearer);
            if (!decoded) {
                return status(401, { message: "Unauthorized" });
            }
            return {
                userId: decoded.id as number,
            };
        });
