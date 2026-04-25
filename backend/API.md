# Backend API Contract

Актуальный контракт backend API для фронтенда и AI-агентов.

## Rules for AI agents

- Use this file as integration source of truth.
- Do not assume behavior that is not explicitly documented here.
- Auth mode is cookie-based (`httpOnly` cookie `auth`).
- Upload and Mango AI processing are async: final AI data comes from record-reading endpoints, not from upload/webhook responses.
- `director` and `manager` are single string roles, not arrays.

## Base URL

- local: `http://localhost:3000`

---

## Auth

### `POST /login`

Request:

```/dev/null/login-request.json#L1-4
{
  "email": "director@example.com",
  "password": "director123"
}
```

Success `200`:

```/dev/null/login-response.json#L1-7
{
  "id": 1,
  "name": "director",
  "fio": "Директор Демо",
  "role": "director",
  "email": "director@example.com",
  "mangoUserId": null
}
```

Side effect:
- sets `httpOnly` cookie `auth`

Notes:
- JWT payload contains at least `id` and `role`
- protected routes still load the current user from DB on each request

### `POST /logout`

Success `200`:

```/dev/null/logout-response.json#L1-3
{
  "message": "Logged out"
}
```

Side effect:
- clears cookie `auth`

---

## Health

### `GET /health`

Success `200`:

```/dev/null/health-response.json#L1-3
{
  "status": "ok"
}
```

---

## User entity

Current response shape:

```/dev/null/user-type.ts#L1-8
type User = {
  id: number;
  name: string;
  fio: string | null;
  role: "director" | "manager";
  email: string;
  mangoUserId: number | null;
};
```

### Seeded director

On first application start, if table `users` is empty, backend creates one seeded `director` user.

Default seed:

```/dev/null/director-seed.json#L1-6
{
  "email": "director@example.com",
  "password": "director123",
  "name": "director",
  "role": "director"
}
```

---

## Users

### `POST /users/register`

Public endpoint.

Request body is validated against the backend create-user schema, but the route forcibly creates only `manager` users.

Request example:

```/dev/null/register-request.json#L1-7
{
  "name": "Alice",
  "email": "alice@example.com",
  "password": "qwerty123",
  "fio": "Иванов Иван Иванович",
  "role": "manager",
  "mangoUserId": 12345
}
```

Notes:
- `name`, `email`, `password` are required
- `fio` is optional and may be `null`
- `mangoUserId` is optional
- even if client sends another role, public registration route overwrites it with `"manager"`
- `director` must not be created through public registration

Success `200`:

```/dev/null/register-response.json#L1-8
{
  "id": 1,
  "name": "Alice",
  "fio": "Иванов Иван Иванович",
  "role": "manager",
  "email": "alice@example.com",
  "mangoUserId": 12345
}
```

Possible errors:
- `422` validation error
- `500` duplicate email or other internal error surface

### `GET /users/me`

Auth required.

Returns current authenticated user.

Success `200`:

```/dev/null/users-me-response.json#L1-8
{
  "id": 1,
  "name": "Alice",
  "fio": "Иванов Иван Иванович",
  "role": "manager",
  "email": "alice@example.com",
  "mangoUserId": 12345
}
```

### `GET /users`

Auth required. Director only.

Returns all users.

Success `200`:

```/dev/null/users-list-response.json#L1-10
[
  {
    "id": 1,
    "name": "Alice",
    "fio": "Иванов Иван Иванович",
    "role": "manager",
    "email": "alice@example.com",
    "mangoUserId": 12345
  }
]
```

Errors:
- `401` unauthorized
- `403` forbidden for non-director

### `GET /users/:id`

Auth required. Director only.

Request params:
- `id: number`

Success `200`:

```/dev/null/user-by-id-response.json#L1-8
{
  "id": 1,
  "name": "Alice",
  "fio": "Иванов Иван Иванович",
  "role": "manager",
  "email": "alice@example.com",
  "mangoUserId": 12345
}
```

Errors:
- `401` unauthorized
- `403` forbidden for non-director
- `404` user not found

### `PATCH /users/:id`

Auth required. Director only.

Allows director to update another user.

Request params:
- `id: number`

Request body:

```/dev/null/user-update-request.json#L1-7
{
  "name": "Alice Updated",
  "fio": "Иванов Иван Иванович",
  "email": "alice.updated@example.com",
  "mangoUserId": 12345,
  "role": "manager"
}
```

All fields are optional:
- `name?: string`
- `fio?: string | null`
- `email?: string`
- `mangoUserId?: number | null`
- `role?: "director" | "manager"`

Success `200`:

```/dev/null/user-update-response.json#L1-8
{
  "id": 1,
  "name": "Alice Updated",
  "fio": "Иванов Иван Иванович",
  "role": "manager",
  "email": "alice.updated@example.com",
  "mangoUserId": 12345
}
```

Behavior notes:
- route checks target user existence before update
- backend prevents removing the last `director` role from the system

Errors:
- `401` unauthorized
- `403` forbidden for non-director
- `404` user not found
- `400` when trying to demote the last director
- `500` duplicate email or duplicate `mangoUserId` may surface as internal error text

### `DELETE /users/:id`

Auth required. Director only.

Deletes a user.

Request params:
- `id: number`

Success `200`:

```/dev/null/user-delete-response.json#L1-3
{
  "message": "User deleted"
}
```

Behavior notes:
- director cannot delete themselves
- backend prevents deleting the last director
- user-owned records are preserved because `records.user_id` uses `ON DELETE SET NULL`

Errors:
- `401` unauthorized
- `403` forbidden for non-director
- `404` user not found
- `400` if director tries to delete themselves
- `400` if trying to delete the last director

### `PATCH /users/me/mango-user-id`

Auth required.

Sets or clears Mango user mapping for current user.

Request:

```/dev/null/user-set-mango-request.json#L1-3
{
  "mangoUserId": 12345
}
```

To clear mapping:

```/dev/null/user-clear-mango-request.json#L1-3
{
  "mangoUserId": null
}
```

Success `200`:

```/dev/null/user-set-mango-response.json#L1-8
{
  "id": 1,
  "name": "Alice",
  "fio": "Иванов Иван Иванович",
  "role": "manager",
  "email": "alice@example.com",
  "mangoUserId": 12345
}
```

Behavior notes:
- if `mangoUserId` is set to a number, backend also runs backfill:
  - links existing unowned Mango records with same `mangoUserId` to current user

### `GET /users/mango/:mangoUserId`

Auth required.

Returns platform user mapped to Mango user id.

Request params:
- `mangoUserId: number`

Success `200`:

```/dev/null/user-by-mango-response.json#L1-8
{
  "id": 1,
  "name": "Alice",
  "fio": "Иванов Иван Иванович",
  "role": "manager",
  "email": "alice@example.com",
  "mangoUserId": 12345
}
```

Errors:
- `401` unauthorized
- `404` not found

---

## Record entity

`records` contains both manual and Mango-originated calls.

Current response shape:

```/dev/null/get-record-type.ts#L1-28
type CheckboxItem = {
  label: string;
  checked: boolean;
};

type CheckboxGroups = {
  tasks: CheckboxItem[];
  promises: CheckboxItem[];
  agreements: CheckboxItem[];
};

type GetRecord = {
  id: number;
  userId: number | null;
  source?: "manual" | "mango";
  ingestionStatus?: "ready" | "pending_audio" | "downloading" | "no_audio" | "failed";
  mangoEntryId?: string | null;
  mangoRecordingId?: string | null;
  mangoUserId?: number | null;
  direction?: string | null;
  callerNumber?: string | null;
  calleeNumber?: string | null;
  isMissed?: boolean;
  hasAudio?: boolean;
  callStartedAt?: string | null;
  callAnsweredAt?: string | null;
  callEndedAt?: string | null;
  talkDurationSec?: number | null;
  callTo: string | null;
  title: string | null;
  durationSec: number | null;
  qualityScore?: number | null;
  fileUri: string | null;
  transcription: string | null;
  summary: string | null;
  status: "uploaded" | "queued" | "processing" | "done" | "failed" | "not_applicable";
  error: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  checkboxes: CheckboxGroups | null;
  tags: string[];
};
```

Notes:
- `qualityScore` is AI-derived and may be `null`
- checkbox items are objects with `label` and `checked`
- several Mango-related fields are optional in response shape

## Processing model

### Manual upload

1. `POST /records/upload`
2. Backend immediately returns `202` with queued status
3. Background AI pipeline runs:
   - transcription
   - summary
   - tags
   - checkboxes
   - `qualityScore`
4. Frontend polls `GET /records/:id` or reads feed/list endpoints later

### Mango ingestion

1. Mango sends `summary` webhook -> create/update record metadata
2. Mango sends `record/added` webhook -> download audio -> mark queued -> run same AI pipeline
3. Missed calls have no audio:
   - `hasAudio = false`
   - `ingestionStatus = "no_audio"`
   - `status = "not_applicable"`

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

---

## Records

### `POST /records/upload`

Auth required.

Request:
- `multipart/form-data`
- `file: audio/*` required
- `title: string` optional
- `callTo: string` optional

Success `202`:

```/dev/null/record-upload-response.json#L1-7
{
  "id": 12,
  "userId": 1,
  "fileUri": "/absolute/path/to/uploads/1/1725000000000-call.mp3",
  "status": "queued",
  "message": "Record uploaded and queued for async processing"
}
```

Notes:
- this is not the final AI result
- final values appear later in record reads

### `GET /records`

Auth required.

Returns records for current user only.

Notes:
- records with `userId = null` are not returned here
- linked Mango records owned by current user are returned here

Success `200`:
- `GetRecord[]`

### `GET /records/feed`

Auth required.

Returns unified feed for current user:
- records owned by current user
- unowned Mango records:
  - `source = "mango"`
  - `userId = null`

Success `200`:
- `GetRecord[]`

### `GET /records/admin-feed`

Auth required. Director only.

Returns all records of all users plus unowned records.

Success `200`:
- `GetRecord[]`

Errors:
- `401` unauthorized
- `403` forbidden for non-director

### `GET /records/:id`

Auth required.

Returns single record only if current user is owner.

Request params:
- `id: string` in route, backend parses it to number

Success `200`:
- `GetRecord`

Errors:
- `400` invalid id
- `404` record not found
- `403` forbidden if record belongs to another user or is unowned

### `GET /records/by-mango-entry/:entryId`

Auth required.

Returns record by Mango `entry_id`.

Important:
- current implementation does **not** enforce ownership check here

Success `200`:
- `GetRecord`

Errors:
- `404` not found

---

## Stats

All stats endpoints are auth-required and director-only.

### `GET /stats/overview`

Returns top-level aggregated metrics.

Success `200`:

```/dev/null/stats-overview-response.json#L1-7
{
  "totalRecords": 120,
  "doneRecords": 95,
  "failedRecords": 10,
  "avgQualityScore": 78.4,
  "totalManagers": 5
}
```

Notes:
- `avgQualityScore` may be `null` if no scored records exist
- `totalManagers` counts users with role `"manager"`

Errors:
- `401` unauthorized
- `403` forbidden for non-director

### `GET /stats/weekly`

Returns last 7 days including empty days.

Success `200`:

```/dev/null/stats-weekly-response.json#L1-9
[
  { "date": "2026-04-25", "total": 18, "done": 14 },
  { "date": "2026-04-26", "total": 0, "done": 0 },
  { "date": "2026-04-27", "total": 7, "done": 4 }
]
```

Notes:
- date is `YYYY-MM-DD`
- backend groups by `coalesce(callStartedAt, finishedAt, startedAt)`

Errors:
- `401` unauthorized
- `403` forbidden for non-director

### `GET /stats/by-agent`

Returns aggregated stats for manager users.

Success `200`:

```/dev/null/stats-by-agent-response.json#L1-9
[
  {
    "userId": 1,
    "name": "Иванов Иван Иванович",
    "total": 28,
    "avgQualityScore": 79.1
  }
]
```

Notes:
- only users with role `"manager"` are included
- `name` is `fio` if present, otherwise fallback to `name`
- managers without records are still included with `total = 0`
- `avgQualityScore` may be `null`

Errors:
- `401` unauthorized
- `403` forbidden for non-director

---

## Mango webhooks

### `POST /integrations/mango/events/summary`

Public endpoint for Mango. Signature-validated.

Purpose:
- create or update Mango record metadata

Success `200`:

```/dev/null/mango-summary-response.json#L1-3
{
  "ok": true
}
```

### `POST /integrations/mango/events/record/added`

Public endpoint for Mango. Signature-validated.

Purpose:
- receive recording id
- download audio
- link/store file
- enqueue AI processing

Success `200`:

```/dev/null/mango-record-added-response.json#L1-3
{
  "ok": true
}
```

---

## Error model

Common backend error categories:

- `400` bad request
- `401` unauthorized
- `403` forbidden
- `404` not found
- `422` validation error
- `500` internal error

Important implementation notes:
- some business-rule violations are returned explicitly as `400`
- some duplicate-constraint service errors may currently surface as generic internal errors depending on global error handling

---

## Frontend integration checklist

- Always send cookies on protected requests.
- Treat `POST /records/upload` as async job start.
- Do not expect final AI output immediately after upload.
- Use `GET /records/feed` for user timeline.
- Use `GET /records/admin-feed` for director global feed.
- Respect role-based restrictions on user management and stats endpoints.
- Expect `qualityScore` to be nullable.
- Expect checkbox values as objects with `label` and `checked`, not as plain strings.