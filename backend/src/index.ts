import { Elysia } from "elysia";
import { userPlugin } from "./plugins/user";
import { getDbConnection } from "./database/service";
import { errorHandler } from "./plugins/errors";
import UserService from "./plugins/user/service";
import authPlugin from "./plugins/auth";
import { recordsPlugin } from "./plugins/records";
import RecordService from "./plugins/records/service";
import LocalStorage from "./storage/local";
import { cors } from "@elysiajs/cors";
import AIService from "./plugins/records/ai-service";

async function bootstrapServer() {
    const db = getDbConnection(Bun.env.DATABASE_URL!);
    const userService = new UserService(db);
    const recordsService = new RecordService(db);
    const localStorage = new LocalStorage("./uploads/");
    const aiService = new AIService();
    const app = new Elysia()
        .use(cors())
        .use(errorHandler)
        .get("/health", () => {
            return { status: "ok" };
        })
        .use(authPlugin(userService))
        .use(userPlugin(userService))
        .use(recordsPlugin(recordsService, localStorage, aiService))
        .listen(3000);
    console.log(
        `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
    );
}

bootstrapServer();
