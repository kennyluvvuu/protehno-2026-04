# Connectio

Платформа для загрузки, синхронизации, обработки и аналитики звонков с приоритетом на интеграцию с Mango Office VPBX, AI-обогащение разговоров и встраивание данных в CRM.
сейчас в проде) https://apogey.duckdns.org
Проект состоит из трех приложений:

- `backend` — API, ingestion, AI pipeline, статистика, интеграции
- `frontend-manager` — интерфейс менеджера
- `frontend-director` — интерфейс руководителя

## Что умеет система

- принимать ручные загрузки аудиозаписей звонков
- принимать realtime webhook-события Mango Office
- выполнять batch-синхронизацию исторических звонков из Mango Office
- скачивать записи разговоров из Mango и запускать их AI-обработку
- хранить звонки в единой нормализованной модели `record`
- извлекать из разговоров:
  - транскрипт
  - summary
  - теги
  - задачи
  - обещания
  - договоренности
  - `qualityScore`
- строить глобальную и персональную аналитику по звонкам
- связывать Mango-пользователей с локальными пользователями платформы
- отдавать данные не только UI, но и внешним системам через service API с `x-api-key`

## Основной сценарий использования

Система выступает как промежуточный слой между телефонией Mango Office, внутренними пользователями и CRM:

1. Mango Office присылает события о звонках.
2. Backend нормализует их в единый объект `record`.
3. При появлении записи разговора backend скачивает аудио и запускает AI pipeline.
4. Руководитель получает аналитику, поиск, фильтрацию и маппинг сотрудников.
5. Менеджер работает со своим потоком звонков, summary и задачами.
6. CRM или другие внутренние сервисы могут забирать данные через защищенные endpoint'ы с `x-api-key`.

## Архитектура

### Backend

Стек:

- Bun
- Elysia
- PostgreSQL
- Drizzle ORM
- Zod
- Groq-compatible transcription API
- Mistral для суммаризации и структурирования результата

Ключевые backend-модули:

- `auth` — логин, logout, cookie-auth
- `guard` — авторизация через cookie или `x-api-key`
- `users` — пользователи, роли, Mango binding
- `records` — единая модель звонков и AI processing
- `stats` — дашборды и агрегаты для руководителя
- `mango webhook` — realtime ingestion событий Mango
- `mango sync` — импорт пользователей Mango и исторических звонков

### Frontend Manager

Интерфейс менеджера для:

- просмотра личных звонков
- ручной загрузки аудио
- просмотра summary и транскриптов
- работы со списком задач/обещаний/договоренностей
- просмотра собственного профиля и привязки Mango ID

### Frontend Director

Интерфейс руководителя для:

- глобального списка звонков
- операционной и качественной аналитики
- аналитики по отдельным менеджерам
- управления пользователями
- глобального поиска
- импорта пользователей Mango
- ручного запуска синхронизации звонков Mango
- привязки Mango users к локальным пользователям

## Роли и доступ

В системе две роли:

- `manager`
- `director`

### Manager

Может:

- просматривать свой профиль
- привязывать свой `mangoUserId`
- загружать записи вручную
- видеть свой поток звонков
- видеть задачи, обещания и договоренности по своим звонкам

### Director

Может:

- видеть всех пользователей
- создавать и редактировать пользователей
- сбрасывать пароли
- удалять пользователей
- видеть глобальный поток звонков
- видеть агрегированную статистику
- управлять Mango mapping и синхронизацией

## Авторизация

Поддерживаются два режима авторизации.

### 1. Пользовательская авторизация

Используется frontend-приложениями:

- `POST /login`
- `POST /logout`
- cookie `auth` с JWT

Frontend работает через `withCredentials: true`.

### 2. Service API для CRM и внутренних интеграций

Backend поддерживает служебную авторизацию через заголовок:

```http
x-api-key: <SERVICE_API_KEY>
```

Если передан корректный `x-api-key`, backend исполняет запрос в сервисном контексте директора. Это нужно для:

- CRM embedding
- server-to-server интеграций
- административных синхронизаций
- внешних дашбордов и витрин

Это особенно важно для интеграций, которым неудобно работать через cookie-based auth.

## Интеграция с Mango Office

Mango Office — центральный интеграционный контур проекта.

Подробная документация:

- [Mango integration guide](/Users/kenny/Learn/js-ts/jwtusers/docs/integrations/mango.md)
- [CRM / Service API guide](/Users/kenny/Learn/js-ts/jwtusers/docs/crm-api.md)

### Что уже реализовано

Realtime webhook ingestion:

- `POST /integrations/mango/events/summary`
- `POST /integrations/mango/events/record/added`
- `POST /integrations/mango/events/call`
- `POST /integrations/mango/events/recording`
- `POST /integrations/mango/events/record/tagged`
- `POST /integrations/mango/events/dtmf`
- `POST /integrations/mango/events/sms`
- `POST /integrations/mango/events/recognized/offline`

Batch-синхронизация:

- импорт справочника пользователей Mango
- построение кандидатов на маппинг
- привязка Mango user -> local user
- синхронизация исторических звонков через stats API Mango
- догрузка записей и запуск AI pipeline

### Как система использует модель Mango Office

Проект опирается на ключевые идентификаторы Mango:

- `entry_id` — основной идентификатор звонка в системе
- `call_id` — идентификатор отдельного call leg
- `recording_id` — идентификатор аудиозаписи
- `communication_id` — задел под speech/summary сценарии Mango
- `user_id` — идентификатор сотрудника Mango

`entry_id` используется как главный идентификатор для upsert-логики и связывания событий между собой.

### Realtime workflow

1. Mango присылает `/events/summary`.
2. Backend создает или обновляет `record` со всеми базовыми метаданными звонка.
3. Если звонок пропущен и записи нет, звонок фиксируется как валидная сущность без AI-обработки.
4. Когда Mango присылает `/events/record/added`, backend скачивает запись разговора.
5. Аудио прикрепляется к `record`.
6. Запускается AI processing в фоне.

### Batch workflow

Руководитель или внешняя интеграция может вручную запускать синхронизацию диапазона дат:

- backend запрашивает `calls/request`
- затем polling'ом получает `calls/result`
- нормализует звонки
- пытается определить владельца звонка
- при наличии записи скачивает аудио
- запускает тот же AI pipeline, что и для realtime ingestion

### Связывание Mango с локальными пользователями

Для назначения владельца звонка проект использует:

- прямое совпадение по `mangoUserId`
- extension hints
- login hints
- sip hints
- историю уже связанных записей

Это позволяет:

- автоматически разбирать часть соответствий
- показывать директору кандидатов на привязку
- дозаполнять владельцев задним числом

## AI pipeline

После появления аудио система запускает асинхронную обработку.

### Что делает AI

- распознает разговор
- строит summary на русском языке
- извлекает теги
- выделяет:
  - `tasks`
  - `promises`
  - `agreements`
- оценивает качество звонка в `qualityScore`

### Модель запуска

Обработка не блокирует API-ответ:

- запись создается сразу
- статус переводится в `queued`
- AI выполняется в фоне
- frontend или внешняя система могут опрашивать объект записи по `id`

## Единая модель звонка

В проекте звонок хранится как единая сущность `record`, независимо от того, пришел он:

- вручную через upload
- автоматически через Mango Office

Основные поля:

- `id`
- `userId`
- `source`
- `callTo`
- `title`
- `durationSec`
- `qualityScore`
- `fileUri`
- `transcription`
- `summary`
- `status`
- `error`
- `checkboxes`
- `tags`

Mango-специфичные поля:

- `mangoEntryId`
- `mangoCallId`
- `mangoRecordingId`
- `mangoCommunicationId`
- `mangoUserId`
- `direction`
- `directionKind`
- `callerNumber`
- `calleeNumber`
- `lineNumber`
- `extension`
- `callStartedAt`
- `callAnsweredAt`
- `callEndedAt`
- `talkDurationSec`
- `isMissed`
- `hasAudio`
- `ingestionStatus`
- `ingestionError`

## Статусы

### AI processing status

- `uploaded` — запись создана
- `queued` — поставлена в очередь
- `processing` — идет AI processing
- `done` — успешно обработана
- `failed` — ошибка AI processing
- `not_applicable` — обработка неприменима, например нет аудио для пропущенного звонка

### Ingestion status

- `ready`
- `pending_audio`
- `downloading`
- `no_audio`
- `failed`

Эти статусы особенно важны для мониторинга Mango integration и для CRM/операционных витрин.

## Интерфейсы

### Manager UI

Основные разделы:

- Dashboard
- Calls
- Upload
- Tasks
- Settings

Что видит менеджер:

- только свои записи
- свои активные задачи
- summary и транскрипты своих звонков
- статус AI-обработки

### Director UI

Основные разделы:

- Dashboard
- Calls
- Search
- Users
- Mango
- Settings

Что видит руководитель:

- весь поток звонков
- аналитику по источникам, направлениям, статусам и менеджерам
- привязанные и непривязанные Mango звонки
- кандидатов для маппинга Mango users
- персональные карточки менеджеров с трендами и KPI

## Основные API-сценарии

### Публичные endpoint'ы

- `GET /health`
- `POST /users/register`
- `POST /login`
- `POST /logout`

`POST /users/register` всегда создает пользователя с ролью `manager`.

### Пользовательские endpoint'ы

- `GET /users/me`
- `PATCH /users/me/mango-user-id`
- `POST /records/upload`
- `GET /records`
- `GET /records/feed`
- `GET /records/:id`
- `GET /records/:id/download`
- `PATCH /records/:id/checkboxes`

### Director endpoint'ы

- `GET /users`
- `GET /users/:id`
- `PATCH /users/:id`
- `DELETE /users/:id`
- `PATCH /users/:id/reset-password`
- `POST /users/mango/create-local-user`
- `GET /records/admin-feed`
- `GET /stats/global`
- `GET /stats/overview`
- `GET /stats/weekly`
- `GET /stats/by-agent`
- `GET /stats/agent/:userId/dashboard`

### Mango integration endpoint'ы

- `GET /integrations/mango/users/candidates`
- `PATCH /integrations/mango/users/:mangoUserId/link`
- `POST /integrations/mango/sync`
- `POST /integrations/mango/sync/users/refresh`

## Встраивание в CRM

Проект удобно использовать как интеграционный слой между CRM и Mango Office.

### Что CRM может получать

- нормализованный поток звонков
- статусы обработки
- summary и транскрипты
- связь звонка с локальным менеджером
- связь звонка с Mango user
- признаки пропущенных и необработанных звонков
- агрегаты по качеству и активности

### Почему это полезно

CRM не нужно:

- разбирать сырые Mango webhook payload'ы
- самостоятельно скачивать записи
- самостоятельно поддерживать подпись Mango API
- вручную собирать pipeline из realtime + batch + AI

Backend уже делает это и отдает готовую нормализованную модель.

### Рекомендуемый режим интеграции

Для CRM лучше использовать:

- `x-api-key`
- директорские read endpoint'ы
- endpoint'ы Mango sync/mapping при административной интеграции

Пример запроса:

```bash
curl -H "x-api-key: your-service-api-key" \
  http://localhost:3000/stats/global?period=30d
```

## Запуск локально

### Требования

- Bun
- PostgreSQL
- переменные окружения для backend и frontend

### Backend

```bash
cd backend
bun install
bun run db:push
bun run dev
```

Backend поднимается на:

```text
http://localhost:3000
```

### Frontend Manager

```bash
cd frontend-manager
bun install
bun run dev
```

### Frontend Director

```bash
cd frontend-director
bun install
bun run dev
```

## Запуск через Docker Compose

В репозитории есть:

- `docker-compose.yaml`
- `docker-compose.prod.yaml`

Compose поднимает:

- `caddy`
- `postgres`
- `backend`
- `frontend-manager`
- `frontend-director`
- `minio`

Базовый запуск:

```bash
docker compose up --build
```

## Основные переменные окружения

### Backend

- `DATABASE_URL`
- `JWT_SECRET`
- `SERVICE_API_KEY`
- `GROQ_API_KEY`
- `GROQ_BASE_URL`
- `GROQ_TRANSCRIPTION_MODEL`
- `MISTRAL_API_KEY`
- `MISTRAL_SUMMARY_MODEL`
- `MANGO_VPBX_API_KEY`
- `MANGO_VPBX_API_SALT`
- `MANGO_BASE_URL`
- `STORAGE_DRIVER`
- `S3_ENDPOINT`
- `S3_REGION`
- `S3_BUCKET`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- `S3_FORCE_PATH_STYLE`
- `S3_PUBLIC_BASE_URL`

### Frontends

- `VITE_TIMEOUT`
- `VITE_BASE_URL`
- `VITE_MANGO_SYNC_TIMEOUT`

Фронтенды работают через `/api`, поэтому в production обычно ставятся за reverse proxy.

## Первичный доступ

Если таблица `users` пуста, backend автоматически создает seed-пользователя:

- email: `director@example.com`
- password: `director123`
- role: `director`

После первого входа этот доступ лучше сразу заменить на рабочий.

## Особенности реализации

- backend принимает как пользовательские cookie-запросы, так и service-to-service запросы
- Mango webhook'и валидируются по подписи
- AI processing выполняется в фоне
- пропущенные звонки сохраняются как полноценные записи без принудительной AI-обработки
- при появлении корректной привязки `mangoUserId` backend может доназначить владельца уже существующим непривязанным Mango звонкам
- справочник Mango users можно обновлять отдельно от синхронизации звонков

## Ограничения текущей версии

На текущем этапе система уже закрывает ingestion, mapping, AI enrichment и статистику, но часть возможностей Mango knowledge-модели остается за пределами текущей реализации:

- не весь speech analytics контур Mango подключен как источник готовых summary/transcripts
- offline recognize pipeline пока не встроен в прикладной flow
- команды управления звонком пока не используются как часть продукта

Это не мешает основному сценарию: выгрузке, нормализации, AI-обогащению и аналитике звонков.

## Для кого этот проект

Проект особенно полезен, если вам нужно:

- собирать звонки из Mango Office в собственной системе
- быстро подключить AI-анализ разговоров
- дать менеджерам и руководителям разные интерфейсы
- встроить данные о звонках в CRM
- поддерживать одновременно realtime ingestion и retrospective sync

## Структура репозитория

```text
.
├── backend
├── frontend-manager
├── frontend-director
├── docker-compose.yaml
├── docker-compose.prod.yaml
└── mango_office_calls_agent_knowledge.md
```

## Статус проекта

Проект уже реализует рабочий сквозной контур:

- ingest звонков
- загрузка и обработка аудио
- AI enrichment
- аналитика
- Mango user mapping
- сервисный API для CRM и внутренних систем

Следующий логичный этап развития — дальнейшее углубление speech analytics и расширение интеграционных сценариев вокруг Mango Office.
