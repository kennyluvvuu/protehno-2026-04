import { and, desc, eq, isNull, or } from "drizzle-orm";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import {
    type AiCheckboxGroups,
    type AiRecordStatus,
    type CreateRecord,
    type GetRecord,
    type IngestionStatus,
    type CreateMangoRecord,
} from "./schema";
import { recordTable, tagsTable } from "./model";

type RecordRow = typeof recordTable.$inferSelect;
type TagRow = typeof tagsTable.$inferSelect;

type FinishRecordProcessingPayload = {
    transcription: string;
    summary: string;
    title?: string | null;
    durationSec?: number | null;
    tags?: string[];
    checkboxes?: AiCheckboxGroups | null;
};

class RecordService {
    constructor(private readonly db: NodePgDatabase) {
        this.db = db;
    }

    private mapRecord(record: RecordRow, tags: string[]): GetRecord {
        const source: GetRecord["source"] =
            record.source === "manual" || record.source === "mango"
                ? record.source
                : undefined;

        const ingestionStatus: GetRecord["ingestionStatus"] =
            record.ingestionStatus === "ready" ||
            record.ingestionStatus === "pending_audio" ||
            record.ingestionStatus === "downloading" ||
            record.ingestionStatus === "no_audio" ||
            record.ingestionStatus === "failed"
                ? record.ingestionStatus
                : undefined;

        return {
            ...record,
            source,
            ingestionStatus,
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

    async getRecordsFeed(userId: number): Promise<GetRecord[] | undefined> {
        const rows = await this.db
            .select({
                record: recordTable,
                tag: tagsTable.tag,
            })
            .from(recordTable)
            .leftJoin(tagsTable, eq(tagsTable.recordId, recordTable.id))
            .where(
                or(
                    eq(recordTable.userId, userId),
                    and(
                        eq(recordTable.source, "mango"),
                        isNull(recordTable.userId),
                    ),
                ),
            )
            .orderBy(desc(recordTable.callStartedAt), desc(recordTable.id));

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
                title: payload.title ?? null,
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

    // Find a record by Mango entry_id
    async findByMangoEntryId(
        mangoEntryId: string,
    ): Promise<GetRecord | undefined> {
        const rows = await this.db
            .select({
                record: recordTable,
                tag: tagsTable.tag,
            })
            .from(recordTable)
            .leftJoin(tagsTable, eq(tagsTable.recordId, recordTable.id))
            .where(eq(recordTable.mangoEntryId, mangoEntryId));

        if (!rows.length) return undefined;
        return this.groupTags(rows)[0];
    }

    // Create a new record from Mango event metadata (no audio file yet)
    async createMangoRecord(payload: CreateMangoRecord): Promise<GetRecord> {
        const isMissed = payload.isMissed ?? false;

        const [newRecord] = await this.db
            .insert(recordTable)
            .values({
                source: "mango",
                // Missed calls will never have audio; recorded calls wait for record/added
                ingestionStatus: isMissed ? "no_audio" : "pending_audio",
                hasAudio: false,
                isMissed,
                // Missed calls have no audio to process — mark status as not_applicable
                // Recorded calls will transition to queued once audio is downloaded
                status: isMissed ? "not_applicable" : "uploaded",
                mangoEntryId: payload.mangoEntryId,
                mangoCallId: payload.mangoCallId ?? null,
                mangoUserId: payload.mangoUserId ?? null,
                direction: payload.direction ?? "unknown",
                callerNumber: payload.callerNumber ?? null,
                calleeNumber: payload.calleeNumber ?? null,
                lineNumber: payload.lineNumber ?? null,
                extension: payload.extension ?? null,
                callStartedAt: payload.callStartedAt ?? null,
                callAnsweredAt: payload.callAnsweredAt ?? null,
                callEndedAt: payload.callEndedAt ?? null,
                talkDurationSec: payload.talkDurationSec ?? null,
                callTo: payload.callTo ?? payload.callerNumber ?? null,
                title: payload.title ?? null,
                fileUri: null,
                userId: null,
            })
            .returning();

        if (!newRecord) throw new Error("Failed to create Mango record");
        return this.mapRecord(newRecord, []);
    }

    // Update a Mango record after audio has been downloaded and saved to storage
    async setMangoAudio(
        recordId: number,
        fileUri: string,
        mangoRecordingId: string,
    ): Promise<GetRecord> {
        const [updated] = await this.db
            .update(recordTable)
            .set({
                fileUri,
                mangoRecordingId,
                hasAudio: true,
                ingestionStatus: "ready",
                // Transition to queued so the AI pipeline can pick it up
                status: "queued",
            })
            .where(eq(recordTable.id, recordId))
            .returning();

        if (!updated) throw new Error("Failed to update Mango audio info");

        const current = await this.getRecordById(recordId);
        if (!current)
            throw new Error("Record not found after Mango audio update");
        return current;
    }

    // Update ingestion lifecycle status (used during Mango download flow)
    async setIngestionStatus(
        recordId: number,
        ingestionStatus: IngestionStatus,
        ingestionError?: string,
    ): Promise<void> {
        await this.db
            .update(recordTable)
            .set({
                ingestionStatus,
                ingestionError: ingestionError ?? null,
            })
            .where(eq(recordTable.id, recordId));
    }

    // Find by mangoEntryId and update metadata, or create a new record if not found
    async upsertMangoRecord(
        payload: CreateMangoRecord,
    ): Promise<{ record: GetRecord; created: boolean }> {
        const existing = await this.findByMangoEntryId(payload.mangoEntryId);

        if (existing) {
            // Update call metadata — prefer incoming payload values over existing ones
            await this.db
                .update(recordTable)
                .set({
                    mangoUserId: payload.mangoUserId ?? existing.mangoUserId,
                    direction:
                        payload.direction ??
                        (existing.direction as
                            | "inbound"
                            | "outbound"
                            | "unknown"
                            | null
                            | undefined) ??
                        "unknown",
                    callerNumber:
                        payload.callerNumber ?? existing.callerNumber,
                    calleeNumber:
                        payload.calleeNumber ?? existing.calleeNumber,
                    lineNumber: payload.lineNumber ?? existing.lineNumber,
                    callStartedAt:
                        payload.callStartedAt ?? existing.callStartedAt,
                    callAnsweredAt:
                        payload.callAnsweredAt ?? existing.callAnsweredAt,
                    callEndedAt: payload.callEndedAt ?? existing.callEndedAt,
                    talkDurationSec:
                        payload.talkDurationSec ?? existing.talkDurationSec,
                    isMissed: payload.isMissed,
                    callTo: payload.callTo ?? existing.callTo,
                    // Update ingestionStatus if call is now known to be missed
                    ingestionStatus: payload.isMissed
                        ? "no_audio"
                        : existing.ingestionStatus ?? "pending_audio",
                    status: payload.isMissed
                        ? "not_applicable"
                        : existing.status ?? "uploaded",
                })
                .where(eq(recordTable.mangoEntryId, payload.mangoEntryId));

            const updated = await this.findByMangoEntryId(
                payload.mangoEntryId,
            );
            return { record: updated!, created: false };
        }

        const created = await this.createMangoRecord(payload);
        return { record: created, created: true };
    }

    async setMangoUserId(recordId: number, mangoUserId: number): Promise<void> {
        await this.db
            .update(recordTable)
            .set({ mangoUserId })
            .where(eq(recordTable.id, recordId));
    }

    async setRecordOwner(recordId: number, userId: number): Promise<void> {
        await this.db
            .update(recordTable)
            .set({ userId })
            .where(eq(recordTable.id, recordId));
    }

    async assignUnownedMangoRecordsToUser(
        mangoUserId: number,
        userId: number,
    ): Promise<number> {
        const updated = await this.db
            .update(recordTable)
            .set({ userId })
            .where(
                and(
                    eq(recordTable.source, "mango"),
                    eq(recordTable.mangoUserId, mangoUserId),
                    isNull(recordTable.userId),
                ),
            )
            .returning({ id: recordTable.id });

        return updated.length;
    }
}

export default RecordService;
