# Docker: запуск стека через Caddy

В проекте используется единый docker-стек, где внешний вход в систему организован через `Caddy`, а внутренние сервисы (`backend`, `frontend-manager`, `frontend-director`) не публикуют свои порты наружу.

## Что входит в стек

- `caddy`
- `frontend-manager`
- `frontend-director`
- `backend`
- `postgresql`

## Архитектура

Снаружи доступен только `Caddy`.

Он проксирует запросы так:

- `http://manager.localhost` → `frontend-manager`
- `http://director.localhost` → `frontend-director`
- `http://api.localhost/*` → `backend`
- `http://localhost` → landing page

Внутренние сервисы работают только внутри docker-сети:

- `backend:3000`
- `frontend-manager:3000`
- `frontend-director:3000`
- `postgres:5432`

Это даёт более чистую схему:
- один публичный вход
- меньше конфликтов портов
- единая точка маршрутизации
- проще работать с SSR-приложениями и API

---

## Что находится в корне проекта

```/dev/null/tree.txt#L1-7
jwtusers/
  .env
  .env.example
  docker-compose.yaml
  Caddyfile
  DOCKER.md
```

---

## 1. Подготовка `.env`

Создай `.env` из примера:

```/dev/null/cmd.sh#L1-1
cp .env.example .env
```

После этого заполни нужные значения.

Минимально обязательные переменные:

- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `JWT_SECRET`
- `GROQ_API_KEY`
- `MISTRAL_API_KEY`

---

## 2. Основные env-переменные

### Общие

- `COMPOSE_PROJECT_NAME` — префикс имён контейнеров, сети и volume
- `CADDY_HTTP_PORT` — внешний HTTP-порт Caddy, по умолчанию `80`

### PostgreSQL

- `POSTGRES_DB` — имя базы
- `POSTGRES_USER` — пользователь PostgreSQL
- `POSTGRES_PASSWORD` — пароль PostgreSQL
- `POSTGRES_PORT` — внешний порт PostgreSQL на машине, если он опубликован

### Backend

- `JWT_SECRET` — секрет для auth cookie / JWT
- `GROQ_API_KEY` — ключ Groq
- `GROQ_BASE_URL` — base URL Groq API
- `GROQ_TRANSCRIPTION_MODEL` — модель транскрибации
- `MISTRAL_API_KEY` — ключ Mistral
- `MISTRAL_SUMMARY_MODEL` — модель Mistral
- `MANGO_VPBX_API_KEY` — ключ Mango Office
- `MANGO_VPBX_API_SALT` — salt Mango Office
- `MANGO_BASE_URL` — base URL Mango Office
- `DB_WAIT_MAX_ATTEMPTS` — сколько раз backend ждёт БД при старте

### Frontend

- `FRONTEND_MANAGER_VITE_BASE_URL` — URL backend для manager frontend
- `FRONTEND_DIRECTOR_VITE_BASE_URL` — URL backend для director frontend
- `VITE_TIMEOUT` — timeout frontend-запросов

---

## 3. Важный момент про `VITE_BASE_URL`

Так как `frontend-manager` и `frontend-director` работают как SSR-приложения внутри docker-сети, для них backend должен быть указан по внутреннему имени сервиса:

```/dev/null/env.txt#L1-3
FRONTEND_MANAGER_VITE_BASE_URL=http://backend:3000
FRONTEND_DIRECTOR_VITE_BASE_URL=http://backend:3000
VITE_TIMEOUT=10000
```

Для текущего Docker-стека это правильная конфигурация.

Не используй `http://localhost:3000` внутри этих переменных для docker-запуска, потому что внутри контейнера `localhost` указывает на сам контейнер, а не на сервис `backend`.

---

## 4. Пример `.env` для локального Docker-запуска

```/dev/null/example.env#L1-18
COMPOSE_PROJECT_NAME=connectio

POSTGRES_DB=jwtusers
POSTGRES_USER=jwtusers
POSTGRES_PASSWORD=secret
POSTGRES_PORT=5432

CADDY_HTTP_PORT=80

JWT_SECRET=change-me-to-a-long-random-secret

FRONTEND_MANAGER_VITE_BASE_URL=http://backend:3000
FRONTEND_DIRECTOR_VITE_BASE_URL=http://backend:3000
VITE_TIMEOUT=10000

GROQ_API_KEY=your-groq-key
MISTRAL_API_KEY=your-mistral-key

MANGO_VPBX_API_KEY=
MANGO_VPBX_API_SALT=
MANGO_BASE_URL=https://app.mango-office.ru
DB_WAIT_MAX_ATTEMPTS=30
```

---

## 5. Запуск

Из корня проекта:

```/dev/null/docker-up.sh#L1-1
docker compose up --build
```

Для запуска в фоне:

```/dev/null/docker-up-detached.sh#L1-1
docker compose up --build -d
```

---

## 6. Что будет доступно после запуска

По умолчанию открывай:

- manager: `http://manager.localhost`
- director: `http://director.localhost`
- API health: `http://api.localhost/health`
- landing page: `http://localhost`

Если в `.env` изменён `CADDY_HTTP_PORT`, тогда используй соответствующий порт, например:

```/dev/null/url-example.txt#L1-4
http://manager.localhost:8088
http://director.localhost:8088
http://api.localhost:8088/health
http://localhost:8088
```

---

## 7. Остановка

```/dev/null/docker-down.sh#L1-1
docker compose down
```

Если нужно удалить volume с данными PostgreSQL:

```/dev/null/docker-down-volumes.sh#L1-1
docker compose down -v
```

---

## 8. Первый запуск backend

При старте backend:

1. ждёт готовности PostgreSQL
2. выполняет `drizzle-kit push`
3. запускает приложение
4. сидирует дефолтного директора, если таблица `users` пустая

Дефолтный директор:

- email: `director@example.com`
- password: `director123`

Для локальной разработки это удобно, но для реального окружения лучше заменить эти данные.

---

## 9. Проверка состояния

Все контейнеры:

```/dev/null/docker-ps.sh#L1-1
docker compose ps
```

Все логи:

```/dev/null/docker-logs.sh#L1-1
docker compose logs -f
```

Логи Caddy:

```/dev/null/docker-logs-caddy.sh#L1-1
docker compose logs -f caddy
```

Логи backend:

```/dev/null/docker-logs-backend.sh#L1-1
docker compose logs -f backend
```

Логи manager frontend:

```/dev/null/docker-logs-manager.sh#L1-1
docker compose logs -f frontend-manager
```

Логи director frontend:

```/dev/null/docker-logs-director.sh#L1-1
docker compose logs -f frontend-director
```

Логи PostgreSQL:

```/dev/null/docker-logs-postgres.sh#L1-1
docker compose logs -f postgres
```

---

## 10. Пересборка после изменений

```/dev/null/docker-rebuild.sh#L1-1
docker compose up --build -d
```

Полная пересборка без кеша:

```/dev/null/docker-rebuild-nocache.sh#L1-1
docker compose build --no-cache
```

---

## 11. Полная очистка

```/dev/null/docker-clean.sh#L1-2
docker compose down -v
docker compose rm -f
```

При необходимости можно дополнительно удалить локальные образы вручную.

---

## 12. Проверка health API

Через Caddy:

```/dev/null/health-check.sh#L1-1
curl http://api.localhost/health
```

Ожидаемый ответ:

```/dev/null/health-response.json#L1-3
{
  "status": "ok"
}
```

---

## 13. Полезные замечания

### Почему Caddy-first схема лучше

- наружу торчит только один HTTP-порт
- проще открывать приложение
- нет необходимости помнить отдельные порты frontend'ов
- удобнее масштабировать routing
- чище работать с SSR frontend'ами

### Если порт `80` уже занят

Поставь другой внешний порт для Caddy:

```/dev/null/caddy-port.txt#L1-1
CADDY_HTTP_PORT=8088
```

Тогда приложение будет доступно по:

```/dev/null/caddy-port-urls.txt#L1-4
http://manager.localhost:8088
http://director.localhost:8088
http://api.localhost:8088/health
http://localhost:8088
```

### Если нужно обращаться к backend напрямую

В Caddy-first схеме лучше использовать маршрут `/api/*` через Caddy, а не публиковать backend напрямую наружу.

---

## 14. Типовой сценарий запуска

1. Скопировать `.env.example` в `.env`
2. Заполнить секреты и ключи
3. Убедиться, что:
   - `FRONTEND_MANAGER_VITE_BASE_URL=http://backend:3000`
   - `FRONTEND_DIRECTOR_VITE_BASE_URL=http://backend:3000`
4. Запустить стек:

```/dev/null/run-flow.sh#L1-1
docker compose up --build -d
```

5. Проверить:

```/dev/null/run-check.sh#L1-2
docker compose ps
docker compose logs -f caddy
```

6. Открыть:
   - `http://manager.localhost`
   - `http://director.localhost`

---

## 15. Если что-то не стартует

Проверь по порядку:

1. `docker compose ps`
2. `docker compose logs -f caddy backend frontend-manager frontend-director`
3. доступность API:
   - `http://api.localhost/health`
4. корректность `.env`
5. пересборку без кеша:

```/dev/null/troubleshoot.sh#L1-2
docker compose build --no-cache
docker compose up -d
```

Если manager открывается, а director нет, это уже означает, что:
- сеть Docker в целом работает
- Caddy маршрутизация в целом работает
- проблему нужно искать в конкретном `frontend-director` или его SSR/API-вызовах