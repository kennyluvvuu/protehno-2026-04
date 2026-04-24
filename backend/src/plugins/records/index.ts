import Elysia from "elysia";
import { guardPlugin } from "../guard";
import { uploadRecordSchema } from "./schema";
import { IStorage } from "../../storage/interface";
import RecordService from "./service";

export const recordsPlugin = (
    recordService: RecordService,
    storage: IStorage,
) =>
    new Elysia({
        prefix: "/records",
    })
        .use(guardPlugin())
        .post(
            "/upload",
            async ({ userId, body: { file } }) => {
                const key = await storage.upload(
                    `${userId}/${file.name}`,
                    file,
                );
                const newRecord = await recordService.createRecord({
                    userId: userId,
                    fileUri: key,
                });
                return newRecord;
            },
            {
                body: uploadRecordSchema,
            },
        );
