# Backend API для фронтенда

Этот backend обслуживает пользователей и сущность `records` (записи звонков) из двух источников:
- `manual` — ручная загрузка аудиофайла через `POST /records/upload`.
- `mango` — автоматическая ингестация звонков из Mango Office webhook'ами.

Ключевая идея: backend всегда хранит звонок как `record`, а AI-обработка запускается асинхронно, если у записи есть аудио.

## Что делает backend

- cookie-auth (`POST /login`, `POST /logout`);
- управление пользователями (`/users/*`);
- ручной upload аудио и фоновая AI-обработка;
- хранение и выдача `records` со статусами обработки;
- прием Mango webhook'ов:
  - `POST /integrations/mango/events/summary`
  - `POST /integrations/mango/events/record/added`

## Базовый URL

Локально: `http://localhost:3000`

## Авторизация

После `POST /login` backend ставит `httpOnly` cookie `auth`.
Для защищенных endpoint'ов используйте cookie (`credentials: "include"` / `withCredentials: true`), не Bearer token.

## Сущность records

`records` — единая таблица для ручных и Mango-звонков.

### Базовые поля (используются фронтендом уже сейчас)

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

### Mango-поля (новые, опциональные)

- `ingestionStatus: "ready" | "pending_audio" | "downloading" | "no_audio" | "failed"`
- `ingestionError: string | null`
- `mangoEntryId`, `mangoCallId`, `mangoRecordingId`, `mangoCommunicationId`
- `mangoUserId`
- `direction`, `callerNumber`, `calleeNumber`, `lineNumber`, `extension`
- `callStartedAt`, `callAnsweredAt`, `callEndedAt`
- `talkDurationSec`, `isMissed`, `hasAudio`

## Как работает обработка records

### 1) Manual upload flow

1. `POST /records/upload` (`multipart/form-data`, поле `file`, опционально `title`, `callTo`).
2. Backend сразу отвечает `202` с `{ id, userId, fileUri, status: "queued" }`.
3. В фоне запускается AI (транскрипция + summary + tags + checkboxes).
4. Фронтенд опрашивает `GET /records/:id`, пока статус не станет `done` или `failed`.

### 2) Mango flow

1. Mango шлет `summary` (метаданные звонка) → создается/обновляется `record` с `source="mango"`.
2. Если звонок с записью, Mango шлет `record/added` → backend скачивает аудио, сохраняет в storage, переводит запись в `queued` и запускает AI.
3. Если звонок пропущен (`isMissed=true`), аудио нет:
   - `hasAudio=false`
   - `ingestionStatus="no_audio"`
   - `status="not_applicable"` (AI не запускается).

## Статусы

### AI status (`record.status`)

- `uploaded` — запись создана, но AI еще не стартовал.
- `queued` — запись поставлена в обработку.
- `processing` — AI в работе.
- `done` — AI завершен успешно.
- `failed` — AI завершился ошибкой.
- `not_applicable` — обработка неприменима (например, пропущенный звонок без аудио).

### Ingestion status (`record.ingestionStatus`, в основном для Mango)

- `ready` — аудио доступно.
- `pending_audio` — ждём `record/added`.
- `downloading` — идет скачивание из Mango.
- `no_audio` — у звонка нет записи.
- `failed` — ошибка на этапе ингестации.

## Endpoint'ы

### Публичные

- `GET /health`
- `POST /users/register`
- `POST /login`
- `POST /logout`

### Защищенные (cookie `auth`)

- `GET /users`
- `GET /users/:id`
- `GET /users/me`
- `PATCH /users/me/mango-user-id`
- `GET /users/mango/:mangoUserId`
- `POST /records/upload`
- `GET /records`
- `GET /records/feed`
- `GET /records/:id`
- `GET /records/by-mango-entry/:entryId`

### Webhook от Mango

- `POST /integrations/mango/events/summary`
- `POST /integrations/mango/events/record/added`

Webhook'и проверяются по подписи (`vpbx_api_key`, `sign`, `json`) и отвечают быстро `200 { ok: true }`, а обработка идет асинхронно.

## Важно про доступ к Mango records

- `GET /records` возвращает записи только текущего пользователя (`userId = auth user id`), поэтому Mango записи с `userId = null` туда не попадают.
- `GET /records/feed` возвращает единый фид: записи текущего пользователя (включая уже привязанные Mango) + Mango записи без владельца.
- `GET /records/:id` содержит ownership-check: `200` только для записей владельца, иначе `403`.
- `PATCH /users/me/mango-user-id` делает backfill: привязывает существующие `mango` записи с тем же `mangoUserId` к текущему пользователю.
- `GET /records/by-mango-entry/:entryId` можно использовать для прямого поиска Mango записи по `entry_id` (без ownership-check).

## Пример upload ответа

```json
{
  "id": 12,
  "userId": 1,
  "fileUri": "/absolute/path/to/uploads/1/1725000000000-call.mp3",
  "status": "queued",
  "message": "Record uploaded and queued for async processing"
}
```

## Переменные окружения

Обязательные для общей работы backend:
- `DATABASE_URL`
- `JWT_SECRET`
- `GROQ_API_KEY`
- `GROQ_BASE_URL`
- `GROQ_TRANSCRIPTION_MODEL`
- `MISTRAL_API_KEY`
- `MISTRAL_SUMMARY_MODEL`

Для Mango-интеграции:
- `MANGO_VPBX_API_KEY`
- `MANGO_VPBX_API_SALT`
- `MANGO_BASE_URL` (по умолчанию `https://app.mango-office.ru`)

Пустые Mango переменные не роняют сервер на старте, но webhook/API-операции Mango будут падать при вызове.
