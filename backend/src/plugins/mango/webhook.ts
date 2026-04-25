import Elysia, { t } from "elysia";
import { MangoClient } from "./client";
import { MangoIngestionService } from "./service";
import {
    mangoSummaryPayloadSchema,
    mangoRecordAddedPayloadSchema,
} from "./schema";

const webhookLog = (...args: unknown[]) =>
    console.log("[mango-webhook]", ...args);

export const mangoWebhookPlugin = (
    mangoClient: MangoClient,
    ingestionService: MangoIngestionService,
) =>
    new Elysia({ prefix: "/integrations/mango" })
        // POST /integrations/mango/events/summary
        // Mango calls this endpoint when a call ends with full metadata
        .post(
            "/events/summary",
            async ({ body, set }) => {
                const { vpbx_api_key, sign, json } = body as {
                    vpbx_api_key: string;
                    sign: string;
                    json: string;
                };

                if (
                    !mangoClient.verifyWebhookSignature(
                        vpbx_api_key,
                        sign,
                        json,
                    )
                ) {
                    webhookLog("rejected summary — invalid signature");
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

                const parsed = mangoSummaryPayloadSchema.safeParse(payload);
                if (!parsed.success) {
                    webhookLog(
                        "summary payload validation failed",
                        parsed.error.flatten(),
                    );
                    set.status = 400;
                    return { message: "Invalid payload structure" };
                }

                // Process asynchronously — respond immediately so Mango does not retry
                void ingestionService
                    .handleSummaryEvent(parsed.data)
                    .catch((e) => {
                        webhookLog("handleSummaryEvent unhandled error", e);
                    });

                set.status = 200;
                return { ok: true };
            },
            {
                body: t.Object({
                    vpbx_api_key: t.String(),
                    sign: t.String(),
                    json: t.String(),
                }),
            },
        )
        // POST /integrations/mango/events/record/added
        // Mango calls this endpoint when a recording is ready for download
        .post(
            "/events/record/added",
            async ({ body, set }) => {
                const { vpbx_api_key, sign, json } = body as {
                    vpbx_api_key: string;
                    sign: string;
                    json: string;
                };

                if (
                    !mangoClient.verifyWebhookSignature(
                        vpbx_api_key,
                        sign,
                        json,
                    )
                ) {
                    webhookLog("rejected record/added — invalid signature");
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

                const parsed =
                    mangoRecordAddedPayloadSchema.safeParse(payload);
                if (!parsed.success) {
                    webhookLog(
                        "record/added payload validation failed",
                        parsed.error.flatten(),
                    );
                    set.status = 400;
                    return { message: "Invalid payload structure" };
                }

                // Process asynchronously — respond immediately so Mango does not retry
                void ingestionService
                    .handleRecordAddedEvent(parsed.data)
                    .catch((e) => {
                        webhookLog(
                            "handleRecordAddedEvent unhandled error",
                            e,
                        );
                    });

                set.status = 200;
                return { ok: true };
            },
            {
                body: t.Object({
                    vpbx_api_key: t.String(),
                    sign: t.String(),
                    json: t.String(),
                }),
            },
        );
