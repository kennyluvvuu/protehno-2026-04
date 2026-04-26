# Backend API для фронтенда

Этот backend обслуживает пользователей и сущность `records` — записи звонков из двух источников:

- `manual` — ручная загрузка аудиофайла через `POST /records/upload`
- `mango` — автоматическая ингестация звонков из Mango Office webhook'ами

Ключевая идея: backend всегда хранит звонок как `record`, а AI-обработка запускается асинхронно, если у записи есть аудио.

## Что делает backend

- cookie-auth (`POST /login`, `POST /logout`)
- управление пользователями (`/users/*`)
- role-based access:
  - `manager`
  - `director`
- ручной upload аудио и фоновая AI-обработка
- хранение и выдача `records` со статусами обработки
- AI-обогащение записей:
  - transcription
  - summary
  - tags
  - checkboxes
  - `qualityScore`
- агрегированные stats endpoint'ы для директора
- прием Mango webhook'ов:
  - `POST /integrations/mango/events/summary`
  - `POST /integrations/mango/events/record/added`

## Базовый URL

Локально: `http://localhost:3000`

## Авторизация

После `POST /login` backend ставит `httpOnly` cookie `auth`.

Для защищенных endpoint'ов используйте cookie:
- `credentials: "include"` для `fetch`
- `withCredentials: true` для axios

Bearer token frontend не использует.

## Роли

В системе есть две роли:

- `manager`
- `director`

Роль хранится как одиночная строка, не как массив.

### Что может `manager`

- смотреть себя через `GET /users/me`
- привязывать свой `mangoUserId`
- загружать записи
- видеть свои записи
- видеть свой `feed` плюс бесхозные Mango записи

### Что может `director`

- все возможности авторизованного пользователя
- видеть всех пользователей
- редактировать пользователей
- удалять пользователей
- видеть глобальный фид всех записей
- смотреть агрегированную статистику

## Сущность users

Поля пользователя в ответах backend:

- `id: number`
- `name: string`
- `fio: string | null`
- `role: "director" | "manager"`
- `email: string`
- `mangoUserId: number | null`

### Важно про регистрацию

`POST /users/register` — публичный endpoint.

Тело запроса валидируется по user schema, но сам route все равно принудительно создает только пользователя с ролью `manager`.

Поддерживаемые поля:

- `name` — обязательно
- `email` — обязательно
- `password` — обязательно
- `fio` — опционально
- `mangoUserId` — опционально
- `role` технически может прийти в body, но route все равно перезапишет ее на `"manager"`

Пример:

```/dev/null/register-request.json#L1-7
{
  "name": "Alice",
  "email": "alice@example.com",
  "password": "qwerty123",
  "fio": "Иванов Иван Иванович",
  "mangoUserId": 12345,
  "role": "manager"
}
```

Ответ:

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

### Важно про директора

При первом запуске приложения backend выполняет seed и создает одного пользователя с ролью `director`, если таблица `users` пуста.

Seed-пользователь по умолчанию:

```/dev/null/director-seed.json#L1-6
{
  "email": "director@example.com",
  "password": "director123",
  "name": "director",
  "role": "director"
}
```

Этот пользователь не должен создаваться через публичную регистрацию.

## Сущность records

`records` — единая таблица для ручных и Mango-звонков.

### Основные поля

- `id: number`
- `userId: number | null`
- `source?: "manual" | "mango"`
- `callTo: string | null`
- `title: string | null`
- `durationSec: number | null`
- `qualityScore?: number | null`
- `fileUri: string | null`
- `transcription: string | null`
- `summary: string | null`
- `status: "uploaded" | "queued" | "processing" | "done" | "failed" | "not_applicable"`
- `error: string | null`
- `startedAt: string | null`
- `finishedAt: string | null`
- `checkboxes: { tasks, promises, agreements } | null`
- `tags: string[]`

### Важно про `checkboxes`

Backend отдает `checkboxes` как объект с массивами объектов:

```/dev/null/checkboxes-shape.json#L1-17
{
  "tasks": [
    { "label": "Подготовить КП", "checked": false }
  ],
  "promises": [
    { "label": "Выслать до пятницы", "checked": false }
  ],
  "agreements": [
    { "label": "Встреча в четверг", "checked": false }
  ]
}
```

То есть значения внутри — не строки, а объекты вида:

- `label: string`
- `checked: boolean`

### Mango-поля

- `ingestionStatus?: "ready" | "pending_audio" | "downloading" | "no_audio" | "failed"`
- `ingestionError: string | null`
- `mangoEntryId?: string | null`
- `mangoCallId?: string | null`
- `mangoRecordingId?: string | null`
- `mangoCommunicationId?: string | null`
- `mangoUserId?: number | null`
- `direction?: string | null`
- `callerNumber?: string | null`
- `calleeNumber?: string | null`
- `lineNumber?: string | null`
- `extension?: string | null`
- `callStartedAt?: string | null`
- `callAnsweredAt?: string | null`
- `callEndedAt?: string | null`
- `talkDurationSec?: number | null`
- `isMissed?: boolean`
- `hasAudio?: boolean`

## Как работает обработка records

### 1) Manual upload flow

1. `POST /records/upload` (`multipart/form-data`, поле `file`, опционально `title`, `callTo`)
2. Backend сразу отвечает `202` с `{ id, userId, fileUri, status: "queued" }`
3. В фоне запускается AI:
   - транскрипция
   - summary
   - tags
   - checkboxes
   - `qualityScore`
4. Фронтенд опрашивает `GET /records/:id`, пока статус не станет `done` или `failed`

### 2) Mango flow

1. Mango шлет `summary` → создается или обновляется `record` с `source="mango"`
2. Если звонок с записью, Mango шлет `record/added` → backend скачивает аудио, сохраняет его, переводит запись в `queued` и запускает AI
3. Если звонок пропущен (`isMissed=true`), аудио нет:
   - `hasAudio=false`
   - `ingestionStatus="no_audio"`
   - `status="not_applicable"`

## Статусы

### AI status (`record.status`)

- `uploaded` — запись создана, но AI еще не стартовал
- `queued` — запись поставлена в обработку
- `processing` — AI в работе
- `done` — AI завершен успешно
- `failed` — AI завершился ошибкой
- `not_applicable` — обработка неприменима, например пропущенный звонок без аудио

### Ingestion status (`record.ingestionStatus`)

- `ready` — аудио доступно
- `pending_audio` — ждём `record/added`
- `downloading` — идет скачивание из Mango
- `no_audio` — у звонка нет записи
- `failed` — ошибка на этапе ингестации

## Endpoint'ы

### Публичные

- `GET /health`
- `POST /users/register`
- `POST /login`
- `POST /logout`

`POST /users/register` предназначен только для создания `manager`.

### Защищенные

#### Users

- `GET /users/me`
- `PATCH /users/me/mango-user-id`
- `GET /users/mango/:mangoUserId`

#### Users, только для `director`

- `GET /users`
- `GET /users/:id`
- `PATCH /users/:id`
- `DELETE /users/:id`

#### Records

- `POST /records/upload`
- `GET /records`
- `GET /records/feed`
- `GET /records/:id`
- `GET /records/by-mango-entry/:entryId`

#### Records, только для `director`

- `GET /records/admin-feed`

#### Stats, только для `director`

- `GET /stats/overview`
- `GET /stats/weekly`
- `GET /stats/by-agent`

### Webhook'и Mango

- `POST /integrations/mango/events/summary`
- `POST /integrations/mango/events/record/added`

Webhook'и проверяются по подписи и отвечают быстро, а обработка идет асинхронно.

## Важно про доступ к users

- `GET /users` доступен только директору
- `GET /users/:id` доступен только директору
- `PATCH /users/:id` доступен только директору
- `DELETE /users/:id` доступен только директору

### Ограничения удаления и редактирования пользователей

Backend защищает систему от потери последнего директора:

- нельзя снять роль `director` у последнего директора
- нельзя удалить последнего директора
- директор не может удалить сам себя

### Что происходит с records при удалении пользователя

Записи пользователя сохраняются.

Связь `records.user_id -> users.id` настроена как `ON DELETE SET NULL`, поэтому при удалении пользователя:
- запись не удаляется
- `userId` становится `null`

## Важно про доступ к records

- `GET /records` возвращает записи только текущего пользователя
- `GET /records/feed` возвращает:
  - записи текущего пользователя
  - Mango записи без владельца (`source="mango"` и `userId=null`)
- `GET /records/admin-feed` возвращает все записи и доступен только директору
- `GET /records/:id` содержит ownership-check:
  - `200` только для владельца
  - `403` для чужой записи
  - бесхозная запись тоже не пройдет ownership-check для обычного чтения по `:id`
- `PATCH /users/me/mango-user-id` делает backfill:
  - привязывает существующие `mango` записи с тем же `mangoUserId` к текущему пользователю
- `GET /records/by-mango-entry/:entryId` можно использовать для прямого поиска Mango записи по `entry_id`

### Важно про `GET /records/by-mango-entry/:entryId`

Текущая реализация не содержит ownership-check на этом endpoint'е.  
То есть это не приватный read по владельцу, а прямой поиск записи по Mango `entry_id`.

## Пример upload ответа

```/dev/null/upload-response.json#L1-7
{
  "id": 12,
  "userId": 1,
  "fileUri": "/absolute/path/to/uploads/1/1725000000000-call.mp3",
  "status": "queued",
  "message": "Record uploaded and queued for async processing"
}
```

## Stats endpoints

### `GET /stats/overview`

Возвращает агрегированные метрики:

```/dev/null/stats-overview-response.json#L1-7
{
  "totalRecords": 120,
  "doneRecords": 95,
  "failedRecords": 10,
  "avgQualityScore": 78.4,
  "totalManagers": 5
}
```

Примечания:
- `avgQualityScore` может быть `null`, если еще нет записей с оценкой
- `totalManagers` считает пользователей с ролью `"manager"`

### `GET /stats/weekly`

Возвращает последние 7 дней, включая пустые дни:

```/dev/null/stats-weekly-response.json#L1-9
[
  { "date": "2026-04-25", "total": 18, "done": 14 },
  { "date": "2026-04-26", "total": 0, "done": 0 },
  { "date": "2026-04-27", "total": 7, "done": 4 }
]
```

Примечания:
- дата в формате `YYYY-MM-DD`
- backend группирует по `coalesce(callStartedAt, finishedAt, startedAt)`

### `GET /stats/by-agent`

Возвращает статистику по менеджерам:

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

Примечания:
- включаются только пользователи с ролью `"manager"`
- `name` берется из `fio`, если он есть, иначе из `name`
- менеджеры без записей тоже включаются, с `total = 0`
- `avgQualityScore` может быть `null`

## Переменные окружения

Обязательные для общей работы backend:

- `DATABASE_URL`
- `JWT_SECRET`
- `SERVICE_API_KEY` (для доступа к защищённым маршрутам через заголовок `x-api-key`)
- `GROQ_API_KEY`
- `GROQ_BASE_URL`
- `GROQ_TRANSCRIPTION_MODEL`
- `MISTRAL_API_KEY`
- `MISTRAL_SUMMARY_MODEL`

Для Mango-интеграции:

- `MANGO_VPBX_API_KEY`
- `MANGO_VPBX_API_SALT`
- `MANGO_BASE_URL`

Если `MANGO_BASE_URL` не задан, клиент использует дефолт Mango API base URL.

Пустые Mango переменные не обязательно роняют сервер на старте, но webhook/API-операции Mango будут падать при вызове.

---

## Для AI-агентов

### Что агенту нужно учитывать

- Этот README — интеграционный контракт для фронтенда
- Авторизация: cookie-based и служебный `x-api-key`
- `role` — строка, не массив
- Для `POST /records/upload` результат асинхронный, финальные AI-данные приходят позже
- `qualityScore` может быть `null`
- `checkboxes
` содержат объекты с `label` и `checked`, а не массивы строк
- Публичная регистрация не должна использоваться для создания `director`
- `director` создается seed'ом при пустой таблице `users`
- Mango маршруты и webhook'и считаются частью актуального API
- `GET /records/admin-feed` и `/stats/*` доступны только директору

### Что агенту не нужно делать

- Не менять серверное поведение со стороны фронтенда
- Не пытаться читать `httpOnly` cookie в JavaScript
- Не ожидать синхронного AI-результата сразу после upload
- Не считать `GET /records/by-mango-entry/:entryId` приватным endpoint'ом владельца без дополнительной серверной проверки
