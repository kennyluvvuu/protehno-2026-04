# Backend API Contract

Актуальный контракт backend API для фронтенда и AI-агентов.

Этот файл должен считаться `source of truth` для интеграции с backend. Он описывает **текущее поведение реализации**, включая важные ограничения, особенности доступа и реальные формы ответов.

## Rules for AI agents

- Используйте этот файл как основной контракт интеграции.
- Не додумывайте поведение, если оно явно не описано.
- Аутентификация cookie-based: backend использует `httpOnly` cookie `auth`.
- Для защищённых запросов frontend должен отправлять cookie.
- `POST /records/upload` и Mango ingestion запускают асинхронную обработку; финальные AI-поля нужно читать через record endpoints, а не ждать их в upload/webhook ответе.
- Mango webhook endpoints публичные, но защищены подписью Mango.
- `director` и `manager` — одиночные string-roles, не массивы.
- У record checkboxes элементы имеют вид `{ label, checked }`.
- У record возможны `null` и отсутствующие Mango-related поля.
- Не все endpoint'ы симметрично проверяют ownership: это отдельно зафиксировано ниже и важно для AI-агентов.

## Base URL

- local: `http://localhost:3000`

## Auth model

- Login выдаёт cookie `auth`.
- Guard на protected routes:
  - читает `auth` cookie
  - валидирует JWT
  - затем **всегда** загружает актуального пользователя из БД
- Если cookie нет, JWT невалиден или пользователь удалён, backend отвечает `401`.

Cookie параметры в текущей реализации:
- `httpOnly: true`
- `path: /`
- `sameSite: lax`
- `secure: false`
- `maxAge: 7 days`

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

Important notes:
- JWT payload currently contains `id` and `role`
- subsequent protected requests still resolve the current user from DB
- invalid credentials currently surface as server-handled error with text `"Invalid credentials"`; for frontend treat this as failed login and do not rely on exact error shape beyond failure status

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

## User entity

Current response shape:

```/dev/null/user-type.ts#L1-21
type MangoTelephonyNumber = {
  number: string;
  protocol?: string;
  order?: number;
  wait_sec?: number;
  status?: string;
};

type User = {
  id: number;
  name: string;
  fio: string | null;
  role: "director" | "manager";
  email: string;
  mangoUserId: number | null;
  mangoLogin?: string | null;
  mangoExtension?: string | null;
  mangoPosition?: string | null;
  mangoDepartment?: string | null;
  mangoMobile?: string | null;
  mangoOutgoingLine?: string | null;
  mangoAccessRoleId?: number | null;
  mangoGroups?: number[] | null;
  mangoSips?: string[] | null;
  mangoTelephonyNumbers?: MangoTelephonyNumber[] | null;
};
```

Notes:
- `password_hash` never returns from API
- Mango profile fields now are part of real public response shape
- many Mango fields may be `null`
- some Mango fields are documented as optional because backend schema tolerates absent values in responses

### Seeded director

When table `users` is empty on startup, backend seeds one `director`.

Default seed:

```/dev/null/director-seed.json#L1-7
{
  "email": "director@example.com",
  "password": "director123",
  "name": "director",
  "fio": "Директор Демо",
  "role": "director"
}
```

---

## Users

### `POST /users/register`

Public endpoint.

Creates a user through public self-registration, but backend forcibly sets `role = "manager"` regardless of client input.

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

Validation notes:
- `name` required, non-empty
- `email` required, valid email
- `password` required, minimum 8 chars
- `fio` optional, may be `null`
- `role` is present in validation schema, but runtime route still overwrites it to `"manager"`
- `mangoUserId` optional, may be `null`
- public registration should not be used to create `director`

Success `200`:

```/dev/null/register-response.json#L1-8
{
  "id": 2,
  "name": "Alice",
  "fio": "Иванов Иван Иванович",
  "role": "manager",
  "email": "alice@example.com",
  "mangoUserId": 12345
}
```

Possible errors:
- `422` validation error
- duplicate email may currently surface as failure with message like `"Email already in use"`
- other internal errors possible

### `POST /users/mango/create-local-user`

Auth required. Director only.

Creates a local platform user from Mango directory data and immediately links existing unowned Mango records for the same `mangoUserId`.

Request body:

```/dev/null/create-local-user-request.json#L1-18
{
  "name": "Alice",
  "fio": "Иванов Иван Иванович",
  "email": "alice@example.com",
  "role": "manager",
  "mangoUserId": 12345,
  "mangoLogin": "alice",
  "mangoExtension": "101",
  "mangoPosition": "Менеджер",
  "mangoDepartment": "Sales",
  "mangoMobile": "+79990000000",
  "mangoOutgoingLine": "+74950000000",
  "mangoAccessRoleId": 7,
  "mangoGroups": [1, 2],
  "mangoSips": ["101", "alice-sip"],
  "mangoTelephonyNumbers": [
    { "number": "+74950000000", "protocol": "sip", "order": 1, "wait_sec": 15, "status": "active" }
  ],
  "password": "qwerty123"
}
```

Validation notes:
- `password` required, minimum 8 chars
- `mangoUserId` required, positive integer
- `role` defaults to `"manager"` in schema, but route is intended for manager creation from Mango data
- all Mango profile fields except `mangoUserId` are optional and nullable where documented

Success `200`:

```/dev/null/create-local-user-response.json#L1-21
{
  "id": 3,
  "name": "Alice",
  "fio": "Иванов Иван Иванович",
  "role": "manager",
  "email": "alice@example.com",
  "mangoUserId": 12345,
  "mangoLogin": "alice",
  "mangoExtension": "101",
  "mangoPosition": "Менеджер",
  "mangoDepartment": "Sales",
  "mangoMobile": "+79990000000",
  "mangoOutgoingLine": "+74950000000",
  "mangoAccessRoleId": 7,
  "mangoGroups": [1, 2],
  "mangoSips": ["101", "alice-sip"],
  "mangoTelephonyNumbers": [
    { "number": "+74950000000", "protocol": "sip", "order": 1, "wait_sec": 15, "status": "active" }
  ],
  "linkedCount": 5
}
```

Behavior notes:
- if unowned Mango records already exist for that `mangoUserId`, backend links them to the newly created user
- duplicate email or duplicate Mango user mapping may surface with message like `"Email or Mango user id already in use"`

Errors:
- `401` unauthorized
- `403` forbidden for non-director
- `422` validation error

### `GET /users/me`

Auth required.

Returns current authenticated user.

Success `200`:

```/dev/null/users-me-response.json#L1-18
{
  "id": 3,
  "name": "Alice",
  "fio": "Иванов Иван Иванович",
  "role": "manager",
  "email": "alice@example.com",
  "mangoUserId": 12345,
  "mangoLogin": "alice",
  "mangoExtension": "101",
  "mangoPosition": "Менеджер",
  "mangoDepartment": "Sales",
  "mangoMobile": "+79990000000",
  "mangoOutgoingLine": "+74950000000",
  "mangoAccessRoleId": 7,
  "mangoGroups": [1, 2],
  "mangoSips": ["101", "alice-sip"],
  "mangoTelephonyNumbers": []
}
```

### `GET /users`

Auth required. Director only.

Returns all users.

Success `200`:
- `User[]`

Errors:
- `401` unauthorized
- `403` forbidden for non-director

### `GET /users/:id`

Auth required. Director only.

Request params:
- `id: positive integer`

Success `200`:
- `User`

Errors:
- `401` unauthorized
- `403` forbidden
- `404` user not found

### `PATCH /users/:id`

Auth required. Director only.

Updates another user.

Request params:
- `id: positive integer`

Request body:

```/dev/null/user-update-request.json#L1-18
{
  "name": "Alice Updated",
  "fio": "Иванов Иван Иванович",
  "email": "alice.updated@example.com",
  "mangoUserId": 12345,
  "mangoLogin": "alice",
  "mangoExtension": "101",
  "mangoPosition": "Старший менеджер",
  "mangoDepartment": "Sales",
  "mangoMobile": "+79990000000",
  "mangoOutgoingLine": "+74950000000",
  "mangoAccessRoleId": 7,
  "mangoGroups": [1, 2],
  "mangoSips": ["101", "alice-sip"],
  "mangoTelephonyNumbers": [
    { "number": "+74950000000", "protocol": "sip", "order": 1, "wait_sec": 15, "status": "active" }
  ],
  "role": "manager"
}
```

All fields optional:
- `name?: string`
- `fio?: string | null`
- `email?: string`
- `mangoUserId?: number | null`
- `mangoLogin?: string | null`
- `mangoExtension?: string | null`
- `mangoPosition?: string | null`
- `mangoDepartment?: string | null`
- `mangoMobile?: string | null`
- `mangoOutgoingLine?: string | null`
- `mangoAccessRoleId?: number | null`
- `mangoGroups?: number[] | null`
- `mangoSips?: string[] | null`
- `mangoTelephonyNumbers?: MangoTelephonyNumber[] | null`
- `role?: "director" | "manager"`

Success `200`:
- updated `User`

Behavior notes:
- route checks target existence before update
- backend prevents removing the last director role
- duplicate email or duplicate Mango mapping may surface as `"Email or Mango user id already in use"`

Errors:
- `401` unauthorized
- `403` forbidden
- `404` user not found
- `400` when trying to demote the last director
- `422` validation error

### `DELETE /users/:id`

Auth required. Director only.

Deletes a user.

Request params:
- `id: positive integer`

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
- `403` forbidden
- `404` user not found
- `400` if director tries to delete themselves
- `400` if trying to delete the last director

### `PATCH /users/:id/reset-password`

Auth required. Director only.

Resets password for another user.

Request params:
- `id: positive integer`

Request body:

```/dev/null/reset-password-request.json#L1-3
{
  "password": "newpassword123"
}
```

Validation:
- `password` required
- minimum 8 chars

Success `200`:
- returns updated `User`

Behavior notes:
- response does **not** include any password data
- use this endpoint from admin UI rather than exposing raw password editing elsewhere

Errors:
- `401` unauthorized
- `403` forbidden
- `404` user not found
- `422` validation error

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
- updated `User`

Behavior notes:
- if `mangoUserId` is set to a positive number, backend also backfills ownership:
  - all existing unowned Mango records with same `mangoUserId` are linked to current user
- if mapping is cleared, existing linked records are not described by route as being detached; only user mapping changes

### `GET /users/mango/:mangoUserId`

Auth required.

Returns local platform user mapped to a Mango user id.

Request params:
- `mangoUserId: positive integer`

Success `200`:
- `User`

Errors:
- `401` unauthorized
- `404` not found

---

## Record entity

`records` stores both manually uploaded and Mango-ingested calls.

Current response shape:

```/dev/null/get-record-type.ts#L1-36
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
  mangoCommunicationId?: string | null;
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
- `mangoCommunicationId` is now part of current implementation
- `direction` currently is stored as string; practical values are `"inbound" | "outbound" | "unknown"`
- `callStartedAt`, `callAnsweredAt`, `callEndedAt`, `startedAt`, `finishedAt` serialize as date-time strings in JSON responses
- `qualityScore` may be `null`
- `fileUri` may be `null` for Mango calls without audio or before audio download
- `checkboxes` may be `null`
- `tags` always returns as array

## Processing model

### Manual upload flow

1. Frontend sends `POST /records/upload`
2. Backend stores file in local storage under `uploads/<userId>/<timestamp>-<originalName>`
3. Backend creates record with `status = "queued"`
4. Backend immediately returns `202`
5. Background task:
   - marks record `processing`
   - reads audio file
   - runs AI processing
   - writes:
     - `transcription`
     - `title`
     - `summary`
     - `durationSec`
     - `qualityScore`
     - `tags`
     - `checkboxes`
   - marks record `done`
6. On failure backend sets:
   - `status = "failed"`
   - `error = <message>`

### Mango ingestion flow

1. Mango sends `POST /integrations/mango/events/summary`
2. Backend creates or updates Mango record metadata
3. If call is missed:
   - `hasAudio = false`
   - `ingestionStatus = "no_audio"`
   - `status = "not_applicable"`
4. If call is expected to have recording:
   - initial state uses `ingestionStatus = "pending_audio"`
   - `status = "uploaded"`
5. Mango later sends `POST /integrations/mango/events/record/added`
6. Backend downloads recording, stores file, updates:
   - `hasAudio = true`
   - `ingestionStatus = "ready"`
   - `status = "queued"`
7. Then the same AI pipeline runs as for manual uploads

### Important ownership note

Ownership rules are not identical across endpoints:
- `GET /records/:id` requires owner
- `GET /records/:id/download` allows owner or director
- `PATCH /records/:id/checkboxes` allows owner or director
- `GET /records/by-mango-entry/:entryId` currently does **not** enforce ownership
- feed endpoints intentionally expose unowned Mango records according to route purpose

AI agents must not assume a stricter policy than the implementation if they are documenting current behavior.

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

Uploads audio and starts background AI processing.

Request:
- `multipart/form-data`

Fields:
- `file: audio/*` — required
- `title: string` — optional
- `callTo: string` — optional

Success `202`:

```/dev/null/record-upload-response.json#L1-7
{
  "id": 12,
  "userId": 1,
  "fileUri": "./uploads/1/1725000000000-call.mp3",
  "status": "queued",
  "message": "Record uploaded and queued for async processing"
}
```

Notes:
- response is job-start acknowledgment, not final AI result
- frontend should poll `GET /records/:id` or refresh lists/feeds
- upload route always creates record for current authenticated user

Errors:
- `401` unauthorized
- `422` invalid multipart/form-data body

### `GET /records`

Auth required.

Returns records owned by current user.

Notes:
- records with `userId = null` are not included
- linked Mango records owned by current user are included

Success `200`:
- `GetRecord[]`

### `GET /records/feed`

Auth required.

Returns unified feed for current user:
- owned records
- unowned Mango records where:
  - `source = "mango"`
  - `userId = null`

Success `200`:
- `GetRecord[]`

Frontend note:
- this endpoint is the main manager timeline/feed source
- frontend should clearly distinguish owned vs unowned items using `userId`

### `GET /records/admin-feed`

Auth required. Director only.

Returns global feed for all records:
- all user-owned records
- all unowned records

Success `200`:
- `GetRecord[]`

Errors:
- `401` unauthorized
- `403` forbidden

### `GET /records/:id`

Auth required.

Returns single record only if current user is owner.

Request params:
- `id: string` in route, backend parses to number

Success `200`:
- `GetRecord`

Errors:
- `400` invalid id
- `404` record not found
- `403` forbidden if record belongs to another user or is unowned

Important note:
- current implementation does **not** give director implicit access here

### `GET /records/by-mango-entry/:entryId`

Auth required.

Returns record by Mango `entry_id`.

Request params:
- `entryId: string`

Success `200`:
- `GetRecord`

Errors:
- `401` unauthorized
- `404` record not found

Important implementation note:
- current implementation does **not** check ownership or role on the found record
- this behavior should be treated as real current contract until changed in code

### `GET /records/:id/download`

Auth required.

Downloads record audio file if available.

Access:
- owner
- director

Request params:
- `id: string` in route, backend parses to number

Success `200`:
- raw file response
- `Content-Type` = stored file mime type or `application/octet-stream`
- `Content-Length` = file size
- `Content-Disposition: attachment; filename="<basename>"`

Possible errors:
- `400` invalid record id
- `403` forbidden
- `404` record not found
- `404` audio file not found

Notes:
- if `fileUri` is absent or `hasAudio === false`, backend returns `404`
- if DB references a missing file on disk, backend also returns `404`

### `PATCH /records/:id/checkboxes`

Auth required.

Updates checkboxes for a record.

Access:
- owner
- director

Request params:
- `id: string` in route, backend parses to number

Request body:

```/dev/null/update-record-checkboxes-request.json#L1-17
{
  "checkboxes": {
    "tasks": [
      { "label": "Перезвонить клиенту", "checked": true }
    ],
    "promises": [
      { "label": "Отправить КП", "checked": false }
    ],
    "agreements": [
      { "label": "Созвон завтра в 12:00", "checked": true }
    ]
  }
}
```

Success `200`:
- updated `GetRecord`

Errors:
- `401` unauthorized
- `400` invalid record id
- `403` forbidden
- `404` record not found
- `422` validation error

Frontend notes:
- send the full checkbox groups object
- preserve item `label` text exactly if you are only toggling `checked`

### `DELETE /records/:id`

Auth required. Director only.

Deletes record by id.

Request params:
- `id: string` in route, backend parses to number

Success `200`:

```/dev/null/records-delete-response.json#L1-3
{
  "message": "Record deleted"
}
```

Errors:
- `401` unauthorized
- `400` invalid record id
- `403` forbidden
- `404` record not found

---

## Stats

All stats endpoints are auth-required and director-only.

These endpoints support optional query param:
- `period=7d`
- `period=14d`
- `period=30d`

If omitted or unknown, backend falls back to `7d`.

Time filtering uses:
- `coalesce(callStartedAt, finishedAt, startedAt)`

### `GET /stats/overview`

Returns aggregated metrics for selected period.

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
- `avgQualityScore` may be `null`
- `totalManagers` counts all users with role `"manager"` and is not period-scoped
- records are period-scoped

Errors:
- `401` unauthorized
- `403` forbidden

### `GET /stats/weekly`

Returns daily counts for selected period.

Success `200`:

```/dev/null/stats-weekly-response.json#L1-10
[
  { "date": "2026-04-25", "total": 18, "done": 14 },
  { "date": "2026-04-26", "total": 0, "done": 0 },
  { "date": "2026-04-27", "total": 7, "done": 4 },
  { "date": "2026-04-28", "total": 3, "done": 2 }
]
```

Notes:
- date format: `YYYY-MM-DD`
- includes empty days with zero values
- result length equals selected period days count

Errors:
- `401` unauthorized
- `403` forbidden

### `GET /stats/by-agent`

Returns manager aggregates for selected period.

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
- `name` is `fio` if present, else fallback to `name`
- managers without records are still included with `total = 0`
- `avgQualityScore` may be `null`

Errors:
- `401` unauthorized
- `403` forbidden

---

## Mango webhooks

These endpoints are public for Mango, but backend validates request signature using:
- `vpbx_api_key`
- `sign`
- `json`

Request transport shape for both endpoints:
- content contains:
  - `vpbx_api_key: string`
  - `sign: string`
  - `json: string`
- backend parses `json` as JSON string
- malformed JSON or invalid schema returns `400`
- invalid signature returns `403`

### `POST /integrations/mango/events/summary`

Public endpoint. Signature-validated.

Purpose:
- receive final call metadata
- create or update Mango record metadata
- mark missed calls as `not_applicable`
- store Mango call identifiers and call timing metadata

Success `200`:

```/dev/null/mango-summary-response.json#L1-3
{
  "ok": true
}
```

Important behavior:
- processing is asynchronous after validation
- backend responds immediately so Mango does not retry
- success response does **not** mean downstream processing is completed

### `POST /integrations/mango/events/record/added`

Public endpoint. Signature-validated.

Purpose:
- receive `recording_id`
- download audio
- save audio locally
- attach audio to existing Mango record
- enqueue AI processing

Success `200`:

```/dev/null/mango-record-added-response.json#L1-3
{
  "ok": true
}
```

Important behavior:
- processing is asynchronous after validation
- response only confirms acceptance of event

---

## Mango sync and mapping endpoints

All endpoints below are auth-required and director-only.

These routes are intended for admin tooling, Mango directory reconciliation, and manual sync orchestration.

### `GET /integrations/mango/users/candidates`

Returns Mango directory rows enriched with local linking state and candidate matches.

Success `200`:

```/dev/null/mango-users-candidates-response.json#L1-39
{
  "items": [
    {
      "mangoUserId": 12345,
      "name": "Alice",
      "email": "alice@example.com",
      "department": "Sales",
      "position": "Менеджер",
      "accessRoleId": 7,
      "mobile": "+79990000000",
      "login": "alice",
      "extension": "101",
      "outgoingLine": "+74950000000",
      "sips": ["101", "alice-sip"],
      "telephonyNumbers": [
        {
          "number": "+74950000000",
          "protocol": "sip",
          "order": 1,
          "wait_sec": 15,
          "status": "active"
        }
      ],
      "groups": [1, 2],
      "linkedUserId": 3,
      "linkedByMangoUserId": true,
      "candidates": [
        {
          "user": {
            "id": 3,
            "name": "Alice",
            "fio": "Иванов Иван Иванович",
            "role": "manager",
            "email": "alice@example.com",
            "mangoUserId": 12345
          },
          "score": 100,
          "reasons": ["mango_user_id_exact"]
        }
      ],
      "createLocalUserDraft": {
        "name": "Alice",
        "fio": null,
        "email": "alice@example.com",
        "role": "manager",
        "mangoUserId": 12345,
        "mangoLogin": "alice",
        "mangoExtension": "101",
        "mangoPosition": "Менеджер",
        "mangoDepartment": "Sales",
        "mangoMobile": "+79990000000",
        "mangoOutgoingLine": "+74950000000",
        "mangoAccessRoleId": 7,
        "mangoGroups": [1, 2],
        "mangoSips": ["101", "alice-sip"],
        "mangoTelephonyNumbers": []
      }
    }
  ]
}
```

Notes:
- intended for admin UI, not end-user UI
- `candidates` are heuristic suggestions, not guaranteed matches
- `reasons` may include:
  - `mango_user_id_exact`
  - `extension_hint`
  - `login_hint`
  - `sip_hint`
  - `record_history`

Errors:
- `401` unauthorized
- `403` forbidden
- `500` sync/mango service errors

### `PATCH /integrations/mango/users/:mangoUserId/link`

Links or unlinks local user to Mango user id.

Request params:
- `mangoUserId: positive integer string`

Request body to link:

```/dev/null/mango-link-request.json#L1-3
{
  "userId": 3
}
```

Request body to unlink:

```/dev/null/mango-unlink-request.json#L1-3
{
  "userId": null
}
```

Success `200` when linked:

```/dev/null/mango-link-response.json#L1-6
{
  "ok": true,
  "mangoUserId": 12345,
  "linkedUserId": 3,
  "linkedCount": 5
}
```

Success `200` when unlinked:

```/dev/null/mango-unlink-response.json#L1-5
{
  "ok": true,
  "mangoUserId": 12345,
  "linkedUserId": null
}
```

Behavior notes:
- if another local user is already linked to this `mangoUserId`, backend clears that existing mapping first
- on successful link backend also assigns existing unowned Mango records with same `mangoUserId` to the target user
- unlink clears `mangoUserId` on currently linked user, if any

Errors:
- `401` unauthorized
- `403` forbidden
- `400` invalid Mango user id
- `404` target user not found

### `POST /integrations/mango/sync`

Runs manual Mango calls sync.

Auth required. Director only.

Request body shape is implementation-defined by sync schema and should be treated carefully by clients. Current practical fields are:

```/dev/null/mango-sync-request.json#L1-8
{
  "startDate": "2026-04-20",
  "endDate": "2026-04-26",
  "limit": 100,
  "offset": 0,
  "pollIntervalMs": 1500,
  "maxAttempts": 20,
  "downloadRecordings": true
}
```

Field meaning:
- `startDate: string` — required, sync window start
- `endDate: string` — required, sync window end
- `limit?: number`
- `offset?: number`
- `pollIntervalMs?: number`
- `maxAttempts?: number`
- `downloadRecordings?: boolean`

Success `200`:
- returns sync result summary object produced by backend service

Expected summary fields include:

```/dev/null/mango-sync-response.json#L1-12
{
  "startDate": "2026-04-20",
  "endDate": "2026-04-26",
  "fetched": 120,
  "created": 40,
  "updated": 80,
  "downloaded": 35,
  "failedDownloads": 2,
  "skippedNoAudio": 15,
  "errors": []
}
```

Important note:
- exact summary may evolve with implementation; consumers should tolerate extra fields

Errors:
- `401` unauthorized
- `403` forbidden
- `422` validation error
- `500` Mango sync failure

### `POST /integrations/mango/sync/users/refresh`

Refreshes Mango users directory snapshot from Mango side.

Success `200`:
- returns backend service result object for refresh operation

Frontend usage:
- use after admin wants latest Mango users before matching/linking
- treat as admin maintenance action, not user-facing routine flow

Errors:
- `401` unauthorized
- `403` forbidden
- `500` refresh failure

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
- some business-rule violations are explicit `400`
- duplicate DB constraints may surface as generic internal failure or as plain text error messages depending on route/service path
- some routes throw framework errors (`NotFoundError`) while others return `{ message }` manually
- frontend should treat HTTP status as primary signal, not rely on a single universal error payload shape

---

## Frontend integration notes

### Auth on frontend

- Всегда отправляйте cookie на защищённые запросы.
- Для browser fetch:
  - `credentials: "include"`
- После `POST /login` сразу можно вызывать `GET /users/me` для восстановления актуального профиля.
- При `401` очищайте клиентское auth-state и переводите пользователя на login flow.

### Users on frontend

- Для manager/director profile UI используйте `GET /users/me`.
- Для админского списка пользователей используйте `GET /users`.
- Для создания обычного пользователя через публичный signup используйте `POST /users/register`, но не рассчитывайте на возможность задать `director`.
- Для админских Mango сценариев:
  - `GET /integrations/mango/users/candidates`
  - `POST /users/mango/create-local-user`
  - `PATCH /integrations/mango/users/:mangoUserId/link`
  - `POST /integrations/mango/sync/users/refresh`

### Records on frontend

- Для основного manager feed используйте `GET /records/feed`.
- Для списка только своих записей используйте `GET /records`.
- Для director-глобального списка используйте `GET /records/admin-feed`.
- Не ожидайте финальные AI данные сразу после `POST /records/upload`.
- После upload:
  - оптимистично добавьте item со `status = "queued"`
  - затем обновляйте его через polling или refetch
- Для открытия карточки записи по id используйте `GET /records/:id`, но помните:
  - директор не имеет автоматического доступа к чужой записи через этот endpoint
- Для скачивания аудио используйте `GET /records/:id/download`.
- Для UI чекбоксов используйте `PATCH /records/:id/checkboxes` и отправляйте весь объект `checkboxes`.
- `fileUri` не должен использоваться как публичный frontend URL; для скачивания используйте именно download endpoint.
- `qualityScore` и AI output могут быть `null`.
- Для missed Mango calls ожидайте:
  - `hasAudio = false`
  - `status = "not_applicable"`

### Mango data on frontend

- Разделяйте:
  - local platform user identity
  - Mango mapping/profile fields
- В user feed могут присутствовать unowned Mango records.
- Если UI должен показывать, чья это запись:
  - проверяйте `userId`
  - проверяйте `mangoUserId`
  - визуально выделяйте unassigned records

### Stats on frontend

- Director dashboard:
  - `GET /stats/overview?period=7d|14d|30d`
  - `GET /stats/weekly?period=7d|14d|30d`
  - `GET /stats/by-agent?period=7d|14d|30d`
- Если `period` не передан, backend использует `7d`.
- В графиках и KPI допускайте `avgQualityScore = null`.

### What AI agents should not assume

- Не считать, что `/records/:id` доступен директору для любой записи.
- Не считать, что `/records/by-mango-entry/:entryId` делает ownership check.
- Не считать, что upload response уже содержит итоговые AI fields.
- Не считать, что все ошибки возвращаются в одинаковом JSON формате.
- Не считать, что Mango-интеграция всегда сразу назначает владельца записи.

## Minimal frontend checklist

- send cookies on every protected request
- use `GET /users/me` to hydrate session
- use `GET /records/feed` for manager timeline
- use `GET /records/admin-feed` for director timeline
- treat upload and Mango audio ingestion as async jobs
- tolerate `null` in AI and Mango fields
- use download endpoint instead of `fileUri`
- send full checkbox groups on checkbox updates
- respect director-only restrictions on users, stats, delete, and Mango admin routes