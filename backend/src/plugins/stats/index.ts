import Elysia from "elysia";
import type { UserRole } from "../guard";
import { guardPlugin } from "../guard";
import UserService from "../user/service";
import { StatsService } from "./service";

const statsLog = (...args: unknown[]) => console.log("[stats]", ...args);

type ProtectedStatsContext = {
    userId: number;
    userRole: UserRole;
    set: {
        status?: number | string;
    };
};

const assertDirector = (
    userRole: UserRole,
    set: ProtectedStatsContext["set"],
) => {
    if (userRole !== "director") {
        set.status = 403;
        return {
            message: "Forbidden",
        };
    }

    return null;
};

export const statsPlugin = (
    statsService: StatsService,
    userService: UserService,
) =>
    new Elysia({ prefix: "/stats" })
        .onRequest(({ request }) => {
            statsLog(
                "incoming request",
                request.method,
                new URL(request.url).pathname,
            );
        })
        .use(guardPlugin(userService))
        .get(
            "/overview",
            async (context: ProtectedStatsContext & { request: Request }) => {
                const forbidden = assertDirector(context.userRole, context.set);

                if (forbidden) {
                    return forbidden;
                }

                const url = new URL(context.request.url);
                const period = url.searchParams.get("period") ?? undefined;

                statsLog("overview", {
                    method: context.request.method,
                    path: url.pathname,
                    userId: context.userId,
                    period,
                });

                return await statsService.getOverview(period);
            },
        )
        .get(
            "/weekly",
            async (context: ProtectedStatsContext & { request: Request }) => {
                const forbidden = assertDirector(context.userRole, context.set);

                if (forbidden) {
                    return forbidden;
                }

                const url = new URL(context.request.url);
                const period = url.searchParams.get("period") ?? undefined;

                statsLog("weekly", {
                    method: context.request.method,
                    path: url.pathname,
                    userId: context.userId,
                    period,
                });

                return await statsService.getWeekly(period);
            },
        )
        .get(
            "/by-agent",
            async (context: ProtectedStatsContext & { request: Request }) => {
                const forbidden = assertDirector(context.userRole, context.set);

                if (forbidden) {
                    return forbidden;
                }

                const url = new URL(context.request.url);
                const period = url.searchParams.get("period") ?? undefined;

                statsLog("by-agent", {
                    method: context.request.method,
                    path: url.pathname,
                    userId: context.userId,
                    period,
                });

                return await statsService.getByAgent(period);
            },
        );
