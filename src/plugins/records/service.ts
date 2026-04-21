import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { CreateRecord, GetRecord } from "./schema";
import { recordTable } from "./model";

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
        return newRecord;
    }
}
