import RecordService from "../records/service";
import RecordAiService from "../records/ai-service";
import { IStorage } from "../../storage/interface";
import { MangoClient } from "./client";
import UserService from "../user/service";
import type { MangoSummaryPayload, MangoRecordAddedPayload } from "./schema";

const mangoLog = (...args: unknown[]) => console.log("[mango]", ...args);

const normalizeError = (e: unknown): string =>
    e instanceof Error ? e.message : "Unknown error";

export class MangoIngestionService {
    constructor(
        private readonly recordService: RecordService,
        private readonly userService: UserService,
        private readonly storage: IStorage,
        private readonly aiService: RecordAiService,
        private readonly mangoClient: MangoClient,
    ) {}

    // Handle /events/summary from Mango
    // Creates or updates the call record with metadata from the summary event
    // This event is the primary source for call metadata (direction, numbers, timestamps)
    async handleSummaryEvent(event: MangoSummaryPayload): Promise<void> {
        mangoLog("summary event received", { entry_id: event.entry_id });

        const directionKind =
            event.call_direction === 1 ? "inbound" : "outbound";
        const direction = directionKind;

        // talkDurationSec === 0 means call was never answered → missed
        const talkDurationSec = event.end_time - event.talk_time;
        const isMissed = talkDurationSec === 0;

        const callerNumber = event.from.number ?? event.from.extension ?? null;
        const calleeNumber = event.to.number ?? event.to.extension ?? null;

        // For inbound calls the customer is the caller, for outbound the customer is callee
        const callTo =
            direction === "inbound"
                ? (callerNumber ?? undefined)
                : (calleeNumber ?? undefined);

        await this.recordService.upsertMangoRecord({
            mangoEntryId: event.entry_id,
            direction,
            directionKind,
            callerNumber: callerNumber ?? undefined,
            calleeNumber: calleeNumber ?? undefined,
            lineNumber: event.line_number,
            callStartedAt: new Date(event.create_time * 1000),
            callAnsweredAt: isMissed
                ? undefined
                : new Date(event.talk_time * 1000),
            callEndedAt: new Date(event.end_time * 1000),
            talkDurationSec,
            isMissed,
            callTo,
        });

        mangoLog("summary event handled", {
            entry_id: event.entry_id,
            isMissed,
            direction,
            directionKind,
            talkDurationSec,
        });
    }

    // Handle /events/record/added from Mango
    // Downloads audio from Mango API, saves to storage, triggers AI pipeline
    async handleRecordAddedEvent(
        event: MangoRecordAddedPayload,
    ): Promise<void> {
        mangoLog("record/added event received", {
            entry_id: event.entry_id,
            recording_id: event.recording_id,
        });

        // Find the existing record — it should already exist from the summary event
        // If it does not (record/added arrived before summary), create a minimal entry
        let record = await this.recordService.findByMangoEntryId(
            event.entry_id,
        );

        if (!record) {
            mangoLog("record not found, creating minimal entry", {
                entry_id: event.entry_id,
            });
            const { record: created } =
                await this.recordService.upsertMangoRecord({
                    mangoEntryId: event.entry_id,
                    mangoUserId: event.user_id > 0 ? event.user_id : undefined,
                    isMissed: false,
                });
            record = created;
        }

        // Mark ingestion as in-progress
        await this.recordService.setIngestionStatus(record.id, "downloading");
        if (event.user_id > 0) {
            await this.recordService.setMangoUserId(record.id, event.user_id);

            const user = await this.userService.getUserByMangoUserId(
                event.user_id,
            );

            if (user) {
                await this.recordService.setRecordOwner(record.id, user.id);
                mangoLog("record linked to platform user", {
                    recordId: record.id,
                    userId: user.id,
                    mangoUserId: event.user_id,
                });
            } else {
                mangoLog("no platform user mapping for mango user", {
                    recordId: record.id,
                    mangoUserId: event.user_id,
                });
            }
        }

        try {
            // Download audio bytes from Mango
            mangoLog("downloading audio", {
                recording_id: event.recording_id,
            });

            const audioBytes = await this.mangoClient.downloadRecording(
                event.recording_id,
            );

            // Wrap bytes in a File object — compatible with IStorage.upload()
            const fileName = `mango-${event.entry_id}-${event.recording_id}.mp3`;
            const audioFile = new File([audioBytes], fileName, {
                type: "audio/mpeg",
            });

            // Save to storage using same LocalStorage used by manual uploads
            const storageKey = `mango/${event.entry_id}/${fileName}`;
            const fileUri = await this.storage.upload(storageKey, audioFile);

            mangoLog("audio saved to storage", {
                fileUri,
                recording_id: event.recording_id,
            });

            // Update record: set fileUri, mangoRecordingId, hasAudio=true, status=queued
            const updatedRecord = await this.recordService.setMangoAudio(
                record.id,
                fileUri,
                event.recording_id,
            );

            // Trigger AI pipeline — same flow as manual upload
            // Runs in background, does not block the webhook response
            this.runAiPipelineInBackground(
                updatedRecord.id,
                fileUri,
                updatedRecord.title ?? undefined,
            );

            mangoLog("AI pipeline triggered", { recordId: updatedRecord.id });
        } catch (error) {
            const message = normalizeError(error);
            mangoLog("ingestion failed", {
                entry_id: event.entry_id,
                message,
            });
            await this.recordService.setIngestionStatus(
                record.id,
                "failed",
                message,
            );
        }
    }

    // Mirrors processRecordInBackground from records/index.ts
    // Runs the same RecordAiService pipeline — no changes to AI logic
    private runAiPipelineInBackground(
        recordId: number,
        fileUri: string,
        title?: string,
    ): void {
        void (async () => {
            try {
                mangoLog("AI processing started", { recordId });
                await this.recordService.markProcessing(recordId);

                const file = await this.storage.readIntoFile(fileUri);
                const result = await this.aiService.processFile(file, title);

                await this.recordService.finishProcessing(recordId, {
                    transcription: result.transcription,
                    title: result.title,
                    summary: result.summary,
                    durationSec: result.durationSec,
                    qualityScore: result.qualityScore,
                    tags: result.tags,
                    checkboxes: result.checkboxes,
                });

                mangoLog("AI processing finished", { recordId });
            } catch (error) {
                const message = normalizeError(error);
                mangoLog("AI processing failed", { recordId, message });

                try {
                    await this.recordService.failProcessing(recordId, message);
                } catch {
                    mangoLog("failed to persist AI error", { recordId });
                }
            }
        })();
    }
}
