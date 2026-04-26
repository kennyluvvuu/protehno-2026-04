# Mango Office Integration

Документ описывает, как проект интегрируется с Mango Office VPBX, какие endpoint'ы уже используются и как устроены realtime и batch-сценарии.

## Назначение интеграции

Интеграция с Mango Office в проекте решает четыре задачи:

- принимать события о звонках в realtime
- синхронизировать исторические звонки пакетно
- скачивать записи разговоров
- связывать сотрудников Mango с локальными пользователями платформы

Результат интеграции — не сырой webhook-лог, а нормализованные `record`-объекты, пригодные для UI, аналитики и CRM.

## Ключевые идентификаторы

Проект опирается на модель Mango Office, описанную в `mango_office_calls_agent_knowledge.md`.

Главные идентификаторы:

- `entry_id` — основной идентификатор звонка
- `call_id` — идентификатор плеча вызова
- `recording_id` — идентификатор записи разговора
- `communication_id` — идентификатор для speech-related сценариев
- `user_id` — Mango user, потенциальный владелец звонка

В текущей реализации главным ключом связности является `entry_id`.

## Что уже реализовано

### Realtime webhook endpoint'ы

Backend принимает следующие webhook'и:

- `POST /integrations/mango/events/summary`
- `POST /integrations/mango/events/record/added`
- `POST /integrations/mango/events/call`
- `POST /integrations/mango/events/recording`
- `POST /integrations/mango/events/record/tagged`
- `POST /integrations/mango/events/dtmf`
- `POST /integrations/mango/events/sms`
- `POST /integrations/mango/events/recognized/offline`

### Что реально участвует в продуктовой логике

Критические события:

- `summary` — финальные метаданные звонка
- `record/added` — сигнал, что запись доступна для скачивания
- `call` — предварительная realtime-сборка звонка до финального summary
- `recording` — tracking lifecycle записи

Notification-only события в текущей версии:

- `record/tagged`
- `dtmf`
- `sms`
- `recognized/offline`

## Подпись webhook'ов

Mango присылает form-encoded тело:

- `vpbx_api_key`
- `sign`
- `json`

Backend:

- проверяет, что `vpbx_api_key` совпадает с `MANGO_VPBX_API_KEY`
- пересчитывает подпись
- валидирует `json` по Zod schema
- отвечает сразу, а обработку запускает асинхронно

Это снижает риск повторных доставок из-за долгой обработки.

## Realtime flow

### 1. Финальное событие звонка

`POST /integrations/mango/events/summary`

Что происходит:

- создается или обновляется `record`
- определяется направление звонка
- вычисляются временные метки звонка
- определяется пропущенный звонок или нет
- сохраняются номера и базовые telephony-метаданные

Если звонок пропущен:

- `isMissed=true`
- `ingestionStatus=no_audio`
- `status=not_applicable`

### 2. Появление записи разговора

`POST /integrations/mango/events/record/added`

Что происходит:

- по `entry_id` находится соответствующий `record`
- если запись еще не существует, создается минимальный record
- `ingestionStatus` переводится в `downloading`
- при наличии `user_id` backend пытается найти локального пользователя по `mangoUserId`
- если пользователь найден, запись сразу назначается владельцу
- backend скачивает аудио из Mango
- запись сохраняется в storage
- `record` получает `mangoRecordingId`, `fileUri`, `hasAudio=true`
- `status` переводится в `queued`
- в фоне запускается AI pipeline

### 3. Предварительные realtime-события

`POST /integrations/mango/events/call`

Используется для:

- раннего появления звонка в системе
- частичного заполнения направления, номеров и `call_id`
- подготовки базы до прихода `summary`

### 4. События по записи

`POST /integrations/mango/events/recording`

Используется для:

- фиксации `recording_state`
- частичного поддержания связности `entry_id` / `call_id`

## Batch sync

### Назначение

Realtime ingestion не решает задачу исторической миграции и перепроверки. Для этого используется batch sync.

### Endpoint

`POST /integrations/mango/sync`

Тело запроса:

```json
{
  "startDate": "01.01.2026 00:00:00",
  "endDate": "31.01.2026 23:59:59",
  "limit": 500,
  "offset": 0,
  "maxPages": 50,
  "pollIntervalMs": 3000,
  "maxAttempts": 30,
  "downloadRecordings": true
}
```

### Что делает backend

1. Запрашивает у Mango отчет через `/vpbx/stats/calls/request`.
2. Polling'ом получает результат через `/vpbx/stats/calls/result`.
3. Нормализует список звонков.
4. Определяет возможного владельца звонка.
5. Делает upsert звонков в локальную БД.
6. Если есть `recording_id` и разрешено `downloadRecordings`, скачивает аудио.
7. Запускает AI pipeline для новых аудиозаписей.

### Что возвращает sync

Пример ответа:

```json
{
  "startDate": "01.01.2026 00:00:00",
  "endDate": "31.01.2026 23:59:59",
  "fetched": 1240,
  "created": 830,
  "updated": 410,
  "downloaded": 792,
  "failedDownloads": 12,
  "skippedNoAudio": 186
}
```

## Импорт и mapping пользователей Mango

### Обновление справочника Mango users

Endpoint:

`POST /integrations/mango/sync/users/refresh`

Назначение:

- перечитать справочник сотрудников Mango
- обновить локальный integration cache

### Получение кандидатов на привязку

Endpoint:

`GET /integrations/mango/users/candidates`

Возвращает:

- Mango user directory
- текущую привязку к локальному пользователю
- топ кандидатов на сопоставление
- готовый draft для локального создания пользователя

### Ручная привязка

Endpoint:

`PATCH /integrations/mango/users/:mangoUserId/link`

Пример привязки:

```json
{
  "userId": 42
}
```

Пример отвязки:

```json
{
  "userId": null
}
```

После привязки backend может автоматически назначить владельца уже существующим непривязанным Mango звонкам.

## Создание локального пользователя из Mango

Endpoint:

`POST /users/mango/create-local-user`

Используется директором для сценария:

- Mango user найден в справочнике
- локального пользователя еще нет
- нужно быстро создать локального менеджера и привязать к нему звонки

Пример тела:

```json
{
  "name": "operator01",
  "fio": "Иванов Иван",
  "email": "operator01@example.com",
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
  "mangoSips": ["101"]
}
```

## Ownership resolution

При batch sync проект пытается определить владельца звонка по нескольким признакам:

- exact match по `mangoUserId`
- `call_abonent_id`
- `caller_id`
- extension
- login
- SIP hints
- истории ранее связанных записей

Это снижает объем ручной работы директора при миграции и первичном запуске.

## Что получает остальная система после Mango ingestion

После обработки данные становятся доступны:

- manager UI
- director UI
- stats endpoint'ам
- CRM/service API через `x-api-key`

То есть Mango integration работает как нормализующий ingestion layer для всего продукта.

## Что пока не подключено как продуктовый источник

В knowledge-модели Mango есть дополнительные endpoint'ы, которые могут быть подключены следующим этапом:

- `recording_categories`
- `recording_transcripts`
- `recording_summary`
- `/s2t/queries/records`
- offline recognize pipeline
- команды управления звонками

Текущая реализация уже закрывает основной контур:

- события звонков
- статистический sync
- скачивание аудио
- ownership mapping
- AI enrichment

## Рекомендуемый порядок запуска интеграции

1. Настроить `MANGO_VPBX_API_KEY` и `MANGO_VPBX_API_SALT`.
2. Поднять backend с доступным публичным webhook URL.
3. Настроить webhook endpoint'ы в Mango Office.
4. Выполнить `POST /integrations/mango/sync/users/refresh`.
5. Проверить `GET /integrations/mango/users/candidates`.
6. Привязать известных сотрудников.
7. Запустить первичный `POST /integrations/mango/sync`.
8. Проверить глобальный feed и аналитику.

## Полезные ссылки внутри проекта

- [README](/Users/kenny/Learn/js-ts/jwtusers/README.md)
- [knowledge file](/Users/kenny/Learn/js-ts/jwtusers/mango_office_calls_agent_knowledge.md)
- [backend webhook plugin](/Users/kenny/Learn/js-ts/jwtusers/backend/src/plugins/mango/webhook.ts)
- [backend sync plugin](/Users/kenny/Learn/js-ts/jwtusers/backend/src/plugins/mango/sync.ts)
- [backend ingestion service](/Users/kenny/Learn/js-ts/jwtusers/backend/src/plugins/mango/service.ts)
