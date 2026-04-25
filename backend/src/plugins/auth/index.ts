import Elysia, { t } from "elysia";
import UserService from "../user/service";
import { loginSchema } from "./schema";
import jwt from "@elysiajs/jwt";

const authLog = (...args: unknown[]) => console.log("[auth]", ...args);

const authPlugin = (userService: UserService) =>
    new Elysia({
        cookie: {
            httpOnly: true,
            path: "/",
            sameSite: "lax",
            secure: Bun.env.NODE_ENV === "production",
            maxAge: 60 * 60 * 24 * 7,
        },
    })
        .onRequest(({ request }) => {
            authLog(
                "incoming request",
                request.method,
                new URL(request.url).pathname,
            );
        })
        .use(
            jwt({
                name: "jwt",
                secret: Bun.env.JWT_SECRET!,
            }),
        )
        .post(
            "/login",
            async ({
                body: { email, password },
                jwt,
                cookie: { auth },
                request,
            }) => {
                authLog("login attempt", {
                    method: request.method,
                    path: new URL(request.url).pathname,
                    email,
                });

                const user = await userService.validateCredentials(
                    email,
                    password,
                );
                if (!user) {
                    authLog("login failed", {
                        email,
                        reason: "Invalid credentials",
                    });
                    throw new Error("Invalid credentials");
                }
                const token = await jwt.sign({ id: user.id, role: user.role });

                auth.value = token;
                auth.httpOnly = true;
                auth.path = "/";
                auth.sameSite = "lax";
                auth.secure = Bun.env.NODE_ENV === "production";
                auth.maxAge = 60 * 60 * 24 * 7;

                authLog("login success", {
                    email,
                    userId: user.id,
                    hasToken: Boolean(token),
                });

                return user;
            },
            {
                body: loginSchema,
                cookie: t.Object({
                    auth: t.Optional(t.String()),
                }),
            },
        )
        .post(
            "/logout",
            ({ cookie: { auth }, request }) => {
                authLog("logout", {
                    method: request.method,
                    path: new URL(request.url).pathname,
                    hadCookie: Boolean(auth?.value),
                });

                auth.remove();

                return { message: "Logged out" };
            },
            {
                cookie: t.Object({
                    auth: t.Optional(t.String()),
                }),
            },
        );

export default authPlugin;
