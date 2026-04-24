# Backend API Contract

Краткий API-контракт для фронтенда и AI-агентов.

## Rules for AI agents

- Treat this document as the source of truth for frontend integration.
- Do not edit anything inside `backend/`.
- Do not change backend contracts from the client side.
- If an endpoint feels inconsistent, adapt the frontend and report the issue separately.
- Main integration model:
  1. `POST /login` returns `token`
  2. protected endpoints require `Authorization: Bearer <token>`
  3. `POST /records/upload` starts async processing only
  4. final AI data is fetched via `GET /records/:id`

---

## Base URL

- local: `http://localhost:3000`

---

## Auth

### Login
`POST /login`

Request:
```/dev/null/login-request.json#L1-4
{
  "email": "alice@example.com",
  "password": "qwerty123"
}
```

Success `200`:
```/dev/null/login-response.json#L1-6
{
  "id": 1,
  "name": "Alice",
  "email": "alice@example.com",
  "token": "<jwt-token>"
}
```

Rules:
- save `token`
- for protected endpoints send:
```/dev/null/auth-header.txt#L1-1
Authorization: Bearer <jwt-token>
```

Error semantics:
- invalid credentials -> message: `Invalid credentials`

---

## Health

### Check service status
`GET /health`

Success `200`:
```/dev/null/health-response.json#L1-3
{
  "status": "ok"
}
```

---

## Users

### Register user
`POST /users/register`

Request:
```/dev/null/register-request.json#L1-5
{
  "name": "Alice",
  "email": "alice@example.com",
  "password": "qwerty123"
}
```

Success `200`:
```/dev/null/register-response.json#L1-5
{
  "id": 1,
  "name": "Alice",
  "email": "alice@example.com"
}
```

Error semantics:
- `400` / `422` -> validation error
- occupied email -> message: `Email already in use`

### Get users list
`GET /users`

Success `200`:
```/dev/null/users-response.json#L1-8
[
  {
    "id": 1,
    "name": "Alice",
    "email": "alice@example.com"
  }
]
```

Type shape:
```/dev/null/user-type.ts#L1-5
type User = {
  id: number;
  name: string;
  email: string;
};
```

### Get user by id
`GET /users/:id`

Success `200`:
```/dev/null/user-by-id-response.json#L1-5
{
  "id": 1,
  "name": "Alice",
  "email": "alice@example.com"
}
```

Error semantics:
- not found -> message: `User not found`

---

## Records

## Async processing model

`POST /records/upload` does **not** return final AI results.

Expected frontend flow:
1. upload file
2. receive record `id`
3. poll `GET /records/:id`
4. stop polling on `done` or `failed`

Status meanings:
- `uploaded` -> file uploaded
- `processing` -> AI processing in progress
- `done` -> AI processing completed
- `failed` -> AI processing failed

### Upload audio record
`POST /records/upload`

Auth:
- requires `Authorization: Bearer <jwt-token>`

Request format:
- `multipart/form-data`
- file field name: `file`

Success `200`:
```/dev/null/upload-response.json#L1-7
{
  "id": 12,
  "userId": 1,
  "fileUri": "/absolute/path/to/uploads/1/1725000000000-call.mp3",
  "status": "queued",
  "message": "Record uploaded and queued for async processing"
}
```

Integration rules:
- response is only upload acknowledgment
- do not expect `summary`, `transcription`, `tags`, `checkboxes` here
- use returned `id` for `GET /records/:id`

### Get current user records
`GET /records`

Auth:
- requires `Authorization: Bearer <jwt-token>`

Success `200`:
```/dev/null/records-response.json#L1-17
[
  {
    "id": 12,
    "userId": 1,
    "callTo": null,
    "durationSec": null,
    "fileUri": "/absolute/path/to/uploads/1/1725000000000-call.mp3",
    "transcription": null,
    "summary": null,
    "status": "processing",
    "error": null,
    "startedAt": null,
    "finishedAt": null,
    "checkboxes": null,
    "tags": []
  }
]
```

Use cases:
- records history
- restore state after page reload
- show current processing items

### Get record by id
`GET /records/:id`

Auth:
- requires `Authorization: Bearer <jwt-token>`

In progress example:
```/dev/null/record-processing.json#L1-15
{
  "id": 12,
  "userId": 1,
  "callTo": null,
  "durationSec": null,
  "fileUri": "/absolute/path/to/uploads/1/1725000000000-call.mp3",
  "transcription": null,
  "summary": null,
  "status": "processing",
  "error": null,
  "startedAt": "2025-01-10T12:00:00.000Z",
  "finishedAt": null,
  "checkboxes": null,
  "tags": []
}
```

Done example:
```/dev/null/record-done.json#L1-30
{
  "id": 12,
  "userId": 1,
  "callTo": null,
  "durationSec": 98,
  "fileUri": "/absolute/path/to/uploads/1/1725000000000-call.mp3",
  "transcription": "Текст расшифровки звонка",
  "summary": "Краткая выжимка разговора",
  "status": "done",
  "error": null,
  "startedAt": "2025-01-10T12:00:00.000Z",
  "finishedAt": "2025-01-10T12:01:45.000Z",
  "checkboxes": {
    "tasks": [
      { "label": "Подготовить коммерческое предложение", "checked": false }
    ],
    "promises": [
      { "label": "Отправить материалы на почту", "checked": false }
    ],
    "agreements": [
      { "label": "Созвониться повторно на следующей неделе", "checked": false }
    ]
  },
  "tags": ["сделка", "follow-up"]
}
```

Failed example:
```/dev/null/record-failed.json#L1-15
{
  "id": 12,
  "userId": 1,
  "callTo": null,
  "durationSec": null,
  "fileUri": "/absolute/path/to/uploads/1/1725000000000-call.mp3",
  "transcription": null,
  "summary": null,
  "status": "failed",
  "error": "AI processing failed",
  "startedAt": "2025-01-10T12:00:00.000Z",
  "finishedAt": "2025-01-10T12:00:05.000Z",
  "checkboxes": null,
  "tags": []
}
```

Frontend interpretation:
- `processing` -> show loading state
- `done` -> render `transcription`, `summary`, `tags`, `checkboxes`
- `failed` -> render error from `error`

---

## Recommended frontend behavior

- store JWT after login
- centralize auth header injection
- model upload and final result as two separate states
- poll `GET /records/:id` every 2-5 seconds after upload
- stop polling when status becomes `done` or `failed`
