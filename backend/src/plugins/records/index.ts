import Elysia, { t } from "elysia";
import { basename } from "node:path";
import { guardPlugin } from "../guard";
import {
    uploadRecordSchema,
    updateRecordCheckboxesSchema,
    type UpdateRecordCheckboxes,
    type UploadRecord,
} from "./schema";
import { IStorage } from "../../storage/interface";
import RecordService from "./service";
import RecordAiService from "./ai-service";
import UserService from "../user/service";

const recordsLog = (...args: unknown[]) => console.log("[records]", ...args);

const assertDirector = ({
    userRole,
    set,
}: {
    userRole: "director" | "manager";
    set: { status?: number | string };
}) => {
    if (userRole !== "director") {
        set.status = 403;
        return {
            message: "Forbidden",
        };
    }

    return null;
};

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
    fileUri: string | null,
    title?: string,
) => {
    startBackgroundTask(async () => {
        recordsLog("processing started", { recordId });

        try {
            // Guard: fileUri may be null for records that have no audio
            if (!fileUri) {
                recordsLog("skipping processing — no audio file", { recordId });
                await recordService.failProcessing(
                    recordId,
                    "No audio file available for processing",
                );
                return;
            }

            await recordService.markProcessing(recordId);

            const file = await storage.readIntoFile(fileUri);
            const result = await aiService.processFile(file, title);

            await recordService.finishProcessing(recordId, {
                transcription: result.transcription,
                title: result.title,
                summary: result.summary,
                durationSec: result.durationSec,
                qualityScore: result.qualityScore,
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
    userService: UserService,
) =>
    new Elysia({
        prefix: "/records",
    })
        .use(guardPlugin(userService))
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
        .get("/feed", async ({ userId }: { userId: number }) => {
            return (await recordService.getRecordsFeed(userId)) ?? [];
        })
        .get("/admin-feed", async ({ userRole, set }) => {
            const forbidden = assertDirector({ userRole, set });

            if (forbidden) {
                return forbidden;
            }

            return (await recordService.getAllRecordsFeed()) ?? [];
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
        )
        .get(
            "/by-mango-entry/:entryId",
            async ({ params, set }) => {
                const record = await recordService.findByMangoEntryId(
                    params.entryId,
                );

                if (!record) {
                    set.status = 404;
                    return { message: "Record not found" };
                }

                return record;
            },
            {
                params: t.Object({
                    entryId: t.String(),
                }),
            },
        )
        .get(
            "/:id/download",
            async ({ params, userId, userRole, set }) => {
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

                const canAccess =
                    userRole === "director" || record.userId === userId;

                if (!canAccess) {
                    set.status = 403;
                    return {
                        message: "Forbidden",
                    };
                }

                if (!record.fileUri || record.hasAudio === false) {
                    set.status = 404;
                    return {
                        message: "Audio file not found",
                    };
                }

                const file = await Bun.file(record.fileUri);

                if (!(await file.exists())) {
                    set.status = 404;
                    return {
                        message: "Audio file not found",
                    };
                }

                const fallbackName = `record-${record.id}.mp3`;
                const originalName = basename(record.fileUri);
                const safeFileName = originalName.trim() || fallbackName;

                set.headers["content-type"] =
                    file.type || "application/octet-stream";
                set.headers["content-length"] = String(file.size);
                set.headers["content-disposition"] =
                    `attachment; filename="${safeFileName}"`;

                return file;
            },
            {
                params: t.Object({
                    id: t.String(),
                }),
            },
        )
        .patch(
            "/:id/checkboxes",
            async ({ params, body, userId, userRole, set }) => {
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

                const canAccess =
                    userRole === "director" || record.userId === userId;

                if (!canAccess) {
                    set.status = 403;
                    return {
                        message: "Forbidden",
                    };
                }

                return await recordService.updateCheckboxes(
                    recordId,
                    (body as UpdateRecordCheckboxes).checkboxes,
                );
            },
            {
                params: t.Object({
                    id: t.String(),
                }),
                body: updateRecordCheckboxesSchema,
            },
        )
        .delete(
            "/:id",
            async ({ params, userRole, set }) => {
                const forbidden = assertDirector({ userRole, set });

                if (forbidden) {
                    return forbidden;
                }

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

                await recordService.deleteRecord(recordId);

                return {
                    message: "Record deleted",
                };
            },
            {
                params: t.Object({
                    id: t.String(),
                }),
            },
        );
