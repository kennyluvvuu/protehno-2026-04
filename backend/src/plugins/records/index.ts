import Elysia, { t } from "elysia";
import { guardPlugin } from "../guard";
import { uploadRecordSchema, type UploadRecord } from "./schema";
import { IStorage } from "../../storage/interface";
import RecordService from "./service";
import RecordAiService from "./ai-service";

const recordsLog = (...args: unknown[]) => console.log("[records]", ...args);

const normalizeErrorMessage = (error: unknown) =>
    error instanceof Error ? error.message : "Unknown processing error";

const startBackgroundTask = (task: () => Promise<void>) => {
    void task().catch((error) => {
        recordsLog("background task failed", {
            message: normalizeErrorMessage(error),
        });
    });
};

const processRecordInBackground = (
    recordService: RecordService,
    storage: IStorage,
    aiService: RecordAiService,
    recordId: number,
    fileUri: string,
    title?: string,
) => {
    startBackgroundTask(async () => {
        recordsLog("processing started", { recordId });

        try {
            await recordService.markProcessing(recordId);

            const file = await storage.readIntoFile(fileUri);
            const result = await aiService.processFile(file, title);

            await recordService.finishProcessing(recordId, {
                transcription: result.transcription,
                title: result.title,
                summary: result.summary,
                durationSec: result.durationSec,
                tags: result.tags,
                checkboxes: result.checkboxes,
            });

            recordsLog("processing finished", {
                recordId,
                tagsCount: result.tags.length,
            });
        } catch (error) {
            const message = normalizeErrorMessage(error);

            recordsLog("processing failed", {
                recordId,
                message,
            });

            try {
                await recordService.failProcessing(recordId, message);
            } catch (persistError) {
                recordsLog("failed to persist processing error", {
                    recordId,
                    message: normalizeErrorMessage(persistError),
                });
            }
        }
    });
};

export const recordsPlugin = (
    recordService: RecordService,
    storage: IStorage,
    aiService: RecordAiService,
) =>
    new Elysia({
        prefix: "/records",
    })
        .use(guardPlugin())
        .post(
            "/upload",
            async ({ userId, body, set }) => {
                const { file, title, callTo } = body as UploadRecord;
                const normalizedTitle = title?.trim() || null;
                const fileUri = await storage.upload(
                    `${userId}/${Date.now()}-${file.name}`,
                    file,
                );

                const newRecord = await recordService.createRecord({
                    userId,
                    fileUri,
                    callTo: callTo?.trim() || null,
                    title: normalizedTitle,
                    status: "queued",
                });

                processRecordInBackground(
                    recordService,
                    storage,
                    aiService,
                    newRecord.id,
                    fileUri,
                    normalizedTitle || undefined,
                );

                set.status = 202;

                return {
                    id: newRecord.id,
                    userId: newRecord.userId,
                    fileUri: newRecord.fileUri,
                    status: "queued" as const,
                    message: "Record uploaded and queued for async processing",
                };
            },
            {
                body: uploadRecordSchema,
            },
        )
        .get("/", async ({ userId }: { userId: number }) => {
            return (await recordService.getRecords(userId)) ?? [];
        })
        .get(
            "/:id",
            async ({ params, userId, set }) => {
                const recordId = Number(params.id);

                if (Number.isNaN(recordId)) {
                    set.status = 400;
                    return {
                        message: "Invalid record id",
                    };
                }

                const record = await recordService.getRecordById(recordId);

                if (!record) {
                    set.status = 404;
                    return {
                        message: "Record not found",
                    };
                }

                if (record.userId !== userId) {
                    set.status = 403;
                    return {
                        message: "Forbidden",
                    };
                }

                return record;
            },
            {
                params: t.Object({
                    id: t.String(),
                }),
            },
        );
