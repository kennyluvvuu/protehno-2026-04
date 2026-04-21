import Elysia from "elysia";
import UserService from "../user/service";
import { loginSchema } from "./schema";
import jwt from "@elysiajs/jwt";

const authPlugin = (userService: UserService) =>
    new Elysia()
        .use(
            jwt({
                name: "jwt",
                secret: Bun.env.JWT_SECRET!,
            }),
        )
        .post(
            "/login",
            async ({ body: { email, password }, jwt }) => {
                const user = await userService.validateCredentials(
                    email,
                    password,
                );
                if (!user) {
                    throw new Error("Invalid credentials");
                }
                const token = await jwt.sign({ id: user.id });
                return { ...user, token: token };
            },
            {
                body: loginSchema,
            },
        );

export default authPlugin;
