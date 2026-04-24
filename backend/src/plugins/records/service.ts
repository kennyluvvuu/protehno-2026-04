import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { CreateRecord, GetRecord } from "./schema";
import { recordTable, tagsTable } from "./model";
import { eq } from "drizzle-orm";

class RecordService {
    constructor(private readonly db: NodePgDatabase) {
        this.db = db;
    }

    async createRecord(record: CreateRecord): Promise<GetRecord> {
        const [newRecord] = await this.db
            .insert(recordTable)
            .values(record)
            .returning();

        if (!newRecord) {
            throw new Error("Failed to create record");
        }

        return {
            ...newRecord,
            tags: [],
        };
    }

    async getRecordById(recordId: number): Promise<GetRecord | undefined> {
        const [record] = await this.db
            .select({
                id: recordTable.id,
                userId: recordTable.userId,
                callTo: recordTable.callTo,
                durationSec: recordTable.durationSec,
                fileUri: recordTable.fileUri,
                transcription: recordTable.transcription,
                summary: recordTable.summary,
                tag: tagsTable.tag,
            })
            .from(recordTable)
            .leftJoin(tagsTable, eq(tagsTable.recordId, recordTable.id))
            .where(eq(recordTable.id, recordId));

        if (!record) {
            return undefined;
        }

        return {
            id: record.id,
            userId: record.userId,
            callTo: record.callTo,
            durationSec: record.durationSec,
            fileUri: record.fileUri,
            transcription: record.transcription,
            summary: record.summary,
            tags: record.tag ? [record.tag] : [],
        };
    }

    async getRecords(userId?: number): Promise<GetRecord[] | undefined> {
        const records = await this.db
            .select({
                id: recordTable.id,
                userId: recordTable.userId,
                callTo: recordTable.callTo,
                durationSec: recordTable.durationSec,
                fileUri: recordTable.fileUri,
                transcription: recordTable.transcription,
                summary: recordTable.summary,
                tag: tagsTable.tag,
            })
            .from(recordTable)
            .leftJoin(tagsTable, eq(tagsTable.recordId, recordTable.id))
            .where(userId ? eq(recordTable.userId, userId) : undefined);

        if (!records.length) {
            return undefined;
        }

        return records.map((record) => ({
            id: record.id,
            userId: record.userId,
            callTo: record.callTo,
            durationSec: record.durationSec,
            fileUri: record.fileUri,
            transcription: record.transcription,
            summary: record.summary,
            tags: record.tag ? [record.tag] : [],
        }));
    }

    async deleteRecord(recordId: number): Promise<void> {
        await this.db.delete(recordTable).where(eq(recordTable.id, recordId));
    }
}

export default RecordService;
