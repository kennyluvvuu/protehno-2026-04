import RecordService from "../records/service";
import RecordAiService from "../records/ai-service";
import { detectAudioDurationSec } from "../records/audio-duration";
import { IStorage } from "../../storage/interface";
import { MangoClient } from "./client";
import UserService from "../user/service";
import type {
    MangoSummaryPayload,
    MangoRecordAddedPayload,
    MangoCallPayload,
    MangoRecordingPayload,
    MangoRecordTaggedPayload,
    MangoDtmfPayload,
    MangoSmsPayload,
    MangoRecognizedOfflinePayload,
} from "./schema";

const mangoLog = (...args: unknown[]) => console.log("[mango]", ...args);

const normalizeError = (e: unknown): string =>
    e instanceof Error ? e.message : "Unknown error";

const inferDirectionFromCallEvent = (
    event: MangoCallPayload,
): "inbound" | "outbound" | "unknown" => {
    const fromNumber = event.from?.number;
    const toNumber = event.to?.number;
    const fromExtension = event.from?.extension;
    const toExtension = event.to?.extension;

    if (fromNumber && typeof toExtension === "number") return "inbound";
    if (typeof fromExtension === "number" && toNumber) return "outbound";
    return "unknown";
};

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
            const durationSec = await detectAudioDurationSec(fileUri);

            mangoLog("audio saved to storage", {
                fileUri,
                recording_id: event.recording_id,
                durationSec,
            });

            // Update record: set fileUri, mangoRecordingId, hasAudio=true, status=queued
            const updatedRecord = await this.recordService.setMangoAudio(
                record.id,
                fileUri,
                event.recording_id,
                durationSec,
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

    // Handle /events/call from Mango
    // Keeps near-realtime call metadata in sync before /events/summary arrives
    async handleCallEvent(event: MangoCallPayload): Promise<void> {
        const direction = inferDirectionFromCallEvent(event);
        const callerNumber =
            event.from?.number ?? event.from?.extension?.toString();
        const calleeNumber =
            event.to?.number ?? event.to?.extension?.toString();

        const callTo =
            direction === "inbound"
                ? callerNumber
                : direction === "outbound"
                  ? calleeNumber
                  : undefined;

        await this.recordService.upsertMangoRecord({
            mangoEntryId: event.entry_id,
            mangoCallId: event.call_id,
            isMissed: false,
            direction,
            directionKind: direction,
            callerNumber,
            calleeNumber,
            lineNumber: event.to?.line_number,
            callStartedAt: new Date(event.timestamp * 1000),
            callTo,
        });

        mangoLog("call event handled", {
            entry_id: event.entry_id,
            call_id: event.call_id,
            call_state: event.call_state,
            seq: event.seq,
        });
    }

    // Handle /events/recording from Mango
    // Tracks recording lifecycle; record/added remains the trigger for download
    async handleRecordingEvent(event: MangoRecordingPayload): Promise<void> {
        await this.recordService.upsertMangoRecord({
            mangoEntryId: event.entry_id,
            mangoCallId: event.call_id,
            extension: event.extension,
            isMissed: false,
        });

        mangoLog("recording event handled", {
            entry_id: event.entry_id,
            call_id: event.call_id,
            recording_id: event.recording_id,
            recording_state: event.recording_state,
            seq: event.seq,
        });
    }

    // Handle /events/record/tagged from Mango
    // Notification-only event in current implementation
    async handleRecordTaggedEvent(
        event: MangoRecordTaggedPayload,
    ): Promise<void> {
        mangoLog("record/tagged event handled", {
            entry_id: event.entry_id,
            recording_id: event.recording_id,
            user_id: event.user_id,
            product_id: event.product_id,
        });
    }

    // Handle /events/dtmf from Mango
    // Notification-only event in current implementation
    async handleDtmfEvent(event: MangoDtmfPayload): Promise<void> {
        mangoLog("dtmf event handled", {
            entry_id: event.entry_id,
            call_id: event.call_id,
            seq: event.seq,
            location: event.location,
        });
    }

    // Handle /events/sms from Mango
    // Notification-only event in current implementation
    async handleSmsEvent(event: MangoSmsPayload): Promise<void> {
        mangoLog("sms event handled", {
            command_id: event.command_id,
            reason: event.reason,
        });
    }

    // Handle /events/recognized/offline from Mango
    // Notification-only event in current implementation
    async handleRecognizedOfflineEvent(
        event: MangoRecognizedOfflinePayload,
    ): Promise<void> {
        mangoLog("recognized/offline event handled", {
            request_id: event.request_id,
            result: event.result,
            recognized: event.recognized,
        });
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
