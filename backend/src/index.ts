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
import { MangoClient } from "./plugins/mango/client";
import { MangoIngestionService } from "./plugins/mango/service";
import { mangoWebhookPlugin } from "./plugins/mango/webhook";
import { mangoSyncPlugin } from "./plugins/mango/sync";
import { seedUsers } from "./seed/users";
import { statsPlugin } from "./plugins/stats";
import { StatsService } from "./plugins/stats/service";

async function bootstrapServer() {
    const db = getDbConnection(Bun.env.DATABASE_URL!);
    const userService = new UserService(db);
    const localStorage = new LocalStorage("./uploads/");
    const recordsService = new RecordService(db, localStorage);
    const aiService = new AIService();
    const statsService = new StatsService(db);

    await seedUsers(db);

    const mangoClient = new MangoClient({
        apiKey: Bun.env.MANGO_VPBX_API_KEY ?? "",
        apiSalt: Bun.env.MANGO_VPBX_API_SALT ?? "",
        baseUrl: Bun.env.MANGO_BASE_URL,
    });

    const mangoIngestionService = new MangoIngestionService(
        recordsService,
        userService,
        localStorage,
        aiService,
        mangoClient,
    );

    const app = new Elysia()
        .use(
            cors({
                origin: [
                    "http://localhost",
                    "http://manager.localhost",
                    "http://director.localhost",
                    "http://api.localhost",
                    "http://localhost:80",
                    "http://manager.localhost:80",
                    "http://director.localhost:80",
                    "http://api.localhost:80",
                    "http://localhost:8088",
                    "http://manager.localhost:8088",
                    "http://director.localhost:8088",
                    "http://api.localhost:8088",
                ],
                credentials: true,
            }),
        )
        .use(errorHandler)
        .get("/health", () => {
            return { status: "ok" };
        })
        .use(authPlugin(userService))
        .use(userPlugin(userService, recordsService))
        .use(
            recordsPlugin(recordsService, localStorage, aiService, userService),
        )
        .use(statsPlugin(statsService, userService))
        .use(mangoWebhookPlugin(mangoClient, mangoIngestionService))
        .use(
            mangoSyncPlugin(
                mangoClient,
                recordsService,
                userService,
                localStorage,
            ),
        )
        .listen(3000);

    console.log(
        `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
    );
}

bootstrapServer();
