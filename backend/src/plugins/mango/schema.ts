import { z } from "zod";

// /events/summary — sent by Mango when a call fully ends
// Represents the final metadata of the call
export const mangoSummaryPayloadSchema = z.object({
    entry_id: z.string(),
    // 1 = inbound, 2 = outbound
    call_direction: z.number().int(),
    from: z.object({
        extension: z.string().optional(),
        number: z.string().optional(),
    }),
    to: z.object({
        extension: z.string().optional(),
        number: z.string().optional(),
    }),
    line_number: z.string().optional(),
    create_time: z.number().int(), // UNIX timestamp: call created
    forward_time: z.number().int(), // UNIX timestamp: call forwarded
    // If talk_time === create_time, the call was never answered (missed)
    talk_time: z.number().int(), // UNIX timestamp: call answered
    end_time: z.number().int(), // UNIX timestamp: call ended
    // 0 = answered successfully; non-zero = various miss/busy/error outcomes
    entry_result: z.number().int(),
    disconnect_reason: z.number().int(),
    sip_call_id: z.string().optional(),
});
export type MangoSummaryPayload = z.infer<typeof mangoSummaryPayloadSchema>;

// /events/record/added — sent by Mango when a recording is ready for download
export const mangoRecordAddedPayloadSchema = z.object({
    entry_id: z.string(),
    product_id: z.number().int(),
    user_id: z.number().int(),
    recording_id: z.string(),
    timestamp: z.number().int(),
});
export type MangoRecordAddedPayload = z.infer<
    typeof mangoRecordAddedPayloadSchema
>;

// /events/call — sent by Mango on each call state change (realtime)
// Optional for MVP — included for future use
export const mangoCallPayloadSchema = z.object({
    entry_id: z.string(),
    call_id: z.string(),
    timestamp: z.number().int(),
    seq: z.number().int(),
    call_state: z.enum(["Appeared", "Connected", "OnHold", "Disconnected"]),
    from: z
        .object({
            extension: z.number().optional(),
            number: z.string().optional(),
        })
        .optional(),
    to: z
        .object({
            extension: z.number().optional(),
            number: z.string().optional(),
            line_number: z.string().optional(),
        })
        .optional(),
    disconnect_reason: z.number().optional(),
    command_id: z.string().optional(),
});
export type MangoCallPayload = z.infer<typeof mangoCallPayloadSchema>;

// Wrapper schema for the form-encoded request body of any Mango webhook
// Mango sends: vpbx_api_key + sign + json (the actual payload as a JSON string)
export const mangoWebhookRequestSchema = z.object({
    vpbx_api_key: z.string(),
    sign: z.string(),
    json: z.string(),
});
export type MangoWebhookRequest = z.infer<typeof mangoWebhookRequestSchema>;
