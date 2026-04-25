# IMPLEMENTATION_PLAN.md — Mango Office ingestion alongside manual upload

## Purpose

This document is a step-by-step implementation guide for an AI agent.
It extends the existing backend with Mango Office call ingestion as an
alternative audio source, while preserving all existing manual upload
functionality, cookie auth flow, and the current AI pipeline.

Read the entire document before making any changes.
Implement the steps in order — each step depends on the previous one.

---

## Current codebase map

```
backend/src/
  index.ts                          — server bootstrap, instantiates all services
  database/service.ts               — drizzle db connection factory
  storage/
    interface.ts                    — IStorage interface
    local.ts                        — LocalStorage implementation
  plugins/
    auth/
      index.ts                      — POST /login, POST /logout, sets httpOnly cookie
      schema.ts                     — loginSchema
    errors/
      index.ts                      — global Elysia error handler
    guard/
      index.ts                      — JWT guard plugin, derives userId from cookie
    user/
      index.ts                      — GET /users, GET /users/:id, GET /users/me, POST /users/register
      model.ts                      — userTable (drizzle)
      schema.ts                     — BaseUser, CreateUser, GetUser zod types
      service.ts                    — UserService class
    records/
      index.ts                      — POST /records/upload, GET /records, GET /records/:id
      model.ts                      — recordTable, tagsTable (drizzle)
      schema.ts                     — zod/elysia schemas and types
      service.ts                    — RecordService class (CRUD + status updates)
      ai-service.ts                 — RecordAiService (transcribe + summarize via Groq + Mistral)
```

---

## Invariants — must not break after all changes

The following must remain working exactly as before:

1. `POST /login` sets httpOnly cookie `auth`, returns user object
2. `POST /logout` removes cookie
3. `POST /users/register` creates user
4. `GET /users`, `GET /users/:id`, `GET /users/me` return users (require auth cookie)
5. `POST /records/upload` accepts `multipart/form-data` with `file`, optional `title`, optional `callTo`
   — must return `202` with `{ id, userId, fileUri, status: "queued", message }`
6. `GET /records` returns array of records for the logged-in user
7. `GET /records/:id` returns a single record with ownership check (403 if userId mismatch)
8. `RecordAiService` class — do NOT modify this file at all
9. `IStorage` interface — do NOT modify
10. `LocalStorage` class — do NOT modify
11. `guardPlugin` — do NOT modify
12. Status values `queued`, `processing`, `done`, `failed` — still valid and returned to frontend
13. `drizzle.config.ts` — do NOT modify (already correct, picks up `./src/plugins/**/model.ts`)

---

## Architecture decision summary

- Mango records reuse the same `records` table with new nullable columns
- `fileUri` becomes nullable — missed calls have no audio file
- `userId` becomes nullable — Mango records are not owned by a platform user
- A new `ingestionStatus` field tracks Mango ingestion lifecycle separately from AI `status`
- `RecordAiService.processFile()` is called the same way for both manual and Mango audio
- Mango records are NOT visible in `GET /records` (userId=null filtered out by userId query)
- Mango records ARE accessible via new `GET /records/by-mango-entry/:entryId` endpoint
- A new `mango/` plugin directory handles all Mango-specific logic

---

## New environment variables

Add these to `.env`, `backend/.env.example`, and `docker-compose.yaml`:

```
MANGO_VPBX_API_KEY=         # from Mango Office VPBX settings page
MANGO_VPBX_API_SALT=        # from Mango Office VPBX settings page
MANGO_BASE_URL=https://app.mango-office.ru   # optional, this is the default
```

These can be empty strings for local dev without Mango.
The server must not crash if they are empty — MangoClient will simply fail
requests at runtime when called.

---

## Step 1 — Extend records/model.ts

**File**: `backend/src/plugins/records/model.ts`
**Action**: OVERWRITE entire file

Key changes:
- Add `boolean` import from drizzle
- Make `fileUri` nullable (remove `.notNull()`)
- Make `userId` nullable (remove `.notNull()`)
- Add 17 new columns for Mango metadata, call data, and ingestion lifecycle
- All new columns are nullable or have defaults — existing rows are not affected

```typescript
import {
    boolean,
    integer,
    pgTable,
    text,
    timestamp,
    jsonb,
} from "drizzle-orm/pg-core";
import { userTable } from "../user/model";

export const recordTable = pgTable("records", {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),

    // --- OWNERSHIP ---
    // nullable: Mango records are not owned by a platform user
    userId: integer("user_id").references(() => userTable.id, {
        onDelete: "cascade",
    }),

    // --- SOURCE ---
    // "manual" = uploaded by a user via POST /records/upload
    // "mango"  = ingested from Mango Office VPBX webhook
    source: text("source").notNull().default("manual"),

    // --- INGESTION LIFECYCLE (Mango-specific, not relevant for manual uploads) ---
    // "ready"         — audio is available in storage (all manual uploads start here)
    // "pending_audio" — Mango call recorded, waiting for recording_id via record/added event
    // "downloading"   — actively downloading audio from Mango API
    // "no_audio"      — call exists but has no recording (missed call, etc.)
    // "failed"        — ingestion failed (download error, etc.)
    ingestionStatus: text("ingestion_status").notNull().default("ready"),
    ingestionError: text("ingestion_error"),

    // --- MANGO EXTERNAL IDENTIFIERS ---
    mangoEntryId: text("mango_entry_id"),           // entry_id — main Mango call identifier
    mangoCallId: text("mango_call_id"),              // call_id — specific call leg identifier
    mangoRecordingId: text("mango_recording_id"),    // recording_id — audio file identifier
    mangoCommunicationId: text("mango_communication_id"), // for Mango speech API (future)

    // --- CALL METADATA ---
    // "inbound" | "outbound" | "unknown"
    direction: text("direction"),
    callerNumber: text("caller_number"),   // phone number of caller
    calleeNumber: text("callee_number"),   // phone number of callee
    lineNumber: text("line_number"),       // Mango line/DID number
    extension: text("extension"),          // internal extension number

    // --- CALL TIMESTAMPS ---
    callStartedAt: timestamp("call_started_at"),    // when call was initiated
    callAnsweredAt: timestamp("call_answered_at"),  // when call was answered (null if missed)
    callEndedAt: timestamp("call_ended_at"),        // when call ended

    // --- CALL DURATION ---
    // separate from durationSec (which is audio/file duration from AI)
    talkDurationSec: integer("talk_duration_sec"),  // seconds of actual conversation

    // --- CALL FLAGS ---
    isMissed: boolean("is_missed").notNull().default(false),
    hasAudio: boolean("has_audio").notNull().default(true),

    // --- EXISTING COLUMNS (unchanged semantics) ---
    callTo: text("call_to"),
    title: text("title"),
    durationSec: integer("duration_sec"), // filled by AI from audio analysis
    // fileUri is now nullable — missed calls and pre-download Mango records have no file
    fileUri: text("file_uri"),
    transcription: text("transcription"),
    summary: text("summary"),
    // AI processing status
    // "uploaded" | "queued" | "processing" | "done" | "failed" | "not_applicable"
    // "not_applicable" is used for missed calls with no audio to process
    status: text("status").notNull().default("uploaded"),
    error: text("error"),
    startedAt: timestamp("started_at"),
    finishedAt: timestamp("finished_at"),
    checkboxes: jsonb("checkboxes"),
});

export const tagsTable = pgTable("tags", {
    id: integer("id").primaryKey(),
    recordId: integer("record_id")
        .notNull()
        .references(() => recordTable.id, { onDelete: "cascade" }),
    tag: text("tag").notNull(),
});
```

---

## Step 2 — Update records/schema.ts

**File**: `backend/src/plugins/records/schema.ts`
**Action**: OVERWRITE entire file

Key changes:
- Add `not_applicable` to `aiRecordStatusSchema` (for missed calls with no audio)
- Add `recordSourceSchema` and `ingestionStatusSchema` enums
- Add `createMangoRecordSchema` and `CreateMangoRecord` type
- Extend `getRecordSchema` with all new optional fields
- Keep ALL existing schemas and types — do not remove anything

```typescript
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { recordTable } from "./model";
import z from "zod";
import { t, Static } from "elysia";

// --- EXISTING SCHEMAS (unchanged) ---

// IMPORTANT: "not_applicable" is added for missed calls that have no audio to process
export const aiRecordStatusSchema = z.enum([
    "uploaded",
    "queued",
    "processing",
    "done",
    "failed",
    "not_applicable",
]);
export type AiRecordStatus = z.infer<typeof aiRecordStatusSchema>;

export const aiCheckboxItemSchema = z.object({
    label: z.string(),
    checked: z.boolean(),
});
export type AiCheckboxItem = z.infer<typeof aiCheckboxItemSchema>;

export const aiCheckboxGroupsSchema = z.object({
    tasks: z.array(aiCheckboxItemSchema),
    promises: z.array(aiCheckboxItemSchema),
    agreements: z.array(aiCheckboxItemSchema),
});
export type AiCheckboxGroups = z.infer<typeof aiCheckboxGroupsSchema>;

export const createRecordSchema = createInsertSchema(recordTable);
export type CreateRecord = z.infer<typeof createRecordSchema>;

// Extended with new optional fields — frontend safely ignores unknown fields
export const getRecordSchema = createSelectSchema(recordTable).extend({
    status: aiRecordStatusSchema,
    tags: z.array(z.string()),
    checkboxes: aiCheckboxGroupsSchema.nullable(),
    // New fields — all optional so existing frontend code is not affected
    source: z.enum(["manual", "mango"]).optional(),
    ingestionStatus: z
        .enum(["ready", "pending_audio", "downloading", "no_audio", "failed"])
        .optional(),
    mangoEntryId: z.string().nullable().optional(),
    mangoRecordingId: z.string().nullable().optional(),
    direction: z.string().nullable().optional(),
    callerNumber: z.string().nullable().optional(),
    calleeNumber: z.string().nullable().optional(),
    isMissed: z.boolean().optional(),
    hasAudio: z.boolean().optional(),
    callStartedAt: z.date().nullable().optional(),
    callAnsweredAt: z.date().nullable().optional(),
    callEndedAt: z.date().nullable().optional(),
    talkDurationSec: z.number().nullable().optional(),
});
export type GetRecord = z.infer<typeof getRecordSchema>;

export const recordSummaryResultSchema = z.object({
    title: z.string().nullable().optional(),
    summary: z.string(),
    tags: z.array(z.string()),
    checkboxes: aiCheckboxGroupsSchema,
});
export type RecordSummaryResult = z.infer<typeof recordSummaryResultSchema>;

export const recordProcessingResultSchema = z.object({
    transcription: z.string(),
    title: z.string().nullable().optional(),
    durationSec: z.number().int().nonnegative().nullable(),
    summary: z.string(),
    tags: z.array(z.string()),
    checkboxes: aiCheckboxGroupsSchema,
});
export type RecordProcessingResult = z.infer<
    typeof recordProcessingResultSchema
>;

export const uploadRecordSchema = t.Object({
    file: t.File({ filetype: "audio/*" }),
    title: t.Optional(t.String()),
    callTo: t.Optional(t.String()),
});
export type UploadRecord = Static<typeof uploadRecordSchema>;

export const recordStatusResponseSchema = t.Object({
    id: t.Number(),
    userId: t.Number(),
    fileUri: t.String(),
    status: t.Union([
        t.Literal("uploaded"),
        t.Literal("queued"),
        t.Literal("processing"),
        t.Literal("done"),
        t.Literal("failed"),
    ]),
    message: t.Optional(t.String()),
});
export type RecordStatusResponse = Static<typeof recordStatusResponseSchema>;

// --- NEW SCHEMAS ---

export const recordSourceSchema = z.enum(["manual", "mango"]);
export type RecordSource = z.infer<typeof recordSourceSchema>;

export const ingestionStatusSchema = z.enum([
    "ready",
    "pending_audio",
    "downloading",
    "no_audio",
    "failed",
]);
export type IngestionStatus = z.infer<typeof ingestionStatusSchema>;

// Used by MangoIngestionService to create a call record from Mango event data
export const createMangoRecordSchema = z.object({
    mangoEntryId: z.string(),
    mangoCallId: z.string().optional(),
    direction: z.enum(["inbound", "outbound", "unknown"]).optional(),
    callerNumber: z.string().optional(),
    calleeNumber: z.string().optional(),
    lineNumber: z.string().optional(),
    extension: z.string().optional(),
    callStartedAt: z.date().optional(),
    callAnsweredAt: z.date().optional(),
    callEndedAt: z.date().optional(),
    talkDurationSec: z.number().optional(),
    isMissed: z.boolean().default(false),
    callTo: z.string().optional(),
    title: z.string().optional(),
});
export type CreateMangoRecord = z.infer<typeof createMangoRecordSchema>;
```

---

## Step 3 — Update records/service.ts

**File**: `backend/src/plugins/records/service.ts`
**Action**: ADD new methods — do NOT remove or modify any existing methods

### 3.1 Update the import at the top of the file

Replace the existing import block with:

```typescript
import { eq } from "drizzle-orm";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import {
    type AiCheckboxGroups,
    type AiRecordStatus,
    type CreateRecord,
    type GetRecord,
    type IngestionStatus,
    type CreateMangoRecord,
} from "./schema";
import { recordTable, tagsTable } from "./model";
```

### 3.2 Add 5 new methods inside the RecordService class

Add these methods at the end of the class body, before the closing `}`.

All existing methods remain unchanged.

```typescript
    // Find a record by Mango entry_id
    async findByMangoEntryId(
        mangoEntryId: string,
    ): Promise<GetRecord | undefined> {
        const rows = await this.db
            .select({
                record: recordTable,
                tag: tagsTable.tag,
            })
            .from(recordTable)
            .leftJoin(tagsTable, eq(tagsTable.recordId, recordTable.id))
            .where(eq(recordTable.mangoEntryId, mangoEntryId));

        if (!rows.length) return undefined;
        return this.groupTags(rows)[0];
    }

    // Create a new record from Mango event metadata (no audio file yet)
    async createMangoRecord(payload: CreateMangoRecord): Promise<GetRecord> {
        const isMissed = payload.isMissed ?? false;

        const [newRecord] = await this.db
            .insert(recordTable)
            .values({
                source: "mango",
                // Missed calls will never have audio; recorded calls wait for record/added
                ingestionStatus: isMissed ? "no_audio" : "pending_audio",
                hasAudio: false,
                isMissed,
                // Missed calls have no audio to process — mark status as not_applicable
                // Recorded calls will transition to queued once audio is downloaded
                status: isMissed ? "not_applicable" : "uploaded",
                mangoEntryId: payload.mangoEntryId,
                mangoCallId: payload.mangoCallId ?? null,
                direction: payload.direction ?? "unknown",
                callerNumber: payload.callerNumber ?? null,
                calleeNumber: payload.calleeNumber ?? null,
                lineNumber: payload.lineNumber ?? null,
                extension: payload.extension ?? null,
                callStartedAt: payload.callStartedAt ?? null,
                callAnsweredAt: payload.callAnsweredAt ?? null,
                callEndedAt: payload.callEndedAt ?? null,
                talkDurationSec: payload.talkDurationSec ?? null,
                callTo: payload.callTo ?? payload.callerNumber ?? null,
                title: payload.title ?? null,
                fileUri: null,
                userId: null,
            })
            .returning();

        if (!newRecord) throw new Error("Failed to create Mango record");
        return this.mapRecord(newRecord, []);
    }

    // Update a Mango record after audio has been downloaded and saved to storage
    async setMangoAudio(
        recordId: number,
        fileUri: string,
        mangoRecordingId: string,
    ): Promise<GetRecord> {
        const [updated] = await this.db
            .update(recordTable)
            .set({
                fileUri,
                mangoRecordingId,
                hasAudio: true,
                ingestionStatus: "ready",
                // Transition to queued so the AI pipeline can pick it up
                status: "queued",
            })
            .where(eq(recordTable.id, recordId))
            .returning();

        if (!updated) throw new Error("Failed to update Mango audio info");

        const current = await this.getRecordById(recordId);
        if (!current)
            throw new Error("Record not found after Mango audio update");
        return current;
    }

    // Update ingestion lifecycle status (used during Mango download flow)
    async setIngestionStatus(
        recordId: number,
        ingestionStatus: IngestionStatus,
        ingestionError?: string,
    ): Promise<void> {
        await this.db
            .update(recordTable)
            .set({
                ingestionStatus,
                ingestionError: ingestionError ?? null,
            })
            .where(eq(recordTable.id, recordId));
    }

    // Find by mangoEntryId and update metadata, or create a new record if not found
    async upsertMangoRecord(
        payload: CreateMangoRecord,
    ): Promise<{ record: GetRecord; created: boolean }> {
        const existing = await this.findByMangoEntryId(payload.mangoEntryId);

        if (existing) {
            // Update call metadata — prefer incoming payload values over existing ones
            await this.db
                .update(recordTable)
                .set({
                    direction:
                        payload.direction ??
                        (existing.direction as
                            | "inbound"
                            | "outbound"
                            | "unknown"
                            | null
                            | undefined) ??
                        "unknown",
                    callerNumber:
                        payload.callerNumber ?? existing.callerNumber,
                    calleeNumber:
                        payload.calleeNumber ?? existing.calleeNumber,
                    lineNumber: payload.lineNumber ?? existing.lineNumber,
                    callStartedAt:
                        payload.callStartedAt ?? existing.callStartedAt,
                    callAnsweredAt:
                        payload.callAnsweredAt ?? existing.callAnsweredAt,
                    callEndedAt: payload.callEndedAt ?? existing.callEndedAt,
                    talkDurationSec:
                        payload.talkDurationSec ?? existing.talkDurationSec,
                    isMissed: payload.isMissed,
                    callTo: payload.callTo ?? existing.callTo,
                    // Update ingestionStatus if call is now known to be missed
                    ingestionStatus: payload.isMissed
                        ? "no_audio"
                        : existing.ingestionStatus ?? "pending_audio",
                    status: payload.isMissed
                        ? "not_applicable"
                        : existing.status ?? "uploaded",
                })
                .where(eq(recordTable.mangoEntryId, payload.mangoEntryId));

            const updated = await this.findByMangoEntryId(
                payload.mangoEntryId,
            );
            return { record: updated!, created: false };
        }

        const created = await this.createMangoRecord(payload);
        return { record: created, created: true };
    }
```

---

## Step 4 — Update records/index.ts

**File**: `backend/src/plugins/records/index.ts`
**Action**: TWO targeted changes only — do NOT rewrite the file

### Change 4.1 — Add null guard in processRecordInBackground

In the `processRecordInBackground` function, the background task currently calls
`storage.readIntoFile(fileUri)` where `fileUri` was previously guaranteed non-null.
Now it can be null.

Find this block inside the async task:

```typescript
// FIND this block:
try {
    await recordService.markProcessing(recordId);

    const file = await storage.readIntoFile(fileUri);
```

Replace it with:

```typescript
// REPLACE with:
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
```

Also update the function signature to accept `fileUri` as `string | null`:

```typescript
// FIND:
const processRecordInBackground = (
    recordService: RecordService,
    storage: IStorage,
    aiService: RecordAiService,
    recordId: number,
    fileUri: string,
    title?: string,
) => {

// REPLACE WITH:
const processRecordInBackground = (
    recordService: RecordService,
    storage: IStorage,
    aiService: RecordAiService,
    recordId: number,
    fileUri: string | null,
    title?: string,
) => {
```

### Change 4.2 — Add GET /by-mango-entry/:entryId route

Add this route inside the `recordsPlugin` Elysia chain, after the existing `GET /:id` route.
This route is inside the `guardPlugin` scope — any authenticated user can access any Mango record
by entry ID. This is correct for MVP demo.

```typescript
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
```

No other changes to this file.

**Note on ownership**: The existing `GET /records/:id` check `record.userId !== userId`
correctly returns 403 for Mango records (userId=null), because null !== number.
This is intended behavior — Mango records are not accessible via the user-scoped endpoint.
Do NOT change this logic.

---

## Step 5 — Create backend/src/plugins/mango/ directory with 4 files

Create the directory: `backend/src/plugins/mango/`

---

### File 5.1 — backend/src/plugins/mango/client.ts

**Action**: CREATE

This class handles all HTTP communication with Mango VPBX API and webhook signature verification.

Mango VPBX outgoing request format:
- POST with `application/x-www-form-urlencoded`
- Fields: `vpbx_api_key`, `sign`, `json`
- `sign = SHA256(vpbx_api_key + json_body + vpbx_api_salt)` as lowercase hex

Mango incoming webhook format (from Mango to our server):
- POST with `application/x-www-form-urlencoded`
- Fields: `vpbx_api_key`, `sign`, `json`
- `sign = SHA256(vpbx_api_key + json + vpbx_api_salt)` as lowercase hex

```typescript
import { createHash } from "node:crypto";

export type MangoClientConfig = {
    apiKey: string;
    apiSalt: string;
    baseUrl?: string;
};

export class MangoClient {
    private readonly apiKey: string;
    private readonly apiSalt: string;
    private readonly baseUrl: string;

    constructor(config: MangoClientConfig) {
        this.apiKey = config.apiKey;
        this.apiSalt = config.apiSalt;
        this.baseUrl =
            config.baseUrl?.replace(/\/$/, "") ??
            "https://app.mango-office.ru";
    }

    // Compute signature for outgoing request to Mango API
    private sign(jsonBody: string): string {
        return createHash("sha256")
            .update(this.apiKey + jsonBody + this.apiSalt)
            .digest("hex");
    }

    // Verify signature of an incoming webhook from Mango Office
    // Returns false if apiKey does not match or signature is wrong
    verifyWebhookSignature(
        receivedApiKey: string,
        receivedSign: string,
        jsonBody: string,
    ): boolean {
        if (receivedApiKey !== this.apiKey) return false;
        const expected = createHash("sha256")
            .update(this.apiKey + jsonBody + this.apiSalt)
            .digest("hex");
        return expected === receivedSign;
    }

    // Make an authenticated POST request to Mango VPBX API
    async post<T>(
        endpoint: string,
        params: Record<string, unknown>,
    ): Promise<T> {
        const jsonBody = JSON.stringify(params);
        const sign = this.sign(jsonBody);

        const form = new URLSearchParams();
        form.set("vpbx_api_key", this.apiKey);
        form.set("sign", sign);
        form.set("json", jsonBody);

        const response = await fetch(`${this.baseUrl}${endpoint}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: form.toString(),
        });

        if (!response.ok) {
            throw new Error(
                `Mango API error ${response.status} ${response.statusText} at ${endpoint}`,
            );
        }

        return response.json() as Promise<T>;
    }

    // Download a call recording by recording_id
    // Uses POST /vpbx/queries/recording/post with action="download"
    // Returns raw audio as a Buffer
    async downloadRecording(recordingId: string): Promise<Buffer> {
        const params = { recording_id: recordingId, action: "download" };
        const jsonBody = JSON.stringify(params);
        const sign = this.sign(jsonBody);

        const form = new URLSearchParams();
        form.set("vpbx_api_key", this.apiKey);
        form.set("sign", sign);
        form.set("json", jsonBody);

        const response = await fetch(
            `${this.baseUrl}/vpbx/queries/recording/post`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body: form.toString(),
            },
        );

        if (!response.ok) {
            throw new Error(
                `Failed to download recording ${recordingId}: ${response.status} ${response.statusText}`,
            );
        }

        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
    }
}
```

---

### File 5.2 — backend/src/plugins/mango/schema.ts

**Action**: CREATE

Zod schemas for validating incoming Mango webhook payloads.

```typescript
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
    create_time: z.number().int(),   // UNIX timestamp: call created
    forward_time: z.number().int(),  // UNIX timestamp: call forwarded
    // If talk_time === create_time, the call was never answered (missed)
    talk_time: z.number().int(),     // UNIX timestamp: call answered
    end_time: z.number().int(),      // UNIX timestamp: call ended
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
```

---

### File 5.3 — backend/src/plugins/mango/service.ts

**Action**: CREATE

Business logic for processing Mango events.
Calls RecordService and MangoClient, triggers the same AI pipeline as manual upload.

```typescript
import RecordService from "../records/service";
import RecordAiService from "../records/ai-service";
import { IStorage } from "../../storage/interface";
import { MangoClient } from "./client";
import type {
    MangoSummaryPayload,
    MangoRecordAddedPayload,
} from "./schema";

const mangoLog = (...args: unknown[]) => console.log("[mango]", ...args);

const normalizeError = (e: unknown): string =>
    e instanceof Error ? e.message : "Unknown error";

export class MangoIngestionService {
    constructor(
        private readonly recordService: RecordService,
        private readonly storage: IStorage,
        private readonly aiService: RecordAiService,
        private readonly mangoClient: MangoClient,
    ) {}

    // Handle /events/summary from Mango
    // Creates or updates the call record with metadata from the summary event
    // This event is the primary source for call metadata (direction, numbers, timestamps)
    async handleSummaryEvent(event: MangoSummaryPayload): Promise<void> {
        mangoLog("summary event received", { entry_id: event.entry_id });

        const direction =
            event.call_direction === 1 ? "inbound" : "outbound";

        // talkDurationSec === 0 means call was never answered → missed
        const talkDurationSec = event.end_time - event.talk_time;
        const isMissed = talkDurationSec === 0;

        const callerNumber =
            event.from.number ?? event.from.extension ?? null;
        const calleeNumber = event.to.number ?? event.to.extension ?? null;

        // For inbound calls the customer is the caller, for outbound the customer is callee
        const callTo =
            direction === "inbound"
                ? (callerNumber ?? undefined)
                : (calleeNumber ?? undefined);

        await this.recordService.upsertMangoRecord({
            mangoEntryId: event.entry_id,
            direction,
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
                    isMissed: false,
                });
            record = created;
        }

        // Mark ingestion as in-progress
        await this.recordService.setIngestionStatus(record.id, "downloading");

        try {
            // Download audio buffer from Mango
            mangoLog("downloading audio", {
                recording_id: event.recording_id,
            });

            const audioBuffer = await this.mangoClient.downloadRecording(
                event.recording_id,
            );

            // Wrap Buffer in a File object — compatible with IStorage.upload()
            const fileName = `mango-${event.entry_id}-${event.recording_id}.mp3`;
            const audioFile = new File([audioBuffer], fileName, {
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
```

---

### File 5.4 — backend/src/plugins/mango/webhook.ts

**Action**: CREATE

Elysia plugin exposing Mango webhook endpoints.
Responds with HTTP 200 immediately and processes events asynchronously.
Mango requires a fast HTTP response — never await the handler result before responding.

```typescript
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
```

---

## Step 6 — Update backend/src/index.ts

**File**: `backend/src/index.ts`
**Action**: OVERWRITE entire file

Adds MangoClient, MangoIngestionService, and mangoWebhookPlugin.
MangoClient is instantiated with empty strings if env vars are absent —
server must not crash when Mango is not configured.

```typescript
import { Elysia } from "elysia";
import { userPlugin } from "./plugins/user";
import { getDbConnection } from "./database/service";
import { errorHandler } from "./plugins/errors";
import UserService from "./plugins/user/service";
import authPlugin from "./plugins/auth";
import { recordsPlugin } from "./plugins/records";
import RecordService from "./plugins/records/service";
import LocalStorage from "./storage/local";
import { cors } from "@elysiajs/cors";
import AIService from "./plugins/records/ai-service";
import { MangoClient } from "./plugins/mango/client";
import { MangoIngestionService } from "./plugins/mango/service";
import { mangoWebhookPlugin } from "./plugins/mango/webhook";

async function bootstrapServer() {
    const db = getDbConnection(Bun.env.DATABASE_URL!);
    const userService = new UserService(db);
    const recordsService = new RecordService(db);
    const localStorage = new LocalStorage("./uploads/");
    const aiService = new AIService();

    const mangoClient = new MangoClient({
        apiKey: Bun.env.MANGO_VPBX_API_KEY ?? "",
        apiSalt: Bun.env.MANGO_VPBX_API_SALT ?? "",
        baseUrl: Bun.env.MANGO_BASE_URL,
    });

    const mangoIngestionService = new MangoIngestionService(
        recordsService,
        localStorage,
        aiService,
        mangoClient,
    );

    const app = new Elysia()
        .use(cors())
        .use(errorHandler)
        .get("/health", () => {
            return { status: "ok" };
        })
        .use(authPlugin(userService))
        .use(userPlugin(userService))
        .use(recordsPlugin(recordsService, localStorage, aiService))
        .use(mangoWebhookPlugin(mangoClient, mangoIngestionService))
        .listen(3000);

    console.log(
        `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
    );
}

bootstrapServer();
```

---

## Step 7 — Run database migration

**IMPORTANT**: Without this step the backend will crash on startup because the DB schema
will not match the Drizzle model.

The `drizzle/` directory is currently empty — migrations have never been generated.
The `drizzle.config.ts` is already correctly configured and will pick up the updated model.

### For local development (quickest):
```bash
cd backend
bun drizzle-kit push
```
`push` introspects the schema and applies all changes directly to the DB without generating
migration files. This is the recommended approach for dev/demo environments.

### For production / if you want migration files:
```bash
cd backend
bun drizzle-kit generate
bun drizzle-kit migrate
```

### What changes in the database:

Columns made nullable (were NOT NULL):
- `records.file_uri` — was `TEXT NOT NULL`, becomes `TEXT` (nullable)
- `records.user_id` — was `INTEGER NOT NULL REFERENCES users(id)`, becomes nullable FK

New columns added (all safe for existing rows):
```sql
source                  TEXT NOT NULL DEFAULT 'manual'
ingestion_status        TEXT NOT NULL DEFAULT 'ready'
ingestion_error         TEXT
mango_entry_id          TEXT
mango_call_id           TEXT
mango_recording_id      TEXT
mango_communication_id  TEXT
direction               TEXT
caller_number           TEXT
callee_number           TEXT
line_number             TEXT
extension               TEXT
call_started_at         TIMESTAMP
call_answered_at        TIMESTAMP
call_ended_at           TIMESTAMP
talk_duration_sec       INTEGER
is_missed               BOOLEAN NOT NULL DEFAULT false
has_audio               BOOLEAN NOT NULL DEFAULT true
```

All existing rows will get:
- `source = 'manual'`
- `ingestion_status = 'ready'`
- `is_missed = false`
- `has_audio = true`
- All new nullable columns = NULL

No existing data is lost or corrupted.

---

## Step 8 — Update environment config files

### 8.1 Add to jwtusers/.env:
```
MANGO_VPBX_API_KEY=your_mango_vpbx_api_key
MANGO_VPBX_API_SALT=your_mango_vpbx_api_salt
MANGO_BASE_URL=https://app.mango-office.ru
```

### 8.2 Add to backend/.env.example:
```
MANGO_VPBX_API_KEY=
MANGO_VPBX_API_SALT=
MANGO_BASE_URL=https://app.mango-office.ru
```

### 8.3 Update jwtusers/docker-compose.yaml backend environment section:

Find the `backend.environment` block and add three new lines:

```yaml
      - MANGO_VPBX_API_KEY=${MANGO_VPBX_API_KEY}
      - MANGO_VPBX_API_SALT=${MANGO_VPBX_API_SALT}
      - MANGO_BASE_URL=${MANGO_BASE_URL:-https://app.mango-office.ru}
```

---

## Step 9 — Configure Mango Office VPBX (outside backend code)

In the Mango Office VPBX admin panel, set the callback URLs:

| Event | URL |
|-------|-----|
| Summary (call ended) | `https://your-domain/integrations/mango/events/summary` |
| Recording added | `https://your-domain/integrations/mango/events/record/added` |

For local testing, use ngrok or a similar tunnel:
```bash
ngrok http 3000
# then set URLs like: https://abc123.ngrok.io/integrations/mango/events/summary
```

The callback format Mango uses is `application/x-www-form-urlencoded` with:
- `vpbx_api_key` — your API key
- `sign` — SHA256(vpbx_api_key + json + vpbx_api_salt) hex string
- `json` — the event payload as a JSON string

---

## Test scenarios

### Scenario A — Manual upload still works (must not be broken)

1. `POST /login` with valid credentials → 200, sets `auth` cookie
2. `POST /records/upload` with audio file → 202, `{ id, userId, fileUri, status: "queued" }`
3. Poll `GET /records/:id` until `status === "done"`
4. Verify `transcription`, `summary`, `tags`, `checkboxes` are populated
5. `GET /records` returns list with this record
6. Verify existing record shape: all previous fields present with correct types

### Scenario B — Mango recorded call ingestion

1. POST `application/x-www-form-urlencoded` to `POST /integrations/mango/events/summary`
   with fields `vpbx_api_key`, `sign` (computed correctly), `json` (MangoSummaryPayload)
   where `talk_time !== create_time` (call was answered)
   → Expected: 200 `{ ok: true }`
   → DB: record created with `source=mango`, `isMissed=false`, `ingestionStatus=pending_audio`

2. POST to `POST /integrations/mango/events/record/added`
   with same `entry_id` and a valid `recording_id`
   → Expected: 200 `{ ok: true }`
   → Background: audio downloaded from Mango, saved under `uploads/mango/<entry_id>/`
   → Background: `ingestionStatus` transitions: `downloading` → `ready`
   → Background: `status` transitions: `queued` → `processing` → `done`

3. `GET /records/by-mango-entry/:entryId` with auth cookie
   → Returns record with `status: "done"`, `hasAudio: true`
   → `transcription` and `summary` populated by AI

### Scenario C — Mango missed call

1. POST to `POST /integrations/mango/events/summary`
   where `talk_time === create_time` (talkDurationSec = 0 → missed)
   → Expected: 200 `{ ok: true }`
   → DB: record created with `isMissed=true`, `hasAudio=false`,
     `ingestionStatus=no_audio`, `status=not_applicable`

2. No `record/added` event will arrive (missed calls have no recording)

3. `GET /records/by-mango-entry/:entryId` with auth cookie
   → Returns record with `isMissed: true`, `hasAudio: false`, `status: "not_applicable"`
   → Frontend can display this as a missed call on dashboard

### Scenario D — Invalid webhook signature

1. POST to any Mango webhook with a wrong or missing `sign`
   → Expected: 403 `{ message: "Invalid signature" }`
   → No record created or modified

### Scenario E — Webhook arrives out of order (record/added before summary)

1. POST `record/added` with an `entry_id` that has no existing record
   → Expected: 200 `{ ok: true }`
   → A minimal record is auto-created via `upsertMangoRecord`
   → Audio is downloaded and AI is triggered normally

2. POST `summary` for the same `entry_id` later
   → Expected: 200 `{ ok: true }`
   → Existing record is updated with metadata from summary

---

## File change summary

| File | Action | Summary of changes |
|------|--------|--------------------|
| `backend/src/plugins/records/model.ts` | OVERWRITE | Add `boolean` import; make `fileUri` and `userId` nullable; add 17 new columns |
| `backend/src/plugins/records/schema.ts` | OVERWRITE | Add `not_applicable` status; add `recordSourceSchema`, `ingestionStatusSchema`, `createMangoRecordSchema`; extend `getRecordSchema` with new optional fields |
| `backend/src/plugins/records/service.ts` | MODIFY (add only) | Update imports; add 5 new methods: `findByMangoEntryId`, `createMangoRecord`, `setMangoAudio`, `setIngestionStatus`, `upsertMangoRecord` |
| `backend/src/plugins/records/index.ts` | MODIFY (2 changes) | Add null guard in `processRecordInBackground`; add `GET /by-mango-entry/:entryId` route |
| `backend/src/index.ts` | OVERWRITE | Add MangoClient, MangoIngestionService imports and instantiation; register `mangoWebhookPlugin` |
| `backend/src/plugins/mango/client.ts` | CREATE | `MangoClient` class: `sign`, `post`, `downloadRecording`, `verifyWebhookSignature` |
| `backend/src/plugins/mango/schema.ts` | CREATE | Zod schemas: `MangoSummaryPayload`, `MangoRecordAddedPayload`, `MangoCallPayload`, `MangoWebhookRequest` |
| `backend/src/plugins/mango/service.ts` | CREATE | `MangoIngestionService`: `handleSummaryEvent`, `handleRecordAddedEvent`, `runAiPipelineInBackground` |
| `backend/src/plugins/mango/webhook.ts` | CREATE | Elysia plugin: `POST /integrations/mango/events/summary`, `POST /integrations/mango/events/record/added` |
| `docker-compose.yaml` | MODIFY | Add 3 Mango env vars to backend service |
| `.env` | MODIFY | Add `MANGO_VPBX_API_KEY`, `MANGO_VPBX_API_SALT`, `MANGO_BASE_URL` |
| `backend/.env.example` | MODIFY | Add empty Mango env var placeholders |

---

## Critical rules for the implementing agent

1. **Do NOT modify `RecordAiService`** (`ai-service.ts`) — it is reused as-is by both manual
   and Mango flows. No changes whatsoever.

2. **Do NOT modify `IStorage` or `LocalStorage`** — Mango ingestion uses the same
   `storage.upload()` and `storage.readIntoFile()` as manual upload.

3. **Do NOT modify `guardPlugin`** — auth flow is unchanged.

4. **Do NOT rename or remove existing `recordTable` columns** — only add new columns.

5. **Do NOT change `POST /records/upload` behavior** — it must return exactly the same
   response shape as before.

6. **Do NOT change the ownership check in `GET /records/:id`** — Mango records have
   `userId=null`, so `record.userId !== userId` correctly returns 403. This is intended.
   Mango records are accessed only via `GET /records/by-mango-entry/:entryId`.

7. **Webhook endpoints MUST respond HTTP 200 immediately** — processing is async.
   Never `await` the ingestion handler before sending the response.

8. **Always run `bun drizzle-kit push` (or generate+migrate) after model changes** —
   without this, the backend will fail at runtime with column-not-found errors.

9. **MangoClient tolerates empty env vars at construction time** — it should only throw
   at request time, not at server startup.

10. **Implement steps in order**: model → schema → service → records/index → mango/* → index.ts
    → migration → env config. Each step depends on types and imports from the previous one.