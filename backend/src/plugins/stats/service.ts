import { and, count, eq, gte, lt, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { recordTable } from "../records/model";
import { userTable } from "../user/model";

type StatsOverview = {
    totalRecords: number;
    doneRecords: number;
    failedRecords: number;
    avgQualityScore: number | null;
    totalManagers: number;
};

type StatsPeriod = "7d" | "14d" | "30d";

const normalizePeriod = (period?: string): StatsPeriod =>
    period === "14d" || period === "30d" ? period : "7d";

const getPeriodRange = (period?: string) => {
    const normalizedPeriod = normalizePeriod(period);
    const days = Number.parseInt(normalizedPeriod, 10);

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (days - 1));

    const end = new Date(start);
    end.setDate(start.getDate() + days);

    return {
        days,
        start,
        end,
    };
};

type WeeklyStatsItem = {
    date: string;
    total: number;
    done: number;
};

type AgentStatsItem = {
    userId: number;
    name: string;
    total: number;
    avgQualityScore: number | null;
};

export class StatsService {
    constructor(private readonly db: NodePgDatabase) {}

    async getOverview(period?: string): Promise<StatsOverview> {
        const { start, end } = getPeriodRange(period);
        const activityAt = sql`coalesce(${recordTable.callStartedAt}, ${recordTable.finishedAt}, ${recordTable.startedAt})`;

        const [recordsAggregate] = await this.db
            .select({
                totalRecords: count(recordTable.id),
                doneRecords: sql<number>`count(*) filter (where ${recordTable.status} = 'done')`,
                failedRecords: sql<number>`count(*) filter (where ${recordTable.status} = 'failed')`,
                avgQualityScore: sql<
                    number | null
                >`round(avg(${recordTable.qualityScore})::numeric, 1)`,
            })
            .from(recordTable)
            .where(and(gte(activityAt, start), lt(activityAt, end)));

        const [managersAggregate] = await this.db
            .select({
                totalManagers: count(userTable.id),
            })
            .from(userTable)
            .where(eq(userTable.role, "manager"));

        return {
            totalRecords: Number(recordsAggregate?.totalRecords ?? 0),
            doneRecords: Number(recordsAggregate?.doneRecords ?? 0),
            failedRecords: Number(recordsAggregate?.failedRecords ?? 0),
            avgQualityScore:
                recordsAggregate?.avgQualityScore === null ||
                recordsAggregate?.avgQualityScore === undefined
                    ? null
                    : Number(recordsAggregate.avgQualityScore),
            totalManagers: Number(managersAggregate?.totalManagers ?? 0),
        };
    }

    async getWeekly(period?: string): Promise<WeeklyStatsItem[]> {
        const { days, start, end } = getPeriodRange(period);
        const activityAt = sql`coalesce(${recordTable.callStartedAt}, ${recordTable.finishedAt}, ${recordTable.startedAt})`;

        const rows = await this.db
            .select({
                date: sql<string>`to_char(date_trunc('day', ${activityAt}), 'YYYY-MM-DD')`,
                total: count(recordTable.id),
                done: sql<number>`count(*) filter (where ${recordTable.status} = 'done')`,
            })
            .from(recordTable)
            .where(and(gte(activityAt, start), lt(activityAt, end)))
            .groupBy(sql`date_trunc('day', ${activityAt})`)
            .orderBy(sql`date_trunc('day', ${activityAt}) asc`);

        const byDate = new Map<string, WeeklyStatsItem>(
            rows.map((row) => [
                row.date,
                {
                    date: row.date,
                    total: Number(row.total ?? 0),
                    done: Number(row.done ?? 0),
                },
            ]),
        );

        const result: WeeklyStatsItem[] = [];

        for (let i = 0; i < days; i++) {
            const date = new Date(start);
            date.setDate(start.getDate() + i);
            const key = date.toISOString().slice(0, 10);

            result.push(
                byDate.get(key) ?? {
                    date: key,
                    total: 0,
                    done: 0,
                },
            );
        }

        return result;
    }

    async getByAgent(period?: string): Promise<AgentStatsItem[]> {
        const { start, end } = getPeriodRange(period);
        const activityAt = sql`coalesce(${recordTable.callStartedAt}, ${recordTable.finishedAt}, ${recordTable.startedAt})`;

        const rows = await this.db
            .select({
                userId: userTable.id,
                fio: userTable.fio,
                name: userTable.name,
                total: count(recordTable.id),
                avgQualityScore: sql<
                    number | null
                >`round(avg(${recordTable.qualityScore})::numeric, 1)`,
            })
            .from(userTable)
            .leftJoin(
                recordTable,
                and(
                    eq(recordTable.userId, userTable.id),
                    gte(activityAt, start),
                    lt(activityAt, end),
                ),
            )
            .where(eq(userTable.role, "manager"))
            .groupBy(userTable.id, userTable.fio, userTable.name)
            .orderBy(sql`count(${recordTable.id}) desc`, userTable.name);

        return rows.map((row) => ({
            userId: row.userId,
            name: row.fio ?? row.name,
            total: Number(row.total ?? 0),
            avgQualityScore:
                row.avgQualityScore === null ||
                row.avgQualityScore === undefined
                    ? null
                    : Number(row.avgQualityScore),
        }));
    }
}

export default StatsService;
