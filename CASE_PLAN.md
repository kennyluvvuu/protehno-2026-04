# CASE PLAN — перенос текущей реализации под кейс Mango call storage service

## Цель документа

Этот документ нужен агенту как рабочий план по трансформации текущего проекта из user-centric сервиса загрузки аудио в автономный сервис хранения и обработки записей звонков для кейса из `CASE.md`.

Документ опирается на текущее состояние проекта и нужен для:
- понимания текущей архитектуры;
- оценки, что можно переиспользовать;
- понимания, что именно нужно переделать;
- определения MVP-границ;
- поэтапной реализации без расползания scope.

---

## 1. Что есть сейчас

Текущий проект уже содержит полезную основу:

### Backend
- Bun + Elysia
- PostgreSQL через Drizzle
- локальное файловое хранилище
- плагинную структуру
- сущность записей
- асинхронную AI-обработку после загрузки файла
- Docker-окружение

### Текущая бизнес-логика
Сейчас backend решает другой сценарий:
- пользователь регистрируется;
- логинится через cookie JWT;
- вручную загружает аудиофайл;
- backend сохраняет файл;
- backend асинхронно запускает AI-обработку;
- пользователь получает запись по внутреннему `id`.

### Важное наблюдение
Это **не соответствует целевому кейсу напрямую**, но даёт хороший фундамент:
- HTTP API уже есть;
- DB есть;
- storage abstraction есть;
- async pipeline mindset уже есть;
- AI как бонус уже присутствует.

---

## 2. Что требует кейс

Нужно получить **автономный сервис**, который:

- регулярно получает записи звонков из Mango Office;
- хранит аудиофайлы и метаданные в собственной системе;
- не создаёт дубли;
- ведёт журнал загрузок, ошибок и повторных попыток;
- предоставляет API для CRM и внутренних сервисов;
- использует служебную авторизацию по API key;
- поддерживает будущую AI-обработку;
- имеет административный дашборд;
- может работать даже с mock/demo provider, если боевой контур Mango недоступен.

---

## 3. Главный архитектурный разрыв

### Сейчас
Сервис построен как:
- upload API для пользователя;
- привязка записи к `userId`;
- доступ по внутреннему `record.id`;
- cookie auth;
- единый `status` для всей обработки.

### Нужно
Сервис должен стать:
- system-to-system integration service;
- источник записей — Mango или mock provider;
- ключевой идентификатор — `mangoCallId` / `sourceCallId`;
- API — по service API key;
- отдельные статусы импорта и AI-обработки;
- логирование в БД, а не только `console.log`.

---

## 4. Что можно переиспользовать

Следующие части проекта полезны и должны быть сохранены или адаптированы:

### 4.1 Серверный каркас
- `backend/src/index.ts`
- Elysia plugins
- health endpoint
- базовая DI-сборка сервисов

### 4.2 Работа с БД
- `backend/src/database/service.ts`
- Drizzle
- существующая структура сервисов для доступа к данным

### 4.3 Storage abstraction
- `backend/src/storage/interface.ts`
- `backend/src/storage/local.ts`

Для MVP можно оставить local storage.
Позже можно заменить на MinIO/S3 без слома API.

### 4.4 AI-обработка
- `backend/src/plugins/records/ai-service.ts`

AI — это бонус относительно кейса.
Нужно оставить как опциональный слой поверх архива.

### 4.5 Docker
- `docker-compose.yaml`
- `backend/Dockerfile`

---

## 5. Что нельзя оставлять как ядро решения

Следующие части нельзя считать core-архитектурой под кейс:

### 5.1 User-centric auth
- `/login`
- `/logout`
- `/users/*`
- cookie JWT как основная схема доступа к API

Это можно оставить временно, но только как вспомогательный контур.
Основной integration API должен использовать service API key.

### 5.2 Ручной upload как основной ingestion flow
- `POST /records/upload` не должен быть главным источником данных для кейса

Можно оставить как debug/demo endpoint, но не как основной сценарий.

### 5.3 Внутренний `id` как основной идентификатор
По кейсу основным идентификатором должен стать Mango call id / source call id.

---

## 6. Целевая архитектура MVP

Нужно перейти к модульной архитектуре вида:

- `sources/`
  - `interface.ts`
  - `mango-provider.ts`
  - `mock-provider.ts`

- `records/`
  - доменная модель записи звонка
  - хранение метаданных
  - доступ к записи по `sourceCallId`

- `imports/`
  - scheduler
  - запуск синхронизации
  - import jobs
  - retry logic
  - import attempts / logs

- `processing/`
  - AI processing pipeline
  - может быть отключаемым
  - не должен быть связан с импортом слишком жёстко

- `auth/`
  - service API key auth

- `admin/`
  - summary stats
  - health
  - dashboard API

---

## 7. Целевая модель данных MVP

Минимально нужно спроектировать такие сущности.

### 7.1 CallRecord
Основная запись звонка.

Поля минимум:
- `id` — внутренний numeric id
- `source` — например `mango`
- `sourceCallId` — внешний уникальный id звонка
- `direction` — входящий / исходящий, если доступно
- `callerNumber`
- `calleeNumber`
- `callStartedAt`
- `callEndedAt`
- `durationSec`
- `fileKey` — ключ файла в storage
- `fileMimeType`
- `fileSizeBytes`
- `checksum` — желательно
- `ingestionStatus`
- `processingStatus`
- `lastError`
- `createdAt`
- `updatedAt`

Важно:
- уникальный индекс по `(source, sourceCallId)`

### 7.2 ImportJob
Один запуск фоновой синхронизации.

Поля:
- `id`
- `source`
- `startedAt`
- `finishedAt`
- `status`
- `discoveredCount`
- `downloadedCount`
- `skippedCount`
- `failedCount`
- `error`

### 7.3 ImportAttempt
Попытка скачать/сохранить конкретную запись.

Поля:
- `id`
- `jobId`
- `source`
- `sourceCallId`
- `attemptNumber`
- `status`
- `error`
- `startedAt`
- `finishedAt`

### 7.4 ProcessingResult
Можно сделать отдельно или временно хранить внутри `CallRecord`.

Если отдельно:
- `recordId`
- `transcription`
- `summary`
- `tags`
- `checkboxes`
- `status`
- `error`

---

## 8. Статусы нужно разделить

Сейчас один `status` покрывает всё.
Для кейса нужно разделение минимум на два контура.

### 8.1 Ingestion status
Пример:
- `discovered`
- `downloading`
- `stored`
- `failed`
- `retry_scheduled`

### 8.2 Processing status
Пример:
- `not_started`
- `queued`
- `processing`
- `done`
- `failed`

Это критично для дашборда, логов и правильного API.

---

## 9. API, которое нужно получить в MVP

Минимальный service API:

### 9.1 Получить запись по внешнему ID
- `GET /api/calls/:sourceCallId`

Возвращает:
- метаданные звонка;
- статусы;
- наличие файла;
- наличие AI-результата.

### 9.2 Скачать аудио
- `GET /api/calls/:sourceCallId/audio`

Возвращает:
- stream файла
или
- redirect/signed URL, если storage потом будет внешним.

### 9.3 Получить статус записи
- `GET /api/calls/:sourceCallId/status`

Возвращает:
- ingestion status
- processing status
- last error

### 9.4 Получить AI-результат
- `GET /api/calls/:sourceCallId/processing`

Возвращает:
- transcript
- summary
- tags
- checkbox groups

### 9.5 Админские endpoint’ы
- `GET /admin/summary`
- `GET /admin/import-jobs`
- `GET /admin/import-attempts`
- `GET /admin/storage-stats`

---

## 10. Авторизация

### Основное требование кейса
API должен быть защищён по служебному ключу.

### Для MVP
Нужно реализовать middleware/plugin вида:
- чтение `X-API-Key`
- сравнение с `SERVICE_API_KEY` из env
- возврат `401/403` при ошибке

### Допустимое упрощение
Текущие user routes можно временно оставить, но:
- не использовать их как основной контур кейса;
- не строить вокруг них презентацию.

---

## 11. Интеграция с Mango Office

### Требование
Нужен модуль интеграции, даже если реальный контур недоступен.

### Что нужно сделать
Ввести abstraction:

- `CallSourceProvider`
  - `listCalls(sinceCursor)`
  - `downloadCallAudio(callId)`
  - `getCallMetadata(callId)` при необходимости

Реализации:
- `MockProvider` — обязательна для быстрого демо;
- `MangoProvider` — заготовка или реальная интеграция, если доступны доступы.

### Важно
Если нет доступа к реальному Mango:
- делаем честный mock provider;
- показываем архитектурную готовность к реальному подключению;
- не симулируем фейковое “боевое подключение”.

---

## 12. Scheduler и retry

Это одна из ключевых частей кейса.

### Нужно реализовать
- периодический запуск синхронизации;
- фиксацию job run в БД;
- обнаружение новых записей;
- пропуск дублей;
- повторную попытку для неуспешных загрузок.

### Для MVP достаточно
- простой interval scheduler внутри backend процесса;
- retry по ограниченному числу попыток;
- запись каждой попытки в БД.

### Важно
Даже если scheduler примитивный, он должен быть:
- обозримым;
- логируемым;
- демонстрируемым в dashboard/API.

---

## 13. Административный дашборд

Текущий `frontend` пустой.
Для кейса нужен хотя бы минимальный административный интерфейс.

### Минимум для MVP
Страница/панель с:
- общим количеством сохранённых записей;
- количеством успешных загрузок;
- количеством ошибок;
- последними импортами;
- последними ошибками;
- статусом фоновой задачи;
- базовой информацией о storage.

### Если времени мало
Можно сделать:
- backend admin endpoints;
- очень простой frontend;
- либо даже server-rendered/plain HTML dashboard.

Главное — не красивый UI, а наблюдаемость сервиса.

---

## 14. Безопасность и хранение

### Для MVP обязательно
- API key auth
- отсутствие утечки абсолютных путей в публичном API
- хранение файлов только в контролируемом storage
- конфигурация через env

### Желательно
- checksum файлов
- backup strategy description
- аргументация выбранного способа хранения
- описание дальнейшего шифрования at rest

### Можно пока не делать глубоко
- сложную RBAC-модель
- персонализированный доступ конечных пользователей
- юридически полное комплаенс-решение

---

## 15. Что делать с текущим модулем records

Не удалять сразу.
Нужно эволюционно разделить его ответственность.

### Сейчас records отвечает за
- upload
- хранение
- status
- AI processing

### Нужно получить
- `call-records` как архивный слой
- `imports` как ingestion layer
- `processing` как AI layer

### Практический совет
Не пытаться до бесконечности “вписать” кейс в текущую модель `userId + file upload`.
Проще:
- сохранить рабочие части;
- перевести модуль в новую доменную модель;
- оставить старые routes только временно или убрать из финального demo path.

---

## 16. Этапы реализации

## Этап 1. Стабилизация архитектуры
Цель:
- перестать мыслить запись как пользовательский upload.

Сделать:
- описать новую доменную модель;
- создать новые таблицы/миграции;
- добавить `source` и `sourceCallId`;
- спроектировать новые статусы.

Результат:
- БД готова под кейс.

---

## Этап 2. Service auth
Сделать:
- plugin/middleware по `X-API-Key`
- env-конфиг `SERVICE_API_KEY`

Результат:
- integration API можно вызывать как внутренний сервис.

---

## Этап 3. Source provider abstraction
Сделать:
- интерфейс источника;
- `MockProvider`;
- заготовку `MangoProvider`

Результат:
- backend может импортировать записи не только из upload.

---

## Этап 4. Import pipeline
Сделать:
- scheduler
- import jobs
- import attempts
- deduplication
- save metadata + save audio

Результат:
- сервис автономно подтягивает звонки.

---

## Этап 5. CRM API
Сделать:
- `GET /api/calls/:sourceCallId`
- `GET /api/calls/:sourceCallId/audio`
- `GET /api/calls/:sourceCallId/status`

Результат:
- кейс закрыт на уровне основного API.

---

## Этап 6. AI как бонус
Сделать:
- привязку AI processing к уже сохранённой записи;
- отдельный processing status;
- endpoint для выдачи результата.

Результат:
- усиление demo и презентации.

---

## Этап 7. Admin dashboard
Сделать:
- summary stats
- last jobs
- errors
- scheduler state

Результат:
- закрывается требование по наблюдаемости и администрированию.

---

## 17. Приоритеты для хакатонного MVP

### P0 — обязательно
- новая доменная модель записи
- внешний `sourceCallId`
- deduplication
- service API key auth
- mock/mango source module
- scheduler
- import log / attempts
- API получения записи и аудио
- минимальный dashboard или admin API

### P1 — очень желательно
- retry logic
- storage stats
- понятные import statuses
- отдельный processing status
- demo-flow end-to-end

### P2 — бонус
- AI transcription/summary
- tags / checkboxes
- MinIO/S3
- шифрование файлов
- резервное копирование

---

## 18. Что НЕ делать в первую очередь

Чтобы не потерять время, не нужно в начале:
- улучшать user registration/login;
- строить полноценный user-facing frontend;
- углубляться в сложный RBAC;
- делать красивую визуализацию раньше рабочего ingestion flow;
- пытаться сделать production-grade distributed queue.

---

## 19. Definition of Done для MVP

MVP считается готовым, если:

1. Сервис умеет по расписанию получать список звонков из mock/Mango provider.
2. Сервис сохраняет метаданные и аудиофайлы в собственное хранилище.
3. При повторном импорте дубли не создаются.
4. У каждой загрузки есть журнал операций и ошибок.
5. По `sourceCallId` можно:
   - получить метаданные,
   - получить статус,
   - скачать аудио.
6. API защищено service API key.
7. Есть минимальный admin dashboard или admin API.
8. AI-обработка, если включена, не ломает основной ingestion flow.

---

## 20. Рекомендация агенту по стилю работы

Работать не “поверх старой логики”, а через controlled refactor:

1. Сначала выделить новый доменный центр — `CallRecord`.
2. Затем добавить import pipeline.
3. Потом поднять новый integration API.
4. Потом подключить AI как secondary layer.
5. Потом дашборд.

Если нужно выбирать между:
- красивым UI
- и правильной сервисной архитектурой

приоритет у архитектуры и демонстрируемого end-to-end flow.

---

## 21. Короткий итог

Текущий проект — это хорошая техническая заготовка, но не готовое решение под кейс.

Самый важный принцип переноса:
**не адаптировать кейс под существующий upload-сервис, а переориентировать существующий проект в автономный call-storage service, сохранив полезные слои: backend, storage, DB, async processing и AI как бонус.**
