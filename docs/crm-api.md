# CRM / Service API

Документ описывает, как использовать backend проекта как server-to-server API для CRM, витрин и внутренних сервисов.

## Зачем нужен service API

Frontend приложения работают через cookie-based auth. Для CRM и внутренних интеграций это неудобно, поэтому backend поддерживает отдельный режим авторизации через `x-api-key`.

Этот режим подходит для:

- CRM embedding
- ETL / BI-процессов
- административных задач
- внешних интеграционных сервисов
- внутренних отчетных витрин

## Авторизация

Для доступа к защищенным endpoint'ам передавайте заголовок:

```http
x-api-key: <SERVICE_API_KEY>
```

Значение ключа должно совпадать с `SERVICE_API_KEY` из backend environment.

### Как backend трактует такой доступ

При корректном ключе backend выполняет запрос в сервисном контексте пользователя с ролью `director`.

Практически это означает:

- доступны директорские read endpoint'ы
- доступны административные endpoint'ы для Mango integration
- не нужно проходить пользовательский login flow

## Рекомендуемые сценарии CRM

### 1. Получение общего списка звонков

Endpoint:

`GET /records/admin-feed`

Подходит для:

- ленты звонков в CRM
- контрольной панели супервайзера
- экспорта списка разговоров

Пример:

```bash
curl \
  -H "x-api-key: your-service-api-key" \
  http://localhost:3000/records/admin-feed
```

### 2. Получение конкретного звонка

Endpoint:

`GET /records/:id`

Подходит для:

- карточки звонка в CRM
- drill-down из списка
- детального аудита одного разговора

Пример:

```bash
curl \
  -H "x-api-key: your-service-api-key" \
  http://localhost:3000/records/123
```

### 3. Поиск по Mango entry id

Endpoint:

`GET /records/by-mango-entry/:entryId`

Подходит для:

- обратного связывания CRM-сущностей с Mango call
- reconciliation внешних логов
- поиска локальной записи по Mango identifier

Пример:

```bash
curl \
  -H "x-api-key: your-service-api-key" \
  "http://localhost:3000/records/by-mango-entry/abc123"
```

### 4. Скачивание аудио

Endpoint:

`GET /records/:id/download`

Подходит для:

- воспроизведения или скачивания записи из CRM
- прикрепления аудио к внутренним workflow

Пример:

```bash
curl \
  -H "x-api-key: your-service-api-key" \
  -o record-123.mp3 \
  http://localhost:3000/records/123/download
```

### 5. Получение глобальной статистики

Endpoint:

`GET /stats/global`

Подходит для:

- управленческой панели
- KPI-дашборда
- мониторинга качества обработки звонков

Пример по периоду:

```bash
curl \
  -H "x-api-key: your-service-api-key" \
  "http://localhost:3000/stats/global?period=30d"
```

Пример по произвольному диапазону:

```bash
curl \
  -H "x-api-key: your-service-api-key" \
  "http://localhost:3000/stats/global?startDate=2026-01-01T00:00:00.000Z&endDate=2026-02-01T00:00:00.000Z"
```

### 6. Получение дашборда конкретного менеджера

Endpoint:

`GET /stats/agent/:userId/dashboard`

Подходит для:

- персональной KPI-страницы менеджера
- оценки качества и объема звонков
- supervisor workflow внутри CRM

Пример:

```bash
curl \
  -H "x-api-key: your-service-api-key" \
  "http://localhost:3000/stats/agent/42/dashboard?period=14d"
```

### 7. Получение списка пользователей

Endpoint:

`GET /users`

Подходит для:

- загрузки справочника менеджеров
- построения mapping таблиц внутри CRM

Пример:

```bash
curl \
  -H "x-api-key: your-service-api-key" \
  http://localhost:3000/users
```

### 8. Поиск пользователя по Mango ID

Endpoint:

`GET /users/mango/:mangoUserId`

Подходит для:

- связывания Mango employee с локальным пользователем CRM
- ownership lookup

Пример:

```bash
curl \
  -H "x-api-key: your-service-api-key" \
  http://localhost:3000/users/mango/12345
```

## Mango administration из CRM

Если CRM должна не только читать данные, но и запускать интеграционные процессы, используйте следующие endpoint'ы.

### Обновить справочник пользователей Mango

`POST /integrations/mango/sync/users/refresh`

```bash
curl \
  -X POST \
  -H "x-api-key: your-service-api-key" \
  http://localhost:3000/integrations/mango/sync/users/refresh
```

### Получить кандидатов на mapping

`GET /integrations/mango/users/candidates`

```bash
curl \
  -H "x-api-key: your-service-api-key" \
  http://localhost:3000/integrations/mango/users/candidates
```

### Привязать Mango user к локальному пользователю

`PATCH /integrations/mango/users/:mangoUserId/link`

```bash
curl \
  -X PATCH \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-service-api-key" \
  -d '{"userId":42}' \
  http://localhost:3000/integrations/mango/users/12345/link
```

### Отвязать Mango user

```bash
curl \
  -X PATCH \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-service-api-key" \
  -d '{"userId":null}' \
  http://localhost:3000/integrations/mango/users/12345/link
```

### Запустить историческую синхронизацию звонков

`POST /integrations/mango/sync`

```bash
curl \
  -X POST \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-service-api-key" \
  -d '{
    "startDate":"01.01.2026 00:00:00",
    "endDate":"31.01.2026 23:59:59",
    "limit":500,
    "offset":0,
    "maxPages":50,
    "downloadRecordings":true
  }' \
  http://localhost:3000/integrations/mango/sync
```

## Рекомендуемая модель встраивания в CRM

### Read layer

CRM читает:

- `records/admin-feed`
- `records/:id`
- `records/by-mango-entry/:entryId`
- `stats/global`
- `stats/agent/:userId/dashboard`
- `users`

### Integration admin layer

CRM или внутренний integration service управляет:

- refresh Mango users
- user mapping
- historical sync

### Playback layer

CRM строит кнопку “прослушать запись” через:

- `GET /records/:id/download`

## Что полезно сохранять у себя в CRM

Рекомендуется кешировать или связывать:

- `record.id`
- `mangoEntryId`
- `mangoRecordingId`
- `userId`
- `mangoUserId`
- `directionKind`
- `status`
- `ingestionStatus`
- `qualityScore`
- `callStartedAt`

Это покрывает большинство сценариев reconciliation и аналитики.

## Ошибки и ответы

Типовые ошибки:

```json
{ "message": "Unauthorized" }
```

```json
{ "message": "Forbidden" }
```

```json
{ "message": "Record not found" }
```

```json
{ "message": "User not found" }
```

```json
{ "message": "Invalid record id" }
```

Для CRM достаточно ориентироваться на HTTP status и поле `message`.

## Ограничения и ожидания

- AI processing асинхронный, поэтому после создания/синхронизации запись может быть еще не готова
- не у каждого звонка есть аудио
- часть Mango-звонков может сначала прийти без локального владельца, а затем быть назначена после mapping
- service API лучше считать trusted internal API, а не публичным internet-facing API

## Практические рекомендации

- храните `SERVICE_API_KEY` только на серверной стороне CRM
- не используйте `x-api-key` из браузерного кода
- для массового импорта вызывайте sync отдельным backend job
- для UI-дашбордов кешируйте агрегаты `stats/global`
- для карточек звонков используйте `record.id` как внутренний ключ и `mangoEntryId` как интеграционный

## Связанные документы

- [корневой README](/Users/kenny/Learn/js-ts/jwtusers/README.md)
- [Mango integration doc](/Users/kenny/Learn/js-ts/jwtusers/docs/integrations/mango.md)
- [Mango knowledge file](/Users/kenny/Learn/js-ts/jwtusers/mango_office_calls_agent_knowledge.md)
