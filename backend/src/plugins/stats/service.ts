import { and, count, eq, gte, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
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

type StatsPeriod = "7d" | "14d" | "30d" | "90d";

const normalizePeriod = (period?: string): StatsPeriod =>
    period === "14d" || period === "30d" || period === "90d" ? period : "7d";

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

type StatsQueryOptions = {
    period?: string;
    startDate?: Date;
    endDate?: Date;
    userId?: number;
    mangoUserId?: number | null;
};

type StatsRange = {
    mode: "period" | "custom";
    period: StatsPeriod | "custom";
    days: number;
    start: Date;
    end: Date;
};

type SourceStatsItem = {
    source: string;
    total: number;
    done: number;
    failed: number;
    inProgress: number;
    missed: number;
    noAudio: number;
    avgQualityScore: number | null;
};

type DirectionStatsItem = {
    direction: string;
    total: number;
    done: number;
    failed: number;
    missed: number;
    avgQualityScore: number | null;
};

type ProcessingStatusStatsItem = {
    status: string;
    total: number;
};

type IngestionStatusStatsItem = {
    ingestionStatus: string;
    total: number;
};

type DailyStatsItem = {
    date: string;
    total: number;
    done: number;
    failed: number;
    missed: number;
    noAudio: number;
    avgQualityScore: number | null;
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
    done: number;
    failed: number;
    missed: number;
    avgTalkDurationSec: number | null;
    avgQualityScore: number | null;
};

type OwnershipStats = {
    assigned: number;
    unassigned: number;
    unassignedMango: number;
    unassignedManual: number;
};

type OperationalStats = {
    mangoPendingAudio: number;
    mangoDownloading: number;
    mangoReady: number;
    mangoNoAudio: number;
    mangoIngestionFailed: number;
    aiQueued: number;
    aiProcessing: number;
    aiFailed: number;
    unassignedMango: number;
};

type AgentOperationalStats = {
    mangoPendingAudio: number;
    mangoDownloading: number;
    mangoReady: number;
    mangoNoAudio: number;
    mangoIngestionFailed: number;
    aiQueued: number;
    aiProcessing: number;
    aiFailed: number;
};

type DashboardOverview = StatsOverview & {
    queuedRecords: number;
    processingRecords: number;
    uploadedRecords: number;
    notApplicableRecords: number;
    missedRecords: number;
    noAudioRecords: number;
    withAudioRecords: number;
    unassignedRecords: number;
    avgTalkDurationSec: number | null;
    avgProcessingDurationSec: number | null;
};

type GlobalStatsDashboard = {
    range: {
        mode: "period" | "custom";
        period: StatsPeriod | "custom";
        start: string;
        end: string;
        days: number;
    };
    overview: DashboardOverview;
    source: SourceStatsItem[];
    direction: DirectionStatsItem[];
    processingStatuses: ProcessingStatusStatsItem[];
    ingestionStatuses: IngestionStatusStatsItem[];
    ownership: OwnershipStats;
    trend: DailyStatsItem[];
    byAgent: AgentStatsItem[];
    operational: OperationalStats;
};

type AgentStatsDashboard = {
    range: {
        mode: "period" | "custom";
        period: StatsPeriod | "custom";
        start: string;
        end: string;
        days: number;
    };
    overview: Omit<DashboardOverview, "totalManagers" | "unassignedRecords">;
    source: SourceStatsItem[];
    direction: DirectionStatsItem[];
    processingStatuses: ProcessingStatusStatsItem[];
    ingestionStatuses: IngestionStatusStatsItem[];
    trend: DailyStatsItem[];
    operational: AgentOperationalStats;
};

export class StatsService {
    constructor(private readonly db: NodePgDatabase) {}

    private readonly activityAt =
        sql`coalesce(${recordTable.callStartedAt}, ${recordTable.callEndedAt}, ${recordTable.callAnsweredAt}, ${recordTable.finishedAt}, ${recordTable.startedAt})`;

    private readonly missedCondition =
        sql`${recordTable.isMissed} = true or ${recordTable.ingestionStatus} = 'no_audio' or ${recordTable.talkDurationSec} = 0`;

    private buildInRangeCondition(start: Date, end: Date) {
        return or(
            and(gte(this.activityAt, start), lt(this.activityAt, end)),
            and(this.missedCondition, sql`${this.activityAt} is null`),
        )!;
    }

    private buildAgentOwnershipCondition(
        userId: number,
        mangoUserId?: number | null,
    ) {
        const directOwnership = eq(recordTable.userId, userId);

        if (typeof mangoUserId !== "number") {
            return directOwnership;
        }

        return or(
            directOwnership,
            and(
                isNull(recordTable.userId),
                eq(recordTable.mangoUserId, mangoUserId),
            ),
        )!;
    }

    private toNumber(value: unknown): number {
        if (typeof value === "number") return value;
        if (typeof value === "string") return Number(value);
        return 0;
    }

    private toNullableNumber(value: unknown): number | null {
        if (value === null || value === undefined) return null;
        if (typeof value === "number") return value;
        if (typeof value === "string") {
            const parsed = Number(value);
            return Number.isNaN(parsed) ? null : parsed;
        }
        return null;
    }

    private resolveRange(options?: StatsQueryOptions): StatsRange {
        if (options?.startDate && options?.endDate) {
            const start = new Date(options.startDate);
            const end = new Date(options.endDate);

            if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
                throw new Error("Invalid date range");
            }

            if (end <= start) {
                throw new Error("endDate must be greater than startDate");
            }

            const days = Math.max(
                1,
                Math.ceil((end.getTime() - start.getTime()) / 86_400_000),
            );

            return {
                mode: "custom",
                period: "custom",
                days,
                start,
                end,
            };
        }

        const periodRange = getPeriodRange(options?.period);
        return {
            mode: "period",
            period: normalizePeriod(options?.period),
            days: periodRange.days,
            start: periodRange.start,
            end: periodRange.end,
        };
    }

    private buildDateSeriesMap(days: number, start: Date) {
        const map = new Map<string, DailyStatsItem>();

        for (let i = 0; i < days; i++) {
            const date = new Date(start);
            date.setDate(start.getDate() + i);
            const key = date.toISOString().slice(0, 10);
            map.set(key, {
                date: key,
                total: 0,
                done: 0,
                failed: 0,
                missed: 0,
                noAudio: 0,
                avgQualityScore: null,
            });
        }

        return map;
    }

    async getOverview(period?: string): Promise<StatsOverview> {
        const { start, end } = this.resolveRange({ period });
        const inRange = this.buildInRangeCondition(start, end);

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
            .where(inRange);

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
        const { days, start, end } = this.resolveRange({ period });
        const inRange = this.buildInRangeCondition(start, end);

        const rows = await this.db
            .select({
                date: sql<string>`to_char(date_trunc('day', ${this.activityAt}), 'YYYY-MM-DD')`,
                total: count(recordTable.id),
                done: sql<number>`count(*) filter (where ${recordTable.status} = 'done')`,
            })
            .from(recordTable)
            .where(inRange)
            .groupBy(sql`date_trunc('day', ${this.activityAt})`)
            .orderBy(sql`date_trunc('day', ${this.activityAt}) asc`);

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
        const { start, end } = this.resolveRange({ period });
        const inRange = this.buildInRangeCondition(start, end);

        const rows = await this.db
            .select({
                userId: userTable.id,
                fio: userTable.fio,
                name: userTable.name,
                total: count(recordTable.id),
                done: sql<number>`count(*) filter (where ${recordTable.status} = 'done')`,
                failed: sql<number>`count(*) filter (where ${recordTable.status} = 'failed')`,
                missed: sql<number>`count(*) filter (where ${this.missedCondition})`,
                avgTalkDurationSec: sql<
                    number | null
                >`round(avg(${recordTable.talkDurationSec})::numeric, 1)`,
                avgQualityScore: sql<
                    number | null
                >`round(avg(${recordTable.qualityScore})::numeric, 1)`,
            })
            .from(userTable)
            .leftJoin(
                recordTable,
                and(
                    or(
                        eq(recordTable.userId, userTable.id),
                        and(
                            isNull(recordTable.userId),
                            isNotNull(userTable.mangoUserId),
                            eq(recordTable.mangoUserId, userTable.mangoUserId),
                        ),
                    ),
                    inRange,
                ),
            )
            .where(eq(userTable.role, "manager"))
            .groupBy(userTable.id, userTable.fio, userTable.name)
            .orderBy(sql`count(${recordTable.id}) desc`, userTable.name);

        return rows.map((row) => ({
            userId: row.userId,
            name: row.fio ?? row.name,
            total: Number(row.total ?? 0),
            done: Number(row.done ?? 0),
            failed: Number(row.failed ?? 0),
            missed: Number(row.missed ?? 0),
            avgTalkDurationSec:
                row.avgTalkDurationSec === null ||
                row.avgTalkDurationSec === undefined
                    ? null
                    : Number(row.avgTalkDurationSec),
            avgQualityScore:
                row.avgQualityScore === null ||
                row.avgQualityScore === undefined
                    ? null
                    : Number(row.avgQualityScore),
        }));
    }

    async getGlobalDashboard(
        options?: StatsQueryOptions,
    ): Promise<GlobalStatsDashboard> {
        const range = this.resolveRange(options);
        const inRange = this.buildInRangeCondition(range.start, range.end);

        const [overviewRow] = await this.db
            .select({
                totalRecords: count(recordTable.id),
                doneRecords: sql<number>`count(*) filter (where ${recordTable.status} = 'done')`,
                failedRecords: sql<number>`count(*) filter (where ${recordTable.status} = 'failed')`,
                queuedRecords: sql<number>`count(*) filter (where ${recordTable.status} = 'queued')`,
                processingRecords: sql<number>`count(*) filter (where ${recordTable.status} = 'processing')`,
                uploadedRecords: sql<number>`count(*) filter (where ${recordTable.status} = 'uploaded')`,
                notApplicableRecords: sql<number>`count(*) filter (where ${recordTable.status} = 'not_applicable')`,
                missedRecords: sql<number>`count(*) filter (where ${this.missedCondition})`,
                noAudioRecords: sql<number>`count(*) filter (where ${recordTable.hasAudio} = false or ${recordTable.ingestionStatus} = 'no_audio')`,
                withAudioRecords: sql<number>`count(*) filter (where ${recordTable.hasAudio} = true)`,
                unassignedRecords: sql<number>`count(*) filter (where ${recordTable.userId} is null)`,
                avgQualityScore: sql<
                    number | null
                >`round(avg(${recordTable.qualityScore})::numeric, 1)`,
                avgTalkDurationSec: sql<
                    number | null
                >`round(avg(${recordTable.talkDurationSec})::numeric, 1)`,
                avgProcessingDurationSec: sql<
                    number | null
                >`round(avg(extract(epoch from (${recordTable.finishedAt} - ${recordTable.startedAt})))::numeric, 1)`,
            })
            .from(recordTable)
            .where(inRange);

        const [managersAggregate] = await this.db
            .select({
                totalManagers: count(userTable.id),
            })
            .from(userTable)
            .where(eq(userTable.role, "manager"));

        const sourceRows = await this.db
            .select({
                source: sql<string>`coalesce(${recordTable.source}, 'unknown')`,
                total: count(recordTable.id),
                done: sql<number>`count(*) filter (where ${recordTable.status} = 'done')`,
                failed: sql<number>`count(*) filter (where ${recordTable.status} = 'failed')`,
                inProgress: sql<number>`count(*) filter (where ${recordTable.status} in ('uploaded', 'queued', 'processing'))`,
                missed: sql<number>`count(*) filter (where ${this.missedCondition})`,
                noAudio: sql<number>`count(*) filter (where ${recordTable.hasAudio} = false or ${recordTable.ingestionStatus} = 'no_audio')`,
                avgQualityScore: sql<
                    number | null
                >`round(avg(${recordTable.qualityScore})::numeric, 1)`,
            })
            .from(recordTable)
            .where(inRange)
            .groupBy(sql`coalesce(${recordTable.source}, 'unknown')`)
            .orderBy(sql`count(${recordTable.id}) desc`);

        const directionRows = await this.db
            .select({
                direction: sql<string>`coalesce(${recordTable.directionKind}, ${recordTable.direction}, 'unknown')`,
                total: count(recordTable.id),
                done: sql<number>`count(*) filter (where ${recordTable.status} = 'done')`,
                failed: sql<number>`count(*) filter (where ${recordTable.status} = 'failed')`,
                missed: sql<number>`count(*) filter (where ${this.missedCondition})`,
                avgQualityScore: sql<
                    number | null
                >`round(avg(${recordTable.qualityScore})::numeric, 1)`,
            })
            .from(recordTable)
            .where(inRange)
            .groupBy(
                sql`coalesce(${recordTable.directionKind}, ${recordTable.direction}, 'unknown')`,
            )
            .orderBy(sql`count(${recordTable.id}) desc`);

        const processingStatusRows = await this.db
            .select({
                status: sql<string>`coalesce(${recordTable.status}, 'unknown')`,
                total: count(recordTable.id),
            })
            .from(recordTable)
            .where(inRange)
            .groupBy(sql`coalesce(${recordTable.status}, 'unknown')`)
            .orderBy(sql`count(${recordTable.id}) desc`);

        const ingestionStatusRows = await this.db
            .select({
                ingestionStatus: sql<string>`coalesce(${recordTable.ingestionStatus}, 'unknown')`,
                total: count(recordTable.id),
            })
            .from(recordTable)
            .where(and(inRange, eq(recordTable.source, "mango")))
            .groupBy(sql`coalesce(${recordTable.ingestionStatus}, 'unknown')`)
            .orderBy(sql`count(${recordTable.id}) desc`);

        const [ownershipRow] = await this.db
            .select({
                assigned: sql<number>`count(*) filter (where ${recordTable.userId} is not null)`,
                unassigned: sql<number>`count(*) filter (where ${recordTable.userId} is null)`,
                unassignedMango: sql<number>`count(*) filter (where ${recordTable.userId} is null and ${recordTable.source} = 'mango')`,
                unassignedManual: sql<number>`count(*) filter (where ${recordTable.userId} is null and ${recordTable.source} = 'manual')`,
            })
            .from(recordTable)
            .where(inRange);

        const dailyRows = await this.db
            .select({
                date: sql<string>`to_char(date_trunc('day', ${this.activityAt}), 'YYYY-MM-DD')`,
                total: count(recordTable.id),
                done: sql<number>`count(*) filter (where ${recordTable.status} = 'done')`,
                failed: sql<number>`count(*) filter (where ${recordTable.status} = 'failed')`,
                missed: sql<number>`count(*) filter (where ${this.missedCondition})`,
                noAudio: sql<number>`count(*) filter (where ${recordTable.hasAudio} = false or ${recordTable.ingestionStatus} = 'no_audio')`,
                avgQualityScore: sql<
                    number | null
                >`round(avg(${recordTable.qualityScore})::numeric, 1)`,
            })
            .from(recordTable)
            .where(inRange)
            .groupBy(sql`date_trunc('day', ${this.activityAt})`)
            .orderBy(sql`date_trunc('day', ${this.activityAt}) asc`);

        const [operationalRow] = await this.db
            .select({
                mangoPendingAudio: sql<number>`count(*) filter (where ${recordTable.source} = 'mango' and ${recordTable.ingestionStatus} = 'pending_audio')`,
                mangoDownloading: sql<number>`count(*) filter (where ${recordTable.source} = 'mango' and ${recordTable.ingestionStatus} = 'downloading')`,
                mangoReady: sql<number>`count(*) filter (where ${recordTable.source} = 'mango' and ${recordTable.ingestionStatus} = 'ready')`,
                mangoNoAudio: sql<number>`count(*) filter (where ${recordTable.source} = 'mango' and ${recordTable.ingestionStatus} = 'no_audio')`,
                mangoIngestionFailed: sql<number>`count(*) filter (where ${recordTable.source} = 'mango' and ${recordTable.ingestionStatus} = 'failed')`,
                aiQueued: sql<number>`count(*) filter (where ${recordTable.status} = 'queued')`,
                aiProcessing: sql<number>`count(*) filter (where ${recordTable.status} = 'processing')`,
                aiFailed: sql<number>`count(*) filter (where ${recordTable.status} = 'failed')`,
                unassignedMango: sql<number>`count(*) filter (where ${recordTable.source} = 'mango' and ${recordTable.userId} is null)`,
            })
            .from(recordTable)
            .where(inRange);

        const trendMap = this.buildDateSeriesMap(range.days, range.start);
        for (const row of dailyRows) {
            const entry = trendMap.get(row.date);
            if (!entry) continue;

            entry.total = this.toNumber(row.total);
            entry.done = this.toNumber(row.done);
            entry.failed = this.toNumber(row.failed);
            entry.missed = this.toNumber(row.missed);
            entry.noAudio = this.toNumber(row.noAudio);
            entry.avgQualityScore = this.toNullableNumber(row.avgQualityScore);
        }

        const byAgent =
            range.mode === "period"
                ? await this.getByAgent(range.period)
                : await this.getByAgentForRange(range.start, range.end);

        return {
            range: {
                mode: range.mode,
                period: range.period,
                start: range.start.toISOString(),
                end: range.end.toISOString(),
                days: range.days,
            },
            overview: {
                totalRecords: this.toNumber(overviewRow?.totalRecords),
                doneRecords: this.toNumber(overviewRow?.doneRecords),
                failedRecords: this.toNumber(overviewRow?.failedRecords),
                avgQualityScore: this.toNullableNumber(
                    overviewRow?.avgQualityScore,
                ),
                totalManagers: this.toNumber(managersAggregate?.totalManagers),
                queuedRecords: this.toNumber(overviewRow?.queuedRecords),
                processingRecords: this.toNumber(overviewRow?.processingRecords),
                uploadedRecords: this.toNumber(overviewRow?.uploadedRecords),
                notApplicableRecords: this.toNumber(
                    overviewRow?.notApplicableRecords,
                ),
                missedRecords: this.toNumber(overviewRow?.missedRecords),
                noAudioRecords: this.toNumber(overviewRow?.noAudioRecords),
                withAudioRecords: this.toNumber(overviewRow?.withAudioRecords),
                unassignedRecords: this.toNumber(overviewRow?.unassignedRecords),
                avgTalkDurationSec: this.toNullableNumber(
                    overviewRow?.avgTalkDurationSec,
                ),
                avgProcessingDurationSec: this.toNullableNumber(
                    overviewRow?.avgProcessingDurationSec,
                ),
            },
            source: sourceRows.map((row) => ({
                source: row.source,
                total: this.toNumber(row.total),
                done: this.toNumber(row.done),
                failed: this.toNumber(row.failed),
                inProgress: this.toNumber(row.inProgress),
                missed: this.toNumber(row.missed),
                noAudio: this.toNumber(row.noAudio),
                avgQualityScore: this.toNullableNumber(row.avgQualityScore),
            })),
            direction: directionRows.map((row) => ({
                direction: row.direction,
                total: this.toNumber(row.total),
                done: this.toNumber(row.done),
                failed: this.toNumber(row.failed),
                missed: this.toNumber(row.missed),
                avgQualityScore: this.toNullableNumber(row.avgQualityScore),
            })),
            processingStatuses: processingStatusRows.map((row) => ({
                status: row.status,
                total: this.toNumber(row.total),
            })),
            ingestionStatuses: ingestionStatusRows.map((row) => ({
                ingestionStatus: row.ingestionStatus,
                total: this.toNumber(row.total),
            })),
            ownership: {
                assigned: this.toNumber(ownershipRow?.assigned),
                unassigned: this.toNumber(ownershipRow?.unassigned),
                unassignedMango: this.toNumber(ownershipRow?.unassignedMango),
                unassignedManual: this.toNumber(ownershipRow?.unassignedManual),
            },
            trend: Array.from(trendMap.values()),
            byAgent,
            operational: {
                mangoPendingAudio: this.toNumber(operationalRow?.mangoPendingAudio),
                mangoDownloading: this.toNumber(operationalRow?.mangoDownloading),
                mangoReady: this.toNumber(operationalRow?.mangoReady),
                mangoNoAudio: this.toNumber(operationalRow?.mangoNoAudio),
                mangoIngestionFailed: this.toNumber(
                    operationalRow?.mangoIngestionFailed,
                ),
                aiQueued: this.toNumber(operationalRow?.aiQueued),
                aiProcessing: this.toNumber(operationalRow?.aiProcessing),
                aiFailed: this.toNumber(operationalRow?.aiFailed),
                unassignedMango: this.toNumber(operationalRow?.unassignedMango),
            },
        };
    }

    async getAgentDashboard(
        options: StatsQueryOptions & { userId: number },
    ): Promise<AgentStatsDashboard> {
        const range = this.resolveRange(options);
        const inRange = and(
            this.buildAgentOwnershipCondition(options.userId, options.mangoUserId),
            this.buildInRangeCondition(range.start, range.end),
        );

        const [overviewRow] = await this.db
            .select({
                totalRecords: count(recordTable.id),
                doneRecords: sql<number>`count(*) filter (where ${recordTable.status} = 'done')`,
                failedRecords: sql<number>`count(*) filter (where ${recordTable.status} = 'failed')`,
                queuedRecords: sql<number>`count(*) filter (where ${recordTable.status} = 'queued')`,
                processingRecords: sql<number>`count(*) filter (where ${recordTable.status} = 'processing')`,
                uploadedRecords: sql<number>`count(*) filter (where ${recordTable.status} = 'uploaded')`,
                notApplicableRecords: sql<number>`count(*) filter (where ${recordTable.status} = 'not_applicable')`,
                missedRecords: sql<number>`count(*) filter (where ${this.missedCondition})`,
                noAudioRecords: sql<number>`count(*) filter (where ${recordTable.hasAudio} = false or ${recordTable.ingestionStatus} = 'no_audio')`,
                withAudioRecords: sql<number>`count(*) filter (where ${recordTable.hasAudio} = true)`,
                avgQualityScore: sql<
                    number | null
                >`round(avg(${recordTable.qualityScore})::numeric, 1)`,
                avgTalkDurationSec: sql<
                    number | null
                >`round(avg(${recordTable.talkDurationSec})::numeric, 1)`,
                avgProcessingDurationSec: sql<
                    number | null
                >`round(avg(extract(epoch from (${recordTable.finishedAt} - ${recordTable.startedAt})))::numeric, 1)`,
            })
            .from(recordTable)
            .where(inRange);

        const sourceRows = await this.db
            .select({
                source: sql<string>`coalesce(${recordTable.source}, 'unknown')`,
                total: count(recordTable.id),
                done: sql<number>`count(*) filter (where ${recordTable.status} = 'done')`,
                failed: sql<number>`count(*) filter (where ${recordTable.status} = 'failed')`,
                inProgress: sql<number>`count(*) filter (where ${recordTable.status} in ('uploaded', 'queued', 'processing'))`,
                missed: sql<number>`count(*) filter (where ${this.missedCondition})`,
                noAudio: sql<number>`count(*) filter (where ${recordTable.hasAudio} = false or ${recordTable.ingestionStatus} = 'no_audio')`,
                avgQualityScore: sql<
                    number | null
                >`round(avg(${recordTable.qualityScore})::numeric, 1)`,
            })
            .from(recordTable)
            .where(inRange)
            .groupBy(sql`coalesce(${recordTable.source}, 'unknown')`)
            .orderBy(sql`count(${recordTable.id}) desc`);

        const directionRows = await this.db
            .select({
                direction: sql<string>`coalesce(${recordTable.directionKind}, ${recordTable.direction}, 'unknown')`,
                total: count(recordTable.id),
                done: sql<number>`count(*) filter (where ${recordTable.status} = 'done')`,
                failed: sql<number>`count(*) filter (where ${recordTable.status} = 'failed')`,
                missed: sql<number>`count(*) filter (where ${this.missedCondition})`,
                avgQualityScore: sql<
                    number | null
                >`round(avg(${recordTable.qualityScore})::numeric, 1)`,
            })
            .from(recordTable)
            .where(inRange)
            .groupBy(
                sql`coalesce(${recordTable.directionKind}, ${recordTable.direction}, 'unknown')`,
            )
            .orderBy(sql`count(${recordTable.id}) desc`);

        const processingStatusRows = await this.db
            .select({
                status: sql<string>`coalesce(${recordTable.status}, 'unknown')`,
                total: count(recordTable.id),
            })
            .from(recordTable)
            .where(inRange)
            .groupBy(sql`coalesce(${recordTable.status}, 'unknown')`)
            .orderBy(sql`count(${recordTable.id}) desc`);

        const ingestionStatusRows = await this.db
            .select({
                ingestionStatus: sql<string>`coalesce(${recordTable.ingestionStatus}, 'unknown')`,
                total: count(recordTable.id),
            })
            .from(recordTable)
            .where(and(inRange, eq(recordTable.source, "mango")))
            .groupBy(sql`coalesce(${recordTable.ingestionStatus}, 'unknown')`)
            .orderBy(sql`count(${recordTable.id}) desc`);

        const dailyRows = await this.db
            .select({
                date: sql<string>`to_char(date_trunc('day', ${this.activityAt}), 'YYYY-MM-DD')`,
                total: count(recordTable.id),
                done: sql<number>`count(*) filter (where ${recordTable.status} = 'done')`,
                failed: sql<number>`count(*) filter (where ${recordTable.status} = 'failed')`,
                missed: sql<number>`count(*) filter (where ${this.missedCondition})`,
                noAudio: sql<number>`count(*) filter (where ${recordTable.hasAudio} = false or ${recordTable.ingestionStatus} = 'no_audio')`,
                avgQualityScore: sql<
                    number | null
                >`round(avg(${recordTable.qualityScore})::numeric, 1)`,
            })
            .from(recordTable)
            .where(inRange)
            .groupBy(sql`date_trunc('day', ${this.activityAt})`)
            .orderBy(sql`date_trunc('day', ${this.activityAt}) asc`);

        const [operationalRow] = await this.db
            .select({
                mangoPendingAudio: sql<number>`count(*) filter (where ${recordTable.source} = 'mango' and ${recordTable.ingestionStatus} = 'pending_audio')`,
                mangoDownloading: sql<number>`count(*) filter (where ${recordTable.source} = 'mango' and ${recordTable.ingestionStatus} = 'downloading')`,
                mangoReady: sql<number>`count(*) filter (where ${recordTable.source} = 'mango' and ${recordTable.ingestionStatus} = 'ready')`,
                mangoNoAudio: sql<number>`count(*) filter (where ${recordTable.source} = 'mango' and ${recordTable.ingestionStatus} = 'no_audio')`,
                mangoIngestionFailed: sql<number>`count(*) filter (where ${recordTable.source} = 'mango' and ${recordTable.ingestionStatus} = 'failed')`,
                aiQueued: sql<number>`count(*) filter (where ${recordTable.status} = 'queued')`,
                aiProcessing: sql<number>`count(*) filter (where ${recordTable.status} = 'processing')`,
                aiFailed: sql<number>`count(*) filter (where ${recordTable.status} = 'failed')`,
            })
            .from(recordTable)
            .where(inRange);

        const trendMap = this.buildDateSeriesMap(range.days, range.start);
        for (const row of dailyRows) {
            const entry = trendMap.get(row.date);
            if (!entry) continue;

            entry.total = this.toNumber(row.total);
            entry.done = this.toNumber(row.done);
            entry.failed = this.toNumber(row.failed);
            entry.missed = this.toNumber(row.missed);
            entry.noAudio = this.toNumber(row.noAudio);
            entry.avgQualityScore = this.toNullableNumber(row.avgQualityScore);
        }

        return {
            range: {
                mode: range.mode,
                period: range.period,
                start: range.start.toISOString(),
                end: range.end.toISOString(),
                days: range.days,
            },
            overview: {
                totalRecords: this.toNumber(overviewRow?.totalRecords),
                doneRecords: this.toNumber(overviewRow?.doneRecords),
                failedRecords: this.toNumber(overviewRow?.failedRecords),
                avgQualityScore: this.toNullableNumber(
                    overviewRow?.avgQualityScore,
                ),
                queuedRecords: this.toNumber(overviewRow?.queuedRecords),
                processingRecords: this.toNumber(overviewRow?.processingRecords),
                uploadedRecords: this.toNumber(overviewRow?.uploadedRecords),
                notApplicableRecords: this.toNumber(
                    overviewRow?.notApplicableRecords,
                ),
                missedRecords: this.toNumber(overviewRow?.missedRecords),
                noAudioRecords: this.toNumber(overviewRow?.noAudioRecords),
                withAudioRecords: this.toNumber(overviewRow?.withAudioRecords),
                avgTalkDurationSec: this.toNullableNumber(
                    overviewRow?.avgTalkDurationSec,
                ),
                avgProcessingDurationSec: this.toNullableNumber(
                    overviewRow?.avgProcessingDurationSec,
                ),
            },
            source: sourceRows.map((row) => ({
                source: row.source,
                total: this.toNumber(row.total),
                done: this.toNumber(row.done),
                failed: this.toNumber(row.failed),
                inProgress: this.toNumber(row.inProgress),
                missed: this.toNumber(row.missed),
                noAudio: this.toNumber(row.noAudio),
                avgQualityScore: this.toNullableNumber(row.avgQualityScore),
            })),
            direction: directionRows.map((row) => ({
                direction: row.direction,
                total: this.toNumber(row.total),
                done: this.toNumber(row.done),
                failed: this.toNumber(row.failed),
                missed: this.toNumber(row.missed),
                avgQualityScore: this.toNullableNumber(row.avgQualityScore),
            })),
            processingStatuses: processingStatusRows.map((row) => ({
                status: row.status,
                total: this.toNumber(row.total),
            })),
            ingestionStatuses: ingestionStatusRows.map((row) => ({
                ingestionStatus: row.ingestionStatus,
                total: this.toNumber(row.total),
            })),
            trend: Array.from(trendMap.values()),
            operational: {
                mangoPendingAudio: this.toNumber(operationalRow?.mangoPendingAudio),
                mangoDownloading: this.toNumber(operationalRow?.mangoDownloading),
                mangoReady: this.toNumber(operationalRow?.mangoReady),
                mangoNoAudio: this.toNumber(operationalRow?.mangoNoAudio),
                mangoIngestionFailed: this.toNumber(
                    operationalRow?.mangoIngestionFailed,
                ),
                aiQueued: this.toNumber(operationalRow?.aiQueued),
                aiProcessing: this.toNumber(operationalRow?.aiProcessing),
                aiFailed: this.toNumber(operationalRow?.aiFailed),
            },
        };
    }

    private async getByAgentForRange(
        start: Date,
        end: Date,
    ): Promise<AgentStatsItem[]> {
        const inRange = this.buildInRangeCondition(start, end);
        const rows = await this.db
            .select({
                userId: userTable.id,
                fio: userTable.fio,
                name: userTable.name,
                total: count(recordTable.id),
                done: sql<number>`count(*) filter (where ${recordTable.status} = 'done')`,
                failed: sql<number>`count(*) filter (where ${recordTable.status} = 'failed')`,
                missed: sql<number>`count(*) filter (where ${this.missedCondition})`,
                avgTalkDurationSec: sql<
                    number | null
                >`round(avg(${recordTable.talkDurationSec})::numeric, 1)`,
                avgQualityScore: sql<
                    number | null
                >`round(avg(${recordTable.qualityScore})::numeric, 1)`,
            })
            .from(userTable)
            .leftJoin(
                recordTable,
                and(
                    or(
                        eq(recordTable.userId, userTable.id),
                        and(
                            isNull(recordTable.userId),
                            isNotNull(userTable.mangoUserId),
                            eq(recordTable.mangoUserId, userTable.mangoUserId),
                        ),
                    ),
                    inRange,
                ),
            )
            .where(eq(userTable.role, "manager"))
            .groupBy(userTable.id, userTable.fio, userTable.name)
            .orderBy(sql`count(${recordTable.id}) desc`, userTable.name);

        return rows.map((row) => ({
            userId: row.userId,
            name: row.fio ?? row.name,
            total: Number(row.total ?? 0),
            done: Number(row.done ?? 0),
            failed: Number(row.failed ?? 0),
            missed: Number(row.missed ?? 0),
            avgTalkDurationSec:
                row.avgTalkDurationSec === null ||
                row.avgTalkDurationSec === undefined
                    ? null
                    : Number(row.avgTalkDurationSec),
            avgQualityScore:
                row.avgQualityScore === null ||
                row.avgQualityScore === undefined
                    ? null
                    : Number(row.avgQualityScore),
        }));
    }
}

export default StatsService;
