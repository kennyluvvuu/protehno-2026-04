# Docker: запуск всего стека

В проекте подготовлен единый docker-стек для:

- `frontend-manager`
- `backend`
- `postgresql`

Файл переменных окружения вынесен в корень проекта рядом с `docker-compose.yaml`.

## Что находится в корне

- `docker-compose.yaml`
- `.env.example`

Рекомендуемая структура для запуска:

```/dev/null/tree.txt#L1-6
jwtusers/
  .env
  .env.example
  docker-compose.yaml
  DOCKER.md
```

## 1. Подготовка `.env`

Скопируйте пример:

```/dev/null/cmd.sh#L1-1
cp .env.example .env
```

После этого откройте `.env` и заполните значения.

Минимально обязательные переменные:

- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `JWT_SECRET`
- `GROQ_API_KEY`
- `MISTRAL_API_KEY`

Остальные можно оставить как в примере, если вам подходят значения по умолчанию.

## 2. Что означает каждая env-переменная

### Общие

- `COMPOSE_PROJECT_NAME` — префикс имен контейнеров, сети и volume в Docker Compose
- `NODE_ENV` — режим приложения, для docker-окружения обычно `production`

### PostgreSQL

- `POSTGRES_DB` — имя базы данных
- `POSTGRES_USER` — пользователь PostgreSQL
- `POSTGRES_PASSWORD` — пароль PostgreSQL
- `POSTGRES_PORT` — порт PostgreSQL на вашей машине

### Backend

- `BACKEND_PORT` — порт backend на вашей машине
- `JWT_SECRET` — секрет для подписи auth cookie / JWT, обязательно задайте длинное случайное значение
- `DATABASE_URL` — строка подключения к БД; в compose обычно собирается через внутренний hostname `postgres` и используется backend-контейнером для `drizzle-kit push` при старте
- `GROQ_API_KEY` — ключ для транскрибации
- `GROQ_BASE_URL` — базовый URL Groq/OpenAI-compatible API
- `GROQ_TRANSCRIPTION_MODEL` — модель транскрибации
- `MISTRAL_API_KEY` — ключ Mistral для summary/LLM
- `MISTRAL_SUMMARY_MODEL` — модель Mistral для саммаризации
- `MANGO_VPBX_API_KEY` — ключ Mango Office API
- `MANGO_VPBX_API_SALT` — salt Mango Office API
- `MANGO_BASE_URL` — базовый URL Mango Office API
- `DB_WAIT_MAX_ATTEMPTS` — сколько раз backend будет ждать доступность БД перед завершением

### Frontend

- `FRONTEND_MANAGER_PORT` — порт frontend на вашей машине
- `VITE_BASE_URL` — URL backend, который использует frontend
- `VITE_TIMEOUT` — timeout запросов frontend к backend в миллисекундах

## 3. Важный момент про `VITE_BASE_URL`

Если frontend работает **внутри docker-compose**, ему обычно нужен внутренний адрес backend:

```/dev/null/env.txt#L1-1
VITE_BASE_URL=http://backend:3000
```

Если вы захотите запускать frontend вне Docker, тогда обычно нужен адрес вида:

```/dev/null/env-local.txt#L1-1
VITE_BASE_URL=http://localhost:3000
```

Для docker-стека используйте именно адрес сервиса внутри compose-сети.

## 4. Запуск

Из корня проекта выполните:

```/dev/null/docker-up.sh#L1-1
docker compose up --build
```

Для запуска в фоне:

```/dev/null/docker-up-detached.sh#L1-1
docker compose up --build -d
```

## 5. Остановка

```/dev/null/docker-down.sh#L1-1
docker compose down
```

Если нужно удалить и volume с PostgreSQL-данными:

```/dev/null/docker-down-volumes.sh#L1-1
docker compose down -v
```

## 6. Что будет доступно после запуска

По умолчанию:

- frontend-manager: `http://localhost:8080`
- backend: `http://localhost:3000`
- postgresql: `localhost:5432`

Если вы изменили порты в `.env`, используйте свои значения.

## 7. Первый запуск backend

При старте backend:

1. ждет готовности PostgreSQL
2. выполняет `drizzle-kit push` и синхронизирует схему базы по текущим Drizzle-моделям
3. запускает приложение
4. выполняет встроенный seed директора, если таблица `users` пустая

Дефолтный seed-пользователь директора:

- email: `director@example.com`
- password: `director123`

После первого входа лучше сразу сменить эти данные в приложении или в логике seed, если это окружение не для локальной разработки.

## 8. Проверка состояния

Проверить контейнеры:

```/dev/null/docker-ps.sh#L1-1
docker compose ps
```

Посмотреть логи всего стека:

```/dev/null/docker-logs.sh#L1-1
docker compose logs -f
```

Логи только backend:

```/dev/null/docker-logs-backend.sh#L1-1
docker compose logs -f backend
```

Логи только frontend:

```/dev/null/docker-logs-frontend.sh#L1-1
docker compose logs -f frontend-manager
```

Логи только PostgreSQL:

```/dev/null/docker-logs-postgres.sh#L1-1
docker compose logs -f postgres
```

## 9. Полезные замечания

### Пересборка после изменений в коде

```/dev/null/docker-rebuild.sh#L1-1
docker compose up --build -d
```

### Полная очистка образов и контейнеров этого стека

```/dev/null/docker-clean.sh#L1-2
docker compose down -v
docker compose rm -f
```

### Если порт уже занят

Поменяйте в `.env`:

- `FRONTEND_MANAGER_PORT`
- `BACKEND_PORT`
- `POSTGRES_PORT`

## 10. Пример типового сценария

1. Скопировать `.env.example` в `.env`
2. Заполнить секреты и API keys
3. Запустить:

```/dev/null/docker-run-flow.sh#L1-1
docker compose up --build -d
```

4. Проверить:

```/dev/null/docker-run-check.sh#L1-2
docker compose ps
docker compose logs -f backend
```

5. Открыть frontend в браузере
6. Войти под директором
7. Проверить, что backend отвечает по `/health`

Пример проверки health:

```/dev/null/health-check.sh#L1-1
curl http://localhost:3000/health
```

Ожидаемый ответ:

```/dev/null/health-response.json#L1-3
{
  "status": "ok"
}
```

## 11. Если что-то не стартует

Проверьте по порядку:

1. существует ли файл `.env`
2. заполнены ли `JWT_SECRET`, `GROQ_API_KEY`, `MISTRAL_API_KEY`
3. не заняты ли порты `8080`, `3000`, `5432`
4. поднялся ли контейнер `postgres`
5. корректен ли `VITE_BASE_URL`
6. смотрите логи backend и frontend

## 12. Быстрый старт

```/dev/null/quick-start.sh#L1-4
cp .env.example .env
docker compose up --build -d
docker compose ps
docker compose logs -f backend
```
