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
export const mangoCallPayloadSchema = z.object({
    entry_id: z.string(),
    call_id: z.string(),
    timestamp: z.number().int(),
    seq: z.number().int(),
    call_state: z.enum(["Appeared", "Connected", "OnHold", "Disconnected"]),
    location: z.string().optional(),
    from: z
        .object({
            extension: z.number().optional(),
            number: z.string().optional(),
            taken_from_call_id: z.string().optional(),
            was_transferred: z.boolean().optional(),
            hold_initiator: z.boolean().optional(),
        })
        .optional(),
    to: z
        .object({
            extension: z.number().optional(),
            number: z.string().optional(),
            line_number: z.string().optional(),
            acd_group: z.number().optional(),
            was_transferred: z.boolean().optional(),
            hold_initiator: z.boolean().optional(),
        })
        .optional(),
    dct: z
        .object({
            number: z.string().optional(),
            type: z.number().int(),
        })
        .optional(),
    disconnect_reason: z.number().optional(),
    transfer: z.string().optional(),
    sip_call_id: z.string().optional(),
    command_id: z.string().optional(),
    task_id: z.number().int().optional(),
    callback_initiator: z.string().optional(),
});
export type MangoCallPayload = z.infer<typeof mangoCallPayloadSchema>;

// /events/recording — sent by Mango while a recording is being processed
export const mangoRecordingPayloadSchema = z.object({
    recording_id: z.string(),
    recording_state: z.enum(["Started", "Continued", "Completed"]),
    seq: z.number().int(),
    entry_id: z.string(),
    call_id: z.string(),
    extension: z.string().optional(),
    timestamp: z.number().int(),
    completion_code: z.number().int().optional(),
    recipient: z.enum(["Cloud", "Mail", "CloudAndMail"]).optional(),
    command_id: z.string().optional(),
});
export type MangoRecordingPayload = z.infer<typeof mangoRecordingPayloadSchema>;

// /events/record/tagged — sent when recording categories are ready
export const mangoRecordTaggedPayloadSchema = z.object({
    entry_id: z.string(),
    product_id: z.number().int(),
    user_id: z.number().int(),
    timestamp: z.number().int(),
    recording_id: z.string(),
});
export type MangoRecordTaggedPayload = z.infer<
    typeof mangoRecordTaggedPayloadSchema
>;

// /events/dtmf — sent when DTMF sequence is detected
export const mangoDtmfPayloadSchema = z.object({
    seq: z.number().int(),
    dtmf: z.string(),
    timestamp: z.number().int(),
    call_id: z.string(),
    entry_id: z.string(),
    location: z.string(),
    initiator: z.string(),
    from_number: z.string().optional(),
    to_number: z.string().optional(),
    line_number: z.string().optional(),
});
export type MangoDtmfPayload = z.infer<typeof mangoDtmfPayloadSchema>;

// /events/sms — sent when SMS command status changes
export const mangoSmsPayloadSchema = z.object({
    command_id: z.string(),
    timestamp: z.number().int(),
    reason: z.number().int(),
});
export type MangoSmsPayload = z.infer<typeof mangoSmsPayloadSchema>;

// /events/recognized/offline — sent when offline recognition task completes
export const mangoRecognizedOfflinePayloadSchema = z.object({
    product_id: z.number().int(),
    request_id: z.union([z.string(), z.number().int()]),
    recognized: z.number().int().optional(),
    result: z.number().int(),
    message: z.string().optional(),
});
export type MangoRecognizedOfflinePayload = z.infer<
    typeof mangoRecognizedOfflinePayloadSchema
>;

// Wrapper schema for the form-encoded request body of any Mango webhook
// Mango sends: vpbx_api_key + sign + json (the actual payload as a JSON string)
export const mangoWebhookRequestSchema = z.object({
    vpbx_api_key: z.string(),
    sign: z.string(),
    json: z.string(),
});
export type MangoWebhookRequest = z.infer<typeof mangoWebhookRequestSchema>;
