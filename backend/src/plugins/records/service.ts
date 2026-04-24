import { eq } from "drizzle-orm";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import {
    type AiCheckboxGroups,
    type AiRecordStatus,
    type CreateRecord,
    type GetRecord,
} from "./schema";
import { recordTable, tagsTable } from "./model";

type RecordRow = typeof recordTable.$inferSelect;
type TagRow = typeof tagsTable.$inferSelect;

type FinishRecordProcessingPayload = {
    transcription: string;
    summary: string;
    durationSec?: number | null;
    tags?: string[];
    checkboxes?: AiCheckboxGroups | null;
};

class RecordService {
    constructor(private readonly db: NodePgDatabase) {
        this.db = db;
    }

    private mapRecord(record: RecordRow, tags: string[]): GetRecord {
        return {
            ...record,
            status: record.status as AiRecordStatus,
            checkboxes: (record.checkboxes as AiCheckboxGroups | null) ?? null,
            tags,
        };
    }

    private async replaceTags(recordId: number, tags: string[]): Promise<void> {
        await this.db.delete(tagsTable).where(eq(tagsTable.recordId, recordId));

        const normalizedTags = [
            ...new Set(tags.map((tag) => tag.trim())),
        ].filter((tag) => tag.length > 0);

        if (!normalizedTags.length) {
            return;
        }

        await this.db.insert(tagsTable).values(
            normalizedTags.map((tag, index) => ({
                id: recordId * 1000 + index + 1,
                recordId,
                tag,
            })),
        );
    }

    private groupTags(
        rows: Array<{ record: RecordRow; tag: string | null }>,
    ): GetRecord[] {
        const grouped = new Map<
            number,
            { record: RecordRow; tags: string[] }
        >();

        for (const row of rows) {
            const existing = grouped.get(row.record.id);

            if (existing) {
                if (row.tag) {
                    existing.tags.push(row.tag);
                }
                continue;
            }

            grouped.set(row.record.id, {
                record: row.record,
                tags: row.tag ? [row.tag] : [],
            });
        }

        return Array.from(grouped.values()).map(({ record, tags }) =>
            this.mapRecord(record, [...new Set(tags)]),
        );
    }

    async createRecord(record: CreateRecord): Promise<GetRecord> {
        const [newRecord] = await this.db
            .insert(recordTable)
            .values(record)
            .returning();

        if (!newRecord) {
            throw new Error("Failed to create record");
        }

        return this.mapRecord(newRecord, []);
    }

    async getRecordById(recordId: number): Promise<GetRecord | undefined> {
        const rows = await this.db
            .select({
                record: recordTable,
                tag: tagsTable.tag,
            })
            .from(recordTable)
            .leftJoin(tagsTable, eq(tagsTable.recordId, recordTable.id))
            .where(eq(recordTable.id, recordId));

        if (!rows.length) {
            return undefined;
        }

        return this.groupTags(rows)[0];
    }

    async getRecords(userId?: number): Promise<GetRecord[] | undefined> {
        const rows = await this.db
            .select({
                record: recordTable,
                tag: tagsTable.tag,
            })
            .from(recordTable)
            .leftJoin(tagsTable, eq(tagsTable.recordId, recordTable.id))
            .where(userId ? eq(recordTable.userId, userId) : undefined);

        if (!rows.length) {
            return undefined;
        }

        return this.groupTags(rows);
    }

    async setProcessingStatus(
        recordId: number,
        status: AiRecordStatus,
    ): Promise<GetRecord> {
        const now = new Date();

        const [updatedRecord] = await this.db
            .update(recordTable)
            .set({
                status,
                error: status === "failed" ? recordTable.error : null,
                startedAt: status === "processing" ? now : undefined,
                finishedAt:
                    status === "uploaded" ||
                    status === "queued" ||
                    status === "processing"
                        ? null
                        : undefined,
            })
            .where(eq(recordTable.id, recordId))
            .returning();

        if (!updatedRecord) {
            throw new Error("Failed to update record status");
        }

        const current = await this.getRecordById(recordId);
        if (!current) {
            throw new Error("Record not found after status update");
        }

        return current;
    }

    async markQueued(recordId: number): Promise<GetRecord> {
        return this.setProcessingStatus(recordId, "queued");
    }

    async markProcessing(recordId: number): Promise<GetRecord> {
        return this.setProcessingStatus(recordId, "processing");
    }

    async finishProcessing(
        recordId: number,
        payload: FinishRecordProcessingPayload,
    ): Promise<GetRecord> {
        const [updatedRecord] = await this.db
            .update(recordTable)
            .set({
                transcription: payload.transcription,
                summary: payload.summary,
                durationSec: payload.durationSec ?? null,
                status: "done",
                error: null,
                finishedAt: new Date(),
                checkboxes: payload.checkboxes ?? null,
            })
            .where(eq(recordTable.id, recordId))
            .returning();

        if (!updatedRecord) {
            throw new Error("Failed to finish record processing");
        }

        await this.replaceTags(recordId, payload.tags ?? []);

        const current = await this.getRecordById(recordId);
        if (!current) {
            throw new Error("Record not found after finishing processing");
        }

        return current;
    }

    async failProcessing(recordId: number, error: string): Promise<GetRecord> {
        const [updatedRecord] = await this.db
            .update(recordTable)
            .set({
                status: "failed",
                error,
                finishedAt: new Date(),
            })
            .where(eq(recordTable.id, recordId))
            .returning();

        if (!updatedRecord) {
            throw new Error("Failed to mark record processing as failed");
        }

        const current = await this.getRecordById(recordId);
        if (!current) {
            throw new Error("Record not found after failure update");
        }

        return current;
    }

    async deleteRecord(recordId: number): Promise<void> {
        await this.db.delete(tagsTable).where(eq(tagsTable.recordId, recordId));
        await this.db.delete(recordTable).where(eq(recordTable.id, recordId));
    }
}

export default RecordService;
