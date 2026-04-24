# Backend API для фронтенда

Этот `backend` — HTTP API для приложения с пользователями и аудиозаписями звонков.

Документация разделена на 2 части:

1. **Для человека** — коротко и понятно, как фронтенду работать с API.
2. **Для AI-агентов** — структурированное описание контрактов endpoint'ов и правил интеграции.

Главная цель этого README: помочь фронтенд-разработчику быстро подключиться к API и правильно обработать сценарий с асинхронной обработкой аудио.

---

# 1. Для человека

## Что делает backend

Сейчас backend умеет:

- регистрировать пользователей;
- логинить пользователей и выдавать JWT;
- отдавать список пользователей;
- отдавать пользователя по `id`;
- принимать аудиозаписи;
- запускать AI-обработку записи в фоне;
- отдавать список записей текущего пользователя;
- отдавать одну запись по `id`;
- сообщать статус обработки записи.

Если говорить совсем коротко: фронтенд загружает аудио, backend сразу отвечает, а AI-результаты появляются позже. Поэтому после загрузки файла фронтенду нужно **опрашивать запись по `id`**, пока обработка не завершится.

---

## Базовый URL

Локально backend запускается по адресу:

`http://localhost:3000`

---

## Самый важный сценарий для фронтенда

Обычный flow работы такой:

1. Зарегистрировать пользователя через `POST /users/register`
2. Выполнить логин через `POST /login`
3. Получить от backend `httpOnly` cookie авторизации
4. Для защищённых endpoint'ов отправлять запросы с cookie, а не с Bearer token
5. Если фронтенд и backend на разных origin, включать отправку credentials
6. Загрузить аудио через `POST /records/upload`
7. Взять `id` записи из ответа
8. Периодически вызывать `GET /records/:id`
9. Остановить polling, когда статус станет `done` или `failed`

---

## Авторизация

После логина backend выставляет `httpOnly` cookie `auth`.

JWT действительно используется внутри backend, но для фронтенда контракт такой: токен живёт в cookie и не читается из JavaScript.

Для защищённых запросов фронтенд не должен отправлять `Authorization: Bearer ...`.

```/dev/null/http.txt#L1-3
fetch("http://localhost:3000/records", {
  credentials: "include"
})
```

Практически это значит, что во фронтенде лучше сделать единый API client, который автоматически включает отправку cookie в защищённых запросах.

Если фронтенд использует `fetch`, нужен `credentials: "include"` для cross-origin запросов.
Если используется `axios`, нужен `withCredentials: true`.

---

## Как работает загрузка записей

### Общая логика

Сценарий загрузки записи асинхронный:

1. фронтенд отправляет аудиофайл;
2. backend сохраняет запись;
3. backend запускает распознавание и суммаризацию в фоне;
4. backend сразу возвращает ответ клиенту;
5. фронтенд опрашивает `GET /records/:id`, чтобы узнать, закончилась ли обработка.

### Статусы записи

Используются следующие статусы:

- `uploaded` — файл загружен;
- `processing` — AI-обработка идёт;
- `done` — AI-обработка успешно завершена;
- `failed` — AI-обработка завершилась ошибкой.

Для UI удобно мыслить так:

- `uploaded` / `processing` → показывать состояние ожидания;
- `done` → показывать результат;
- `failed` → показывать ошибку.

---

## Какие данные появятся после AI-обработки

После успешной обработки во фронтенде можно использовать:

- `transcription` — текст расшифровки;
- `summary` — краткую выжимку разговора;
- `tags` — теги;
- `checkboxes.tasks` — список задач;
- `checkboxes.promises` — список обещаний;
- `checkboxes.agreements` — список договорённостей.

Если обработка завершилась ошибкой, backend отдаст статус `failed` и строку в поле `error`.

---

## Endpoint'ы

## `GET /health`

Проверка, что backend жив.

Пример ответа:

```/dev/null/health.json#L1-3
{
  "status": "ok"
}
```

---

## `POST /users/register`

Регистрация нового пользователя.

### Body

```/dev/null/register-request.json#L1-5
{
  "name": "Alice",
  "email": "alice@example.com",
  "password": "qwerty123"
}
```

### Успешный ответ

```/dev/null/register-response.json#L1-5
{
  "id": 1,
  "name": "Alice",
  "email": "alice@example.com"
}
```

### Что важно для фронтенда

- при успешном ответе пользователь создан;
- если email уже используется, backend вернёт ошибку;
- ошибки `400/422` нужно обрабатывать как ошибки валидации формы.

---

## `POST /login`

Логин пользователя.

### Body

```/dev/null/login-request.json#L1-4
{
  "email": "alice@example.com",
  "password": "qwerty123"
}
```

### Успешный ответ

```/dev/null/login-response.json#L1-5
{
  "id": 1,
  "name": "Alice",
  "email": "alice@example.com"
}
```

### Что важно для фронтенда

- backend устанавливает `httpOnly` cookie `auth`;
- фронтенд не должен пытаться читать токен из JavaScript;
- защищённые запросы потом выполняются с cookie;
- если логин или пароль неверные, backend вернёт ошибку.

---

## `GET /users`

Получить список пользователей.

### Успешный ответ

```/dev/null/users-list.json#L1-8
[
  {
    "id": 1,
    "name": "Alice",
    "email": "alice@example.com"
  }
]
```

Обычно этот endpoint нужен для справочников, списков или выбора пользователя в интерфейсе.

---

## `GET /users/:id`

Получить пользователя по `id`.

### Пример ответа

```/dev/null/user-by-id.json#L1-5
{
  "id": 1,
  "name": "Alice",
  "email": "alice@example.com"
}
```

Если пользователь не найден, backend вернёт ошибку.

---

## `POST /records/upload`

Загрузить аудиозапись.

### Авторизация

Требуется авторизация через `httpOnly` cookie `auth`.

### Формат запроса

Нужно отправлять `multipart/form-data`.

Поле файла:

- `file`

### Что делает backend

- принимает файл;
- сохраняет запись;
- запускает AI-обработку в фоне;
- сразу возвращает ответ.

### Пример успешного ответа

Успешный статус ответа: `202 Accepted`

```/dev/null/upload-response.json#L1-7
{
  "id": 12,
  "userId": 1,
  "fileUri": "/absolute/path/to/uploads/1/1725000000000-call.mp3",
  "status": "queued",
  "message": "Record uploaded and queued for async processing"
}
```

### Что важно для фронтенда

- это **не финальный AI-результат**;
- после ответа нужно взять `id` записи;
- дальше нужно опрашивать `GET /records/:id`;
- UI лучше сразу переводить в состояние “обрабатываем запись”.

---

## `GET /records`

Получить список записей текущего пользователя.

### Авторизация

Требуется авторизация через `httpOnly` cookie `auth`.

### Пример ответа

```/dev/null/records-list.json#L1-17
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

### Что важно для фронтенда

Этот endpoint полезен для:

- страницы истории записей;
- восстановления состояния после перезагрузки страницы;
- общего списка звонков пользователя.

---

## `GET /records/:id`

Получить запись по `id`.

### Авторизация

Требуется авторизация через `httpOnly` cookie `auth`.

### Зачем нужен этот endpoint

Это главный endpoint после загрузки файла.

Через него фронтенд получает:

- текущий статус обработки;
- `transcription`;
- `summary`;
- `tags`;
- `checkboxes`;
- `error`, если обработка завершилась неуспешно.

### Пример ответа во время обработки

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

### Пример ответа после успешной обработки

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
      {
        "label": "Подготовить коммерческое предложение",
        "checked": false
      }
    ],
    "promises": [
      {
        "label": "Отправить материалы на почту",
        "checked": false
      }
    ],
    "agreements": [
      {
        "label": "Созвониться повторно на следующей неделе",
        "checked": false
      }
    ]
  },
  "tags": ["сделка", "follow-up"]
}
```

### Пример ответа при ошибке обработки

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

### Что важно для фронтенда

- пока статус не финальный, UI должен показывать загрузку или промежуточное состояние;
- при `done` можно отображать результаты;
- при `failed` нужно показать ошибку и предусмотреть UX для повторной попытки, если это нужно на уровне интерфейса.

---

## Что показывать в интерфейсе

### Пока запись обрабатывается

Можно показывать:

- индикатор загрузки;
- статус обработки;
- скелетон или заглушки вместо результатов.

### Когда запись готова

Можно показывать:

- `transcription`;
- `summary`;
- `tags`;
- блоки из `checkboxes.tasks`, `checkboxes.promises`, `checkboxes.agreements`.

### Когда произошла ошибка

Нужно показать:

- понятное сообщение пользователю;
- при необходимости текст из поля `error`.

---

## Рекомендованный polling

После `POST /records/upload`:

1. взять `id` из ответа;
2. каждые 2–5 секунд вызывать `GET /records/:id`;
3. остановить polling при `done` или `failed`.

Если на странице есть список записей, можно дополнительно обновлять `GET /records`.

---

## Минимально необходимое для локального запуска backend

Если фронтендеру нужно поднять backend локально, достаточно следующего.

### Установка зависимостей

```/dev/null/install.sh#L1-1
bun install
```

### PostgreSQL через Docker

```/dev/null/postgres.sh#L1-1
docker run -p 5432:5432 --rm -e POSTGRES_PASSWORD=USER -e POSTGRES_USER=USER --name pgtest postgres
```

### `.env`

```/dev/null/.env.example#L1-8
DATABASE_URL=postgres://USER:PASSWORD@localhost:5432
JWT_SECRET=your-super-secret
GROQ_API_KEY=your-groq-api-key
GROQ_BASE_URL=https://api.groq.com/openai/v1
GROQ_TRANSCRIPTION_MODEL=whisper-large-v3-turbo
MISTRAL_API_KEY=your-mistral-api-key
MISTRAL_SUMMARY_MODEL=mistral-small-latest
```

### Запуск

```/dev/null/dev.sh#L1-1
bun run dev
```

---

# 2. Для AI-агентов

## Назначение секции

Эта часть предназначена для Claude Code, Cursor, Copilot, ChatGPT Agents и других помощников, которые читают `README.md`, чтобы понять, как фронтенду работать с backend.

Приоритет этой секции:

- зафиксировать контракты endpoint'ов;
- объяснить сценарий авторизации через cookie;
- объяснить асинхронную модель загрузки записей;
- помочь агенту писать клиентский код на фронтенде;
- не уводить внимание во внутреннее устройство backend.

---

## Жёсткое правило

**Агент не должен изменять ничего внутри директории `backend`.**

Разрешено:

- читать этот README;
- использовать контракты API для интеграции на фронтенде;
- писать типы, API-клиенты, хуки, формы, stores и polling на стороне фронтенда;
- адаптировать UI под фактическое поведение endpoint'ов.

Запрещено:

- редактировать файлы в `backend/`;
- менять backend-контракты;
- править endpoint'ы, схемы, ответы или авторизацию;
- “исправлять” неудобный API через изменения backend.

Если агент считает, что API неудобен или содержит проблему, он должен:

1. оставить `backend/` без изменений;
2. адаптировать фронтенд к текущему поведению API;
3. отдельно сообщить человеку, что именно выглядит спорно.

---

## Главная интеграционная модель

Агент должен считать, что:

- `POST /login` устанавливает `httpOnly` cookie `auth`;
- защищённые endpoint'ы используют cookie-аутентификацию;
- frontend должен отправлять credentials/cookies в защищённые запросы;
- `POST /records/upload` только запускает асинхронную обработку;
- финальные AI-данные нужно получать через `GET /records/:id`;
- история записей берётся через `GET /records`.

---

## Контракт авторизации

### `POST /login`

Запрос:

```/dev/null/agent-login-request.json#L1-4
{
  "email": "alice@example.com",
  "password": "qwerty123"
}
```

Успешный ответ:

```/dev/null/agent-login-response.json#L1-5
{
  "id": 1,
  "name": "Alice",
  "email": "alice@example.com"
}
```

Дополнительно backend устанавливает `httpOnly` cookie `auth`.

Интеграционное правило:

- агент не должен ожидать `token` в JSON-ответе;
- агент должен считать cookie основным механизмом авторизации;
- агент должен включать credentials/cookies во все защищённые запросы;
- если во фронтенде есть общий API client, отправку credentials нужно подключать централизованно.

---

## Контракты endpoint'ов

## `GET /health`

Назначение:

- проверить, что сервис доступен.

Ответ:

```/dev/null/agent-health.json#L1-3
{
  "status": "ok"
}
```

Использование на фронтенде:

- healthcheck;
- проверка доступности локального backend;
- диагностика проблем интеграции.

---

## `POST /users/register`

Назначение:

- создать пользователя.

Body:

```/dev/null/agent-register-request.json#L1-5
{
  "name": "Alice",
  "email": "alice@example.com",
  "password": "qwerty123"
}
```

Успешный ответ:

```/dev/null/agent-register-response.json#L1-5
{
  "id": 1,
  "name": "Alice",
  "email": "alice@example.com"
}
```

Интерпретация для агента:

- `400/422` трактовать как ошибки валидации;
- сообщение `Email already in use` трактовать как занятый email;
- после успешной регистрации можно вести пользователя на логин или запускать следующий шаг сценария, если это предусмотрено фронтендом.

---

## `POST /login`

Назначение:

- аутентифицировать пользователя.

Body:

```/dev/null/agent-login2-request.json#L1-4
{
  "email": "alice@example.com",
  "password": "qwerty123"
}
```

Успешный ответ:

```/dev/null/agent-login2-response.json#L1-6
{
  "id": 1,
  "name": "Alice",
  "email": "alice@example.com",
  "token": "<jwt-token>"
}
```

Интерпретация для агента:

- не ожидать `token` в response body;
- считать, что после успешного логина backend выставляет `httpOnly` cookie `auth`;
- при необходимости сохранить пользователя в session store;
- сообщение `Invalid credentials` показывать как ошибку входа.

---

## `GET /users`

Назначение:

- вернуть массив пользователей.

Ответ:

```/dev/null/agent-users-response.json#L1-8
[
  {
    "id": 1,
    "name": "Alice",
    "email": "alice@example.com"
  }
]
```

Интерпретация для агента:

- endpoint защищён через cookie-аутентификацию;
- endpoint возвращает массив;
- тип можно моделировать как `Array<{ id: number; name: string; email: string }>`.

---

## `GET /users/:id`

Назначение:

- вернуть одного пользователя по идентификатору.

Ответ:

```/dev/null/agent-user-id-response.json#L1-5
{
  "id": 1,
  "name": "Alice",
  "email": "alice@example.com"
}
```

Интерпретация для агента:

- при ошибке `User not found` нужно показать состояние “не найдено”, fallback-экран или redirect — в зависимости от UX фронтенда.

---

## `POST /records/upload`

Назначение:

- загрузить аудиофайл и инициировать AI-обработку.

Авторизация:

- требуется `httpOnly` cookie `auth`.

Формат:

- `multipart/form-data`
- поле файла: `file`

Успешный ответ:

```/dev/null/agent-upload-response.json#L1-7
{
  "id": 12,
  "userId": 1,
  "fileUri": "/absolute/path/to/uploads/1/1725000000000-call.mp3",
  "status": "queued",
  "message": "Record uploaded and queued for async processing"
}
```

Ключевая интерпретация для агента:

- этот endpoint **не** возвращает финальный AI-результат;
- `id` из ответа нужно использовать для последующего `GET /records/:id`;
- интерфейс должен сразу переходить в состояние ожидания;
- агент не должен ожидать `summary`, `transcription`, `tags` или `checkboxes` в ответе upload endpoint.

---

## `GET /records`

Назначение:

- вернуть список записей текущего пользователя.

Авторизация:

- требуется `httpOnly` cookie `auth`.

Ответ:

```/dev/null/agent-records-response.json#L1-17
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

Интерпретация для агента:

- использовать для экрана истории или списка записей;
- после reload страницы этот endpoint помогает восстановить текущее состояние;
- массив может содержать как завершённые, так и ещё обрабатывающиеся записи.

---

## `GET /records/:id`

Назначение:

- вернуть полное состояние одной записи.

Авторизация:

- требуется `httpOnly` cookie `auth`.

Во время обработки ответ может выглядеть так:

```/dev/null/agent-record-processing.json#L1-15
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

После успешной обработки:

```/dev/null/agent-record-done.json#L1-30
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
      {
        "label": "Подготовить коммерческое предложение",
        "checked": false
      }
    ],
    "promises": [
      {
        "label": "Отправить материалы на почту",
        "checked": false
      }
    ],
    "agreements": [
      {
        "label": "Созвониться повторно на следующей неделе",
        "checked": false
      }
    ]
  },
  "tags": ["сделка", "follow-up"]
}
```

При ошибке обработки:

```/dev/null/agent-record-failed.json#L1-15
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

Ключевая интерпретация для агента:

- это основной endpoint для страницы детали записи;
- именно он даёт финальные AI-данные;
- polling должен останавливаться на `done` или `failed`;
- при `done` нужно отображать `transcription`, `summary`, `tags`, `checkboxes`;
- при `failed` нужно отображать ошибку из `error`.

---

## Рекомендации агенту по фронтенд-интеграции

Агенту стоит:

- создать отдельные типы для:
  - `User`
  - `LoginResponse`
  - `RecordListItem`
  - `RecordDetails`
  - `RecordStatus`
- вынести API-вызовы в отдельный клиент;
- централизованно включить отправку credentials/cookies;
- реализовать polling как отдельный hook или utility;
- проектировать UI с учётом того, что upload и финальный результат — это два разных этапа.

---

## Что агенту не нужно делать

Агенту не нужно:

- описывать внутренние backend-плагины;
- рефакторить backend-архитектуру;
- лезть в миграции, схемы БД или серверную реализацию;
- менять директорию `backend`.

Этот README должен рассматриваться как интеграционный контракт для фронтенда, а не как приглашение менять серверную часть.