# Backend API Contract

Краткий API-контракт для фронтенда и AI-агентов.

## Rules for AI agents

- Treat this document as the source of truth for frontend integration.
- Do not edit anything inside `backend/`.
- Do not change backend contracts from the client side.
- If an endpoint feels inconsistent, adapt the frontend and report the issue separately.
- Main integration model:
  1. `POST /login` validates credentials and sets `httpOnly` cookie `auth`
  2. protected endpoints use cookie auth, not Bearer token
  3. frontend must send requests with credentials/cookies enabled
  4. `POST /records/upload` starts async processing only
  5. final AI data is fetched via `GET /records/:id`

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
```/dev/null/login-response.json#L1-5
{
  "id": 1,
  "name": "Alice",
  "email": "alice@example.com"
}
```

Side effect:
- backend sets `httpOnly` cookie `auth`

Rules:
- do not expect `token` in response body
- do not send `Authorization: Bearer ...`
- for protected endpoints send requests with cookies included

Example with `fetch`:
```/dev/null/fetch-auth.js#L1-3
fetch("http://localhost:3000/records", {
  credentials: "include"
})
```

Example with `axios`:
```/dev/null/axios-auth.js#L1-3
axios.get("http://localhost:3000/records", {
  withCredentials: true
})
```

Error semantics:
- invalid credentials -> message: `Invalid credentials`

### Logout
`POST /logout`

Success `200`:
```/dev/null/logout-response.json#L1-3
{
  "message": "Logged out"
}
```

Side effect:
- backend removes `auth` cookie

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

### Get current user
`GET /users/me`

Auth:
- requires `httpOnly` cookie `auth`

Success `200`:
```/dev/null/me-response.json#L1-5
{
  "id": 1,
  "name": "Alice",
  "email": "alice@example.com"
}
```

### Get users list
`GET /users`

Auth:
- requires `httpOnly` cookie `auth`

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

Auth:
- requires `httpOnly` cookie `auth`

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
- `queued` -> upload accepted, background processing scheduled
- `processing` -> AI processing in progress
- `done` -> AI processing completed
- `failed` -> AI processing failed

Note:
- schema also contains `uploaded`, but in the current HTTP flow the upload endpoint returns `queued`

### Upload audio record
`POST /records/upload`

Auth:
- requires `httpOnly` cookie `auth`

Request format:
- `multipart/form-data`
- file field name: `file`

Success `202`:
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
- requires `httpOnly` cookie `auth`

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
- requires `httpOnly` cookie `auth`

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

Error semantics:
- invalid id -> `400`, message: `Invalid record id`
- not found -> `404`, message: `Record not found`
- чужая запись -> `403`, message: `Forbidden`

Frontend interpretation:
- `queued` / `processing` -> show loading or pending state
- `done` -> render `transcription`, `summary`, `tags`, `checkboxes`
- `failed` -> render error from `error`

---

## Recommended frontend behavior

- do not store JWT from response body, because login response does not return one
- centralize credentials-enabled requests in API client
- use `credentials: "include"` or `withCredentials: true`
- model upload and final result as two separate states
- poll `GET /records/:id` every 2-5 seconds after upload
- stop polling when status becomes `done` or `failed`

---

## Short machine-readable summary

- auth mode: `httpOnly cookie`
- auth cookie name: `auth`
- login response contains user object only
- login side effect: sets auth cookie
- logout side effect: removes auth cookie
- protected endpoints:
  - `GET /users`
  - `GET /users/:id`
  - `GET /users/me`
  - `POST /records/upload`
  - `GET /records`
  - `GET /records/:id`
- upload response status: `202`
- upload response is not final AI result
- final AI result source: `GET /records/:id`
