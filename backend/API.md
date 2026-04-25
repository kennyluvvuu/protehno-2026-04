# Backend API Contract

Краткий контракт backend API для фронтенда и AI-агентов.

## Rules for AI agents

- Use this file as integration source of truth.
- Do not modify backend behavior from frontend side.
- Auth mode is cookie-based (`httpOnly` cookie `auth`).
- Upload is async: final AI data comes from `GET /records/:id`, `GET /records/feed`, or `GET /records/by-mango-entry/:entryId`.

## Base URL

- local: `http://localhost:3000`

## Auth

### `POST /login`

Request:
```json
{
  "email": "alice@example.com",
  "password": "qwerty123"
}
```

Success `200`:
```json
{
  "id": 1,
  "name": "Alice",
  "email": "alice@example.com"
}
```

Side effect:
- sets `httpOnly` cookie `auth`

### `POST /logout`

Success `200`:
```json
{
  "message": "Logged out"
}
```

Side effect:
- clears cookie `auth`

## Health

### `GET /health`

Success `200`:
```json
{
  "status": "ok"
}
```

## Users

### `POST /users/register`

Request:
```json
{
  "name": "Alice",
  "email": "alice@example.com",
  "password": "qwerty123",
  "mangoUserId": 12345
}
```
`mangoUserId` is optional.

Success `200`:
```json
{
  "id": 1,
  "name": "Alice",
  "email": "alice@example.com",
  "mangoUserId": 12345
}
```

### `GET /users/me`

Auth required.

Success `200`:
```json
{
  "id": 1,
  "name": "Alice",
  "email": "alice@example.com",
  "mangoUserId": 12345
}
```

### `PATCH /users/me/mango-user-id`

Auth required.

Request:
```json
{
  "mangoUserId": 12345
}
```

Set `"mangoUserId": null` to clear mapping.

Success `200`:
```json
{
  "id": 1,
  "name": "Alice",
  "email": "alice@example.com",
  "mangoUserId": 12345
}
```

### `GET /users`

Auth required.

Success `200`:
```json
[
  {
    "id": 1,
    "name": "Alice",
    "email": "alice@example.com",
    "mangoUserId": 12345
  }
]
```

### `GET /users/:id`

Auth required.

Success `200`:
```json
{
  "id": 1,
  "name": "Alice",
  "email": "alice@example.com",
  "mangoUserId": 12345
}
```

### `GET /users/mango/:mangoUserId`

Auth required.

Returns platform user mapped to Mango user id.

Errors:
- `404` not found

## Records

## Record entity

`records` contains both manual and Mango calls.

Core fields:
- `id: number`
- `userId: number | null`
- `source: "manual" | "mango"`
- `callTo: string | null`
- `title: string | null`
- `durationSec: number | null`
- `fileUri: string | null`
- `transcription: string | null`
- `summary: string | null`
- `status: "uploaded" | "queued" | "processing" | "done" | "failed" | "not_applicable"`
- `error: string | null`
- `startedAt: string | null`
- `finishedAt: string | null`
- `checkboxes: { tasks, promises, agreements } | null`
- `tags: string[]`

Mango fields:
- `ingestionStatus: "ready" | "pending_audio" | "downloading" | "no_audio" | "failed"`
- `ingestionError: string | null`
- `mangoEntryId`, `mangoCallId`, `mangoRecordingId`, `mangoCommunicationId`
- `mangoUserId: number | null`
- `direction`, `callerNumber`, `calleeNumber`, `lineNumber`, `extension`
- `callStartedAt`, `callAnsweredAt`, `callEndedAt`
- `talkDurationSec`, `isMissed`, `hasAudio`

## Processing model

### Manual upload

1. `POST /records/upload`
2. Receive `202` with queued status
3. Poll `GET /records/:id`
4. Stop on `done` or `failed`

### Mango ingestion

1. Mango sends `summary` webhook -> create/update record metadata.
2. Mango sends `record/added` webhook -> download audio -> set queued -> run AI.
3. Missed calls have no audio -> `status = "not_applicable"`, `ingestionStatus = "no_audio"`.

## Status semantics

AI `status`:
- `uploaded`
- `queued`
- `processing`
- `done`
- `failed`
- `not_applicable`

Ingestion `ingestionStatus`:
- `ready`
- `pending_audio`
- `downloading`
- `no_audio`
- `failed`

## Endpoints

### `POST /records/upload`

Auth required.

Request:
- `multipart/form-data`
- `file: audio/*` (required)
- `title: string` (optional)
- `callTo: string` (optional)

Success `202`:
```json
{
  "id": 12,
  "userId": 1,
  "fileUri": "/absolute/path/to/uploads/1/1725000000000-call.mp3",
  "status": "queued",
  "message": "Record uploaded and queued for async processing"
}
```

### `GET /records`

Auth required.

Returns records for current user only (`userId = auth user`).
Mango records with `userId = null` are not returned here.

Success `200`: `GetRecord[]`

### `GET /records/feed`

Auth required.

Returns a unified feed for a single frontend page:
- current user records (`userId = auth user`) including linked Mango records
- Mango records not linked to any user yet (`source = "mango"` and `userId = null`)

Success `200`: `GetRecord[]`

### `GET /records/:id`

Auth required.

Returns single user-owned record.

Errors:
- `400` invalid id
- `404` not found
- `403` forbidden (record belongs to another user or is unowned Mango record)

### `GET /records/by-mango-entry/:entryId`

Auth required.

Returns record by Mango `entry_id`.
Use this endpoint for Mango records.

Errors:
- `404` not found

## Mango webhooks

## `POST /integrations/mango/events/summary`

Content type from Mango: `application/x-www-form-urlencoded`
Body fields:
- `vpbx_api_key: string`
- `sign: string`
- `json: string`

Behavior:
- validates signature
- parses/validates payload
- returns quickly (`200 { "ok": true }`)
- processes event async

Error responses:
- `403` invalid signature
- `400` malformed/invalid payload

## `POST /integrations/mango/events/record/added`

Format and behavior are the same:
- signature validation
- payload validation
- immediate `200 { "ok": true }`
- async download + ingestion + AI trigger

## Frontend integration rules

- Always send cookies for protected endpoints.
- Treat upload acknowledgment and AI result as different states.
- Poll every 2-5 seconds after upload.
- Stop polling at `done` or `failed`.
- Handle `not_applicable` for missed calls with no audio.
- Use `/records/feed` as primary endpoint for a single records page.
- Use `PATCH /users/me/mango-user-id` to link Mango user and backfill ownership for existing unowned Mango records.
- Use `/records/by-mango-entry/:entryId` for Mango call cards/details.

## Environment variables

Common:
- `DATABASE_URL`
- `JWT_SECRET`
- `GROQ_API_KEY`
- `GROQ_BASE_URL`
- `GROQ_TRANSCRIPTION_MODEL`
- `MISTRAL_API_KEY`
- `MISTRAL_SUMMARY_MODEL`

Mango:
- `MANGO_VPBX_API_KEY`
- `MANGO_VPBX_API_SALT`
- `MANGO_BASE_URL` (default `https://app.mango-office.ru`)
