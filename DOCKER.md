# Docker: локальный и production запуск через Caddy

В проекте используется единый docker-стек с внешним входом через `Caddy`.

- локальный режим (без сертификатов): `docker compose up`
- production-режим (HTTPS + автосертификаты): `docker compose -f docker-compose.yaml -f docker-compose.prod.yaml up -d --build`

## Сервисы

- `caddy`
- `frontend-manager`
- `frontend-director`
- `backend`
- `postgres`

Внутренние порты в docker-сети:

- `backend:3000`
- `frontend-manager:3000`
- `frontend-director:3000`
- `postgres:5432`

## 1. Подготовка env

```bash
cp .env.example .env
```

Обязательные переменные (минимум):

- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `JWT_SECRET`
- `GROQ_API_KEY`
- `MISTRAL_API_KEY`

## 2. Локальный режим (старый workflow, без изменений)

По умолчанию используется `Caddyfile` c HTTP-маршрутизацией для localhost.

Запуск:

```bash
docker compose up --build
```

Или в фоне:

```bash
docker compose up --build -d
```

Адреса локального режима:

- `http://manager.localhost`
- `http://director.localhost`
- `http://api.localhost/health`
- `http://localhost`

Важно для SSR во frontend-контейнерах:

```env
FRONTEND_MANAGER_VITE_BASE_URL=http://backend:3000
FRONTEND_DIRECTOR_VITE_BASE_URL=http://backend:3000
```

## 3. Production-режим (HTTPS + auto TLS от Caddy)

### Что нужно перед запуском

1. Публичные DNS-записи доменов должны указывать на сервер с Docker.
2. Порты `80/tcp` и `443/tcp` должны быть открыты извне.
3. В `.env` нужно переключить Caddyfile и задать домены:

```env
CADDYFILE_PATH=./Caddyfile.production
CADDY_HTTP_PORT=80
CADDY_HTTPS_PORT=443

CADDY_API_DOMAIN=api.example.com
CADDY_MANAGER_DOMAIN=manager.example.com
CADDY_DIRECTOR_DOMAIN=director.example.com
CADDY_LANDING_DOMAIN=example.com
```

### Запуск production

```bash
docker compose -f docker-compose.yaml -f docker-compose.prod.yaml up -d --build
```

Caddy автоматически выпустит и продлит сертификаты Let's Encrypt.

Данные Caddy (включая сертификаты) хранятся в volume:

- `caddy_data`
- `caddy_config`

## 4. Остановка

```bash
docker compose down
```

Удалить volume PostgreSQL:

```bash
docker compose down -v
```

## 5. Логи и состояние

```bash
docker compose ps
docker compose logs -f
docker compose logs -f caddy
docker compose logs -f backend
```
