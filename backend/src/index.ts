import { Elysia } from "elysia";
import { userPlugin } from "./plugins/user";
import { getDbConnection } from "./database/service";
import { errorHandler } from "./plugins/errors";
import UserService from "./plugins/user/service";
import authPlugin from "./plugins/auth";

async function bootstrapServer() {
    const db = getDbConnection(Bun.env.DATABASE_URL!);
    const userService = new UserService(db);
    const app = new Elysia()
        .use(errorHandler)
        .get("/health", () => {
            return { status: "ok" };
        })
        .use(authPlugin(userService))
        .use(userPlugin(userService))
        .listen(3000);
    console.log(
        `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
    );
}

bootstrapServer();
