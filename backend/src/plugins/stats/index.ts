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

const parseDateParam = (value: string | null): Date | null => {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed;
};

const parseStatsDateQuery = (url: URL) => {
    const period = url.searchParams.get("period") ?? undefined;
    const startDateRaw = url.searchParams.get("startDate");
    const endDateRaw = url.searchParams.get("endDate");
    const startDate = parseDateParam(startDateRaw);
    const endDate = parseDateParam(endDateRaw);

    if (
        (startDateRaw && !startDate) ||
        (endDateRaw && !endDate) ||
        (!!startDateRaw !== !!endDateRaw)
    ) {
        return {
            period,
            error: "Invalid date query. Use ISO format and pass both startDate and endDate",
        };
    }

    return {
        period,
        startDate: startDate ?? undefined,
        endDate: endDate ?? undefined,
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
            "/global",
            async (context: ProtectedStatsContext & { request: Request }) => {
                const forbidden = assertDirector(context.userRole, context.set);

                if (forbidden) {
                    return forbidden;
                }

                const url = new URL(context.request.url);
                const parsedQuery = parseStatsDateQuery(url);
                if (parsedQuery.error) {
                    context.set.status = 400;
                    return {
                        message: parsedQuery.error,
                    };
                }

                statsLog("global", {
                    method: context.request.method,
                    path: url.pathname,
                    userId: context.userId,
                    period: parsedQuery.period,
                    startDate: parsedQuery.startDate?.toISOString(),
                    endDate: parsedQuery.endDate?.toISOString(),
                });

                try {
                    return await statsService.getGlobalDashboard({
                        period: parsedQuery.period,
                        startDate: parsedQuery.startDate,
                        endDate: parsedQuery.endDate,
                    });
                } catch (error) {
                    context.set.status = 400;
                    return {
                        message:
                            error instanceof Error
                                ? error.message
                                : "Invalid query",
                    };
                }
            },
        )
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
        )
        .get(
            "/agent/:userId/dashboard",
            async (
                context: ProtectedStatsContext & {
                    request: Request;
                    params: { userId: string };
                },
            ) => {
                const forbidden = assertDirector(context.userRole, context.set);
                if (forbidden) {
                    return forbidden;
                }

                const targetUserId = Number(context.params.userId);
                if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
                    context.set.status = 400;
                    return {
                        message: "Invalid user id",
                    };
                }

                const targetUser = await userService.getUserById(targetUserId);
                if (!targetUser) {
                    context.set.status = 404;
                    return {
                        message: "User not found",
                    };
                }

                if (targetUser.role !== "manager") {
                    context.set.status = 400;
                    return {
                        message: "Target user must be a manager",
                    };
                }

                const url = new URL(context.request.url);
                const parsedQuery = parseStatsDateQuery(url);
                if (parsedQuery.error) {
                    context.set.status = 400;
                    return {
                        message: parsedQuery.error,
                    };
                }

                statsLog("agent-dashboard", {
                    method: context.request.method,
                    path: url.pathname,
                    userId: context.userId,
                    targetUserId,
                    period: parsedQuery.period,
                    startDate: parsedQuery.startDate?.toISOString(),
                    endDate: parsedQuery.endDate?.toISOString(),
                });

                try {
                    const dashboard = await statsService.getAgentDashboard({
                        userId: targetUserId,
                        mangoUserId: targetUser.mangoUserId ?? null,
                        period: parsedQuery.period,
                        startDate: parsedQuery.startDate,
                        endDate: parsedQuery.endDate,
                    });

                    return {
                        agent: {
                            userId: targetUser.id,
                            name: targetUser.fio ?? targetUser.name,
                            email: targetUser.email,
                        },
                        ...dashboard,
                    };
                } catch (error) {
                    context.set.status = 400;
                    return {
                        message:
                            error instanceof Error
                                ? error.message
                                : "Invalid query",
                    };
                }
            },
        );
