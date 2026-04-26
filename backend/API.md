# Backend API Contract (actual code state)

Этот документ описывает **текущее** API backend по коду в `backend/src`.

## Rules for AI agents

- Источник истины: маршруты в `src/plugins/*/index.ts`.
- Почти все защищённые роуты требуют cookie `auth` (JWT) через `guardPlugin`.
- Роль `director` обязательна для админских роутов пользователей, статистики и Mango sync/mapping.
- Ошибки обычно имеют формат `{ "message": "..." }`.
- Обработка записей асинхронная: `POST /records/upload` и Mango webhook возвращают ответ до завершения AI-пайплайна.

## Base URL

- Local: `http://localhost:3000`

## Auth model

- Аутентификация: HttpOnly cookie `auth`.
- JWT payload: `{ id: number, role: "director" | "manager" }`.
- Cookie settings (текущие):
  - `httpOnly: true`
  - `path: /`
  - `sameSite: lax`
  - `secure: false` (dev)
  - `maxAge: 7 days`

## Common error model

Типовые ответы:

```json
{ "message": "Unauthorized" }
```

```json
{ "message": "Forbidden" }
```

```json
{ "message": "User not found" }
```

```json
{ "message": "Invalid record id" }
```

Глобальный `onError` возвращает:
- `404` для `NotFoundError`
- `500` для остальных `Error`

## Health

### `GET /health`

Публичный endpoint.

Response `200`:

```json
{ "status": "ok" }
```

## Auth

### `POST /login`

Публичный endpoint. Валидирует email/password, устанавливает cookie `auth`.

Body (минимально необходимое):

```json
{
  "email": "manager@example.com",
  "password": "password123"
}
```

Response `200`: объект пользователя (без `password_hash`).

### `POST /logout`

Удаляет cookie `auth`.

Response `200`:

```json
{ "message": "Logged out" }
```

## User entity

`User` (ответы API) содержит:

```ts
{
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
  mangoTelephonyNumbers?: Array<{
    number: string;
    protocol?: string;
    order?: number;
    wait_sec?: number;
    status?: string;
  }> | null;
}
```

### Seeded director

Если таблица `users` пуста, создаётся директор:
- `email: director@example.com`
- `password: director123`
- `role: director`

## Users

### `POST /users/register`

Публичная регистрация. Роль принудительно ставится в `manager`.

Body:

```json
{
  "name": "manager1",
  "fio": "Иван Иванов",
  "email": "manager1@example.com",
  "password": "password123",
  "role": "manager"
}
```

Примечание: даже если передать `role`, сервис создаёт `manager`.

Response `200`: `User`.

### `POST /users/mango/create-local-user` (director)

Создаёт локального пользователя из Mango-профиля и пытается привязать уже загруженные непривязанные Mango записи.

Body:

```json
{
  "name": "operator",
  "fio": "Оператор 1",
  "email": "operator@example.com",
  "role": "manager",
  "mangoUserId": 12345,
  "mangoLogin": "op_login",
  "mangoExtension": "101",
  "mangoPosition": "Sales",
  "mangoDepartment": "Dept",
  "mangoMobile": "+70000000000",
  "mangoOutgoingLine": "+79990000000",
  "mangoAccessRoleId": 3,
  "mangoGroups": [1, 2],
  "mangoSips": ["101"],
  "mangoTelephonyNumbers": [{ "number": "+79990000000" }],
  "password": "optionalPassword"
}
```

Response `200`:

```json
{
  "id": 10,
  "name": "operator",
  "role": "manager",
  "email": "operator@example.com",
  "mangoUserId": 12345,
  "linkedCount": 7
}
```

### `GET /users/me`

Response `200`: текущий `User`.

### `GET /users` (director)

Response `200`: `User[]`.

### `GET /users/:id` (director)

Response `200`: `User`.

### `PATCH /users/:id` (director)

Обновляет пользователя. Нельзя понизить/удалить последнего директора.

Body: любой поднабор полей `User` + `role`.

Response `200`: обновлённый `User`.

### `DELETE /users/:id` (director)

Ограничения:
- директор не может удалить самого себя;
- нельзя удалить последнего директора.

Response `200`:

```json
{ "message": "User deleted" }
```

### `PATCH /users/:id/reset-password` (director)

Body:

```json
{ "password": "newStrongPassword" }
```

Response `200`: `User`.

### `PATCH /users/me/mango-user-id`

Привязывает/отвязывает текущего пользователя к Mango `user_id`.

Body:

```json
{ "mangoUserId": 12345 }
```

или

```json
{ "mangoUserId": null }
```

Response `200`: обновлённый `User`.

Побочный эффект: при установке `mangoUserId` backend привязывает существующие непривязанные Mango записи к этому пользователю.

### `GET /users/mango/:mangoUserId`

Response `200`: `User`.

Response `404`:

```json
{ "message": "User not found" }
```

## Record entity

`Record` (API response):

```ts
{
  id: number;
  userId: number | null;

  source?: "manual" | "mango";
  ingestionStatus?: "ready" | "pending_audio" | "downloading" | "no_audio" | "failed";
  ingestionError?: string | null;

  mangoEntryId?: string | null;
  mangoCallId?: string | null;
  mangoRecordingId?: string | null;
  mangoCommunicationId?: string | null;
  mangoUserId?: number | null;

  direction?: string | null;
  directionKind?: "inbound" | "outbound" | "unknown" | null;
  callerNumber?: string | null;
  calleeNumber?: string | null;
  lineNumber?: string | null;
  extension?: string | null;

  callStartedAt?: string | null;
  callAnsweredAt?: string | null;
  callEndedAt?: string | null;
  talkDurationSec?: number | null;

  isMissed?: boolean;
  hasAudio?: boolean;

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

  checkboxes: {
    tasks: Array<{ label: string; checked: boolean }>;
    promises: Array<{ label: string; checked: boolean }>;
    agreements: Array<{ label: string; checked: boolean }>;
  } | null;

  tags: string[];
}
```

## Processing model

### Manual upload flow

1. `POST /records/upload` создаёт запись со статусом `queued`.
2. Асинхронно: `queued -> processing -> done` или `failed`.
3. При успехе сохраняются: `transcription`, `summary`, `tags`, `checkboxes`, `qualityScore`, `durationSec`.

### Mango ingestion flow

1. `/integrations/mango/events/summary` создаёт/обновляет metadata записи.
2. Если звонок пропущен (`talkDurationSec = 0`):
- `isMissed = true`
- `status = not_applicable`
- `ingestionStatus = no_audio`
3. `/integrations/mango/events/record/added` скачивает аудио, сохраняет файл, ставит:
- `hasAudio = true`
- `ingestionStatus = ready`
- `status = queued`
4. Далее запускается тот же AI-пайплайн, что и для manual.

### Ownership note

- `record.userId` может быть `null` (не удалось сопоставить Mango user).
- Когда mapping появляется, backend массово привязывает непривязанные записи.

## Records

Все endpoints ниже защищены (`auth` cookie).

### `POST /records/upload`

Загрузка аудио и постановка в очередь.

Content-Type: `multipart/form-data`

Fields:
- `file` (required, `audio/*`)
- `title` (optional)
- `callTo` (optional)

Response `202`:

```json
{
  "id": 101,
  "userId": 7,
  "fileUri": "./uploads/7/1710000000000-call.mp3",
  "status": "queued",
  "message": "Record uploaded and queued for async processing"
}
```

### `GET /records`

Возвращает записи текущего пользователя.

Response `200`: `Record[]`.

### `GET /records/feed`

То же, что `/records`, но отсортировано по `callStartedAt desc, id desc`.

Response `200`: `Record[]`.

### `GET /records/admin-feed` (director)

Глобальная лента всех записей (`callStartedAt desc, id desc`).

Response `200`: `Record[]`.

### `GET /records/:id`

Доступ: владелец записи или директор.

Response `200`: `Record`.

Response `404`:

```json
{ "message": "Record not found" }
```

### `GET /records/by-mango-entry/:entryId`

Возвращает запись по `mangoEntryId`.

Response `200`: `Record`.

### `GET /records/:id/download`

Скачивание аудиофайла.

Доступ: владелец записи или директор.

Поведение:
- если `fileUri` отсутствует или `hasAudio = false` -> `404 Audio file not found`.
- если файл физически отсутствует в storage -> `404 Audio file not found`.

Success `200`: бинарный ответ с заголовками:
- `Content-Type`
- `Content-Length`
- `Content-Disposition: attachment; filename="..."`

### `PATCH /records/:id/checkboxes`

Обновляет `checkboxes` (ручная корректировка).

Доступ: владелец записи или директор.

Body:

```json
{
  "checkboxes": {
    "tasks": [{ "label": "Согласовать КП", "checked": true }],
    "promises": [{ "label": "Перезвонить завтра", "checked": false }],
    "agreements": [{ "label": "Отправить прайс", "checked": true }]
  }
}
```

Response `200`: обновлённый `Record`.

### `DELETE /records/:id` (director)

Удаляет запись и связанные tags.

Response `200`:

```json
{ "message": "Record deleted" }
```

## Stats

Все endpoints `/stats/*` доступны только `director`.

### Query params

- `period`: `7d | 14d | 30d | 90d` (по умолчанию `7d`).
- Для `GET /stats/global` и `GET /stats/agent/:userId/dashboard` можно передать custom range:
  - `startDate` (ISO)
  - `endDate` (ISO)

Ограничения custom range:
- обе даты должны быть переданы одновременно;
- обе даты должны парситься в valid date;
- `endDate > startDate`.

### Activity time (важно для всех отчётов)

Фильтрация диапазона в stats строится по:

`activityAt = coalesce(callStartedAt, callEndedAt, callAnsweredAt, finishedAt, startedAt)`

Это значит:
- в приоритете реальное время звонка (`callStartedAt`),
- затем `callEndedAt` / `callAnsweredAt`,
- иначе время окончания AI,
- иначе время старта AI.

`missed` в статистике считается как:

`isMissed = true OR ingestionStatus = 'no_audio'`

### `GET /stats/overview`

Быстрый summary для KPI-card верхнего уровня.

Response `200`:

```ts
{
  totalRecords: number;
  doneRecords: number;
  failedRecords: number;
  avgQualityScore: number | null; // округлено до 1 знака
  totalManagers: number;
}
```

### `GET /stats/weekly`

Дневной ряд по объёму/успешности обработки.

Response `200`:

```ts
Array<{
  date: string; // YYYY-MM-DD
  total: number;
  done: number;
}>
```

Ряд всегда плотный: дни без данных возвращаются как `0`.

### `GET /stats/by-agent`

Статистика по менеджерам (включая менеджеров без записей в периоде).

Важно: учитываются не только записи с `record.userId = manager.id`, но и непривязанные записи (`record.userId IS NULL`), где `record.mangoUserId` совпадает с `manager.mangoUserId`.

Response `200`:

```ts
Array<{
  userId: number;
  name: string;
  total: number;
  done: number;
  failed: number;
  missed: number;
  avgTalkDurationSec: number | null;
  avgQualityScore: number | null;
}>
```

Сортировка: по `total desc`, затем `name`.

### `GET /stats/agent/:userId/dashboard`

Персональный дашборд по конкретному менеджеру.

Доступ:
- только `director`;
- целевой пользователь должен существовать и иметь роль `manager`.

Ошибки:
- `400 { "message": "Invalid user id" }`
- `404 { "message": "User not found" }`
- `400 { "message": "Target user must be a manager" }`

Важно: endpoint включает как напрямую привязанные записи (`record.userId = manager.id`), так и непривязанные Mango записи с совпадающим `mangoUserId`.

Response `200`:

```ts
{
  agent: {
    userId: number;
    name: string;
    email: string;
  };

  range: {
    mode: "period" | "custom";
    period: "7d" | "14d" | "30d" | "90d" | "custom";
    start: string; // ISO
    end: string;   // ISO (exclusive upper bound)
    days: number;
  };

  overview: {
    totalRecords: number;
    doneRecords: number;
    failedRecords: number;
    avgQualityScore: number | null;

    queuedRecords: number;
    processingRecords: number;
    uploadedRecords: number;
    notApplicableRecords: number;

    missedRecords: number;
    noAudioRecords: number;
    withAudioRecords: number;

    avgTalkDurationSec: number | null;
    avgProcessingDurationSec: number | null;
  };

  source: Array<{
    source: string;
    total: number;
    done: number;
    failed: number;
    inProgress: number;
    missed: number;
    noAudio: number;
    avgQualityScore: number | null;
  }>;

  direction: Array<{
    direction: string;
    total: number;
    done: number;
    failed: number;
    missed: number;
    avgQualityScore: number | null;
  }>;

  processingStatuses: Array<{ status: string; total: number }>;
  ingestionStatuses: Array<{ ingestionStatus: string; total: number }>;

  trend: Array<{
    date: string;
    total: number;
    done: number;
    failed: number;
    missed: number;
    noAudio: number;
    avgQualityScore: number | null;
  }>;

  operational: {
    mangoPendingAudio: number;
    mangoDownloading: number;
    mangoReady: number;
    mangoNoAudio: number;
    mangoIngestionFailed: number;
    aiQueued: number;
    aiProcessing: number;
    aiFailed: number;
  };
}
```

### `GET /stats/global`

Главный endpoint для дашборда: возвращает комплексный срез по качеству, пайплайну, источникам, ownership и трендам.

Response `200`:

```ts
{
  range: {
    mode: "period" | "custom";
    period: "7d" | "14d" | "30d" | "90d" | "custom";
    start: string; // ISO
    end: string;   // ISO (exclusive upper bound)
    days: number;
  };

  overview: {
    totalRecords: number;
    doneRecords: number;
    failedRecords: number;
    avgQualityScore: number | null;
    totalManagers: number;

    queuedRecords: number;
    processingRecords: number;
    uploadedRecords: number;
    notApplicableRecords: number;

    missedRecords: number;
    noAudioRecords: number;
    withAudioRecords: number;
    unassignedRecords: number;

    avgTalkDurationSec: number | null;
    avgProcessingDurationSec: number | null;
  };

  source: Array<{
    source: string; // manual | mango | unknown
    total: number;
    done: number;
    failed: number;
    inProgress: number; // uploaded + queued + processing
    missed: number;
    noAudio: number;
    avgQualityScore: number | null;
  }>;

  direction: Array<{
    direction: string; // inbound | outbound | unknown
    total: number;
    done: number;
    failed: number;
    missed: number;
    avgQualityScore: number | null;
  }>;

  processingStatuses: Array<{
    status: string;
    total: number;
  }>;

  ingestionStatuses: Array<{
    ingestionStatus: string;
    total: number;
  }>;

  ownership: {
    assigned: number;
    unassigned: number;
    unassignedMango: number;
    unassignedManual: number;
  };

  trend: Array<{
    date: string; // YYYY-MM-DD
    total: number;
    done: number;
    failed: number;
    missed: number;
    noAudio: number;
    avgQualityScore: number | null;
  }>;

  byAgent: Array<{
    userId: number;
    name: string;
    total: number;
    done: number;
    failed: number;
    missed: number;
    avgTalkDurationSec: number | null;
    avgQualityScore: number | null;
  }>;

  operational: {
    mangoPendingAudio: number;
    mangoDownloading: number;
    mangoReady: number;
    mangoNoAudio: number;
    mangoIngestionFailed: number;
    aiQueued: number;
    aiProcessing: number;
    aiFailed: number;
    unassignedMango: number;
  };
}
```

### Интерпретация ключевых метрик для дашборда

- `overview.doneRecords / overview.totalRecords` -> completion rate.
- `overview.failedRecords / overview.totalRecords` -> processing failure rate.
- `overview.unassignedRecords` и `ownership.unassignedMango` -> проблемы маппинга операторов.
- `operational.mangoPendingAudio + mangoDownloading` -> backlog ingestion.
- `operational.aiQueued + aiProcessing` -> backlog AI.
- `trend[]` -> дневной тренд объёма/качества/пропущенных.
- `source[]` + `direction[]` -> качество по источнику и направлению звонков.

### Рекомендуемая раскладка dashboard (frontend / AI)

- Block 1 (KPI cards): `overview.*`.
- Block 2 (Pipeline health): `operational`, `processingStatuses`, `ingestionStatuses`.
- Block 3 (Ownership & mapping): `ownership`.
- Block 4 (Quality slices): `source`, `direction`, `byAgent`.
- Block 5 (Time trend): `trend`.

## Mango webhooks

### Signature verification

Оба webhook endpoint требуют корректную подпись Mango:
- body должен содержать `vpbx_api_key`, `sign`, `json`.
- при неверной подписи -> `403 { "message": "Invalid signature" }`.

### `POST /integrations/mango/events/summary`

Body:

```json
{
  "vpbx_api_key": "...",
  "sign": "...",
  "json": "{ ...payload... }"
}
```

`json` должен соответствовать `mangoSummaryPayloadSchema`:
- `entry_id: string`
- `call_direction: number` (1 inbound, 2 outbound)
- `from`, `to`, `line_number`
- `create_time`, `talk_time`, `end_time`, и т.д.

Response `200`:

```json
{ "ok": true }
```

Обработка асинхронная.

### `POST /integrations/mango/events/record/added`

Body:

```json
{
  "vpbx_api_key": "...",
  "sign": "...",
  "json": "{ ...payload... }"
}
```

`json` должен соответствовать `mangoRecordAddedPayloadSchema`:
- `entry_id`, `product_id`, `user_id`, `recording_id`, `timestamp`.

Response `200`:

```json
{ "ok": true }
```

Обработка асинхронная: скачивание записи, сохранение в storage, запуск AI.

## Mango sync and mapping (director)

Все endpoints ниже защищены + требуют роль `director`.

### `GET /integrations/mango/users/candidates`

Возвращает список пользователей Mango с кандидатами сопоставления на локальных пользователей.

Response `200`:

```ts
{
  items: Array<{
    mangoUserId: number;
    name: string | null;
    email: string | null;
    department: string | null;
    position: string | null;
    accessRoleId: number | null;
    mobile: string | null;
    login: string | null;
    extension: string | null;
    outgoingLine: string | null;
    sips: string[];
    telephonyNumbers: Array<{ number: string; protocol?: string; order?: number; wait_sec?: number; status?: string }>;
    groups: number[];

    linkedUserId: number | null;
    linkedByMangoUserId: boolean;

    candidates: Array<{
      user: {
        id: number;
        name: string;
        fio: string | null;
        email: string;
        role: "director" | "manager";
        mangoUserId: number | null;
      };
      score: number;
      reasons: Array<"mango_user_id_exact" | "extension_hint" | "login_hint" | "sip_hint" | "record_history">;
    }>;

    createLocalUserDraft: {
      name: string;
      fio: string | null;
      email: string;
      role: "manager";
      mangoUserId: number;
      mangoLogin: string | null;
      mangoExtension: string | null;
      mangoPosition: string | null;
      mangoDepartment: string | null;
      mangoMobile: string | null;
      mangoOutgoingLine: string | null;
      mangoAccessRoleId: number | null;
      mangoGroups: number[];
      mangoSips: string[];
      mangoTelephonyNumbers: Array<{ number: string; protocol?: string; order?: number; wait_sec?: number; status?: string }>;
    } | null;
  }>;
}
```

### `PATCH /integrations/mango/users/:mangoUserId/link`

Привязывает Mango user к локальному пользователю или снимает привязку.

Body:

```json
{ "userId": 7 }
```

или

```json
{ "userId": null }
```

Response `200` (link):

```json
{
  "ok": true,
  "mangoUserId": 12345,
  "linkedUserId": 7,
  "linkedCount": 12
}
```

Response `200` (unlink):

```json
{
  "ok": true,
  "mangoUserId": 12345,
  "linkedUserId": null
}
```

### `POST /integrations/mango/sync`

Ручной polling sync звонков за диапазон.

Body:

```json
{
  "startDate": "2026-04-01",
  "endDate": "2026-04-25",
  "limit": 500,
  "offset": 0,
  "pollIntervalMs": 3000,
  "maxAttempts": 30,
  "downloadRecordings": true
}
```

Response `200`:

```json
{
  "startDate": "2026-04-01",
  "endDate": "2026-04-25",
  "fetched": 120,
  "created": 40,
  "updated": 80,
  "downloaded": 65,
  "failedDownloads": 2,
  "skippedNoAudio": 53
}
```

### `POST /integrations/mango/sync/users/refresh`

Обновляет cached directory пользователей Mango.

Response `200`:

```json
{ "count": 83 }
```

## AI-agent integration notes

- Для ролевой авторизации не полагайтесь на UI: проверяйте `403` как нормальный сценарий.
- Для `records` учитывайте `status` + `ingestionStatus` вместе:
  - `status=not_applicable` и `ingestionStatus=no_audio` — валидный финал для пропущенного звонка.
- Для общего дашборда используйте `GET /stats/global`.
- Для дашборда конкретного менеджера используйте `GET /stats/agent/:userId/dashboard` (вместо фильтрации `by-agent` на клиенте).
- В любых списках записей `userId=null` не ошибка, а сигнал непривязанного Mango владельца.
- `range.end` в stats фактически используется как exclusive upper bound.

## Minimal frontend checklist

1. Логин через `POST /login`, всегда с `credentials: include`.
2. Проверка сессии через `GET /users/me`.
3. Для manager-экрана использовать `GET /records/feed`.
4. Для director-экрана использовать `GET /records/admin-feed` + `GET /stats/global`.
5. Для карточки конкретного сотрудника использовать `GET /stats/agent/:userId/dashboard`.
6. Для Mango mapping использовать `/integrations/mango/users/candidates` + `PATCH /integrations/mango/users/:mangoUserId/link`.
7. Для ручного sync использовать `POST /integrations/mango/sync`.
