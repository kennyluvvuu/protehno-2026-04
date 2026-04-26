import Elysia, { t } from "elysia";
import { z } from "zod";
import { MangoClient } from "./client";
import { MangoIngestionService } from "./service";
import {
    mangoSummaryPayloadSchema,
    mangoRecordAddedPayloadSchema,
    mangoCallPayloadSchema,
    mangoRecordingPayloadSchema,
    mangoRecordTaggedPayloadSchema,
    mangoDtmfPayloadSchema,
    mangoSmsPayloadSchema,
    mangoRecognizedOfflinePayloadSchema,
} from "./schema";

const webhookLog = (...args: unknown[]) =>
    console.log("[mango-webhook]", ...args);

const webhookBodySchema = t.Object({
    vpbx_api_key: t.String(),
    sign: t.String(),
    json: t.String(),
});

const createSignedWebhookHandler = <T>(
    mangoClient: MangoClient,
    eventName: string,
    payloadSchema: z.ZodType<T>,
    onValidPayload: (payload: T) => Promise<void>,
) => {
    return async (context: any) => {
        const { body, set } = context as {
            body: { vpbx_api_key: string; sign: string; json: string };
            set: { status: number | string | undefined };
        };
        const { vpbx_api_key, sign, json } = body as {
            vpbx_api_key: string;
            sign: string;
            json: string;
        };

        if (!mangoClient.verifyWebhookSignature(vpbx_api_key, sign, json)) {
            webhookLog(`rejected ${eventName} — invalid signature`);
            set.status = 403;
            return { message: "Invalid signature" };
        }

        let payload: unknown;
        try {
            payload = JSON.parse(json);
        } catch {
            set.status = 400;
            return { message: "Malformed JSON in webhook body" };
        }

        const parsed = payloadSchema.safeParse(payload);
        if (!parsed.success) {
            webhookLog(
                `${eventName} payload validation failed`,
                parsed.error.flatten(),
            );
            set.status = 400;
            return { message: "Invalid payload structure" };
        }

        // Process asynchronously — respond immediately so Mango does not retry
        void onValidPayload(parsed.data).catch((error) => {
            webhookLog(`${eventName} handler unhandled error`, error);
        });

        set.status = 200;
        return { ok: true };
    };
};

export const mangoWebhookPlugin = (
    mangoClient: MangoClient,
    ingestionService: MangoIngestionService,
) =>
    new Elysia({ prefix: "/integrations/mango" })
        // POST /integrations/mango/events/summary
        // Mango calls this endpoint when a call ends with full metadata
        .post(
            "/events/summary",
            createSignedWebhookHandler(
                mangoClient,
                "summary",
                mangoSummaryPayloadSchema,
                (payload) => ingestionService.handleSummaryEvent(payload),
            ),
            { body: webhookBodySchema },
        )
        // POST /integrations/mango/events/record/added
        // Mango calls this endpoint when a recording is ready for download
        .post(
            "/events/record/added",
            createSignedWebhookHandler(
                mangoClient,
                "record/added",
                mangoRecordAddedPayloadSchema,
                (payload) => ingestionService.handleRecordAddedEvent(payload),
            ),
            { body: webhookBodySchema },
        )
        // POST /integrations/mango/events/call
        .post(
            "/events/call",
            createSignedWebhookHandler(
                mangoClient,
                "call",
                mangoCallPayloadSchema,
                (payload) => ingestionService.handleCallEvent(payload),
            ),
            { body: webhookBodySchema },
        )
        // POST /integrations/mango/events/recording
        .post(
            "/events/recording",
            createSignedWebhookHandler(
                mangoClient,
                "recording",
                mangoRecordingPayloadSchema,
                (payload) => ingestionService.handleRecordingEvent(payload),
            ),
            { body: webhookBodySchema },
        )
        // POST /integrations/mango/events/record/tagged
        .post(
            "/events/record/tagged",
            createSignedWebhookHandler(
                mangoClient,
                "record/tagged",
                mangoRecordTaggedPayloadSchema,
                (payload) => ingestionService.handleRecordTaggedEvent(payload),
            ),
            { body: webhookBodySchema },
        )
        // POST /integrations/mango/events/dtmf
        .post(
            "/events/dtmf",
            createSignedWebhookHandler(
                mangoClient,
                "dtmf",
                mangoDtmfPayloadSchema,
                (payload) => ingestionService.handleDtmfEvent(payload),
            ),
            { body: webhookBodySchema },
        )
        // POST /integrations/mango/events/sms
        .post(
            "/events/sms",
            createSignedWebhookHandler(
                mangoClient,
                "sms",
                mangoSmsPayloadSchema,
                (payload) => ingestionService.handleSmsEvent(payload),
            ),
            { body: webhookBodySchema },
        )
        // POST /integrations/mango/events/recognized/offline
        .post(
            "/events/recognized/offline",
            createSignedWebhookHandler(
                mangoClient,
                "recognized/offline",
                mangoRecognizedOfflinePayloadSchema,
                (payload) =>
                    ingestionService.handleRecognizedOfflineEvent(payload),
            ),
            { body: webhookBodySchema },
        );
