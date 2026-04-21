# JWT Users API (Bun + Elysia)

Базовый шаблон API для хакатона.

## Быстрый старт

```bash
bun install
bun run dev
```

## Для PostgreSQL

```
docker run -p 5432:5432 --rm -e POSTGRES_PASSWORD=USER -e POSTGRES_USER=USER --name pgtest postgres
```

Сервер стартует на `http://localhost:3000`.

## Переменные окружения

Создай `.env` с такими полями:

```env
DATABASE_URL=postgres://USER:PASSWORD@localhost:5432
JWT_SECRET=your-super-secret
```

## Что есть сейчас

- Регистрация пользователя
- Логин и выдача JWT
- Получение списка пользователей
- Получение пользователя по `id`
- Health-check

## Текущие endpoints

### `GET /health`
Проверка, что сервис жив.

Пример ответа:

```json
{
  "status": "ok"
}
```

---

### `POST /users/register`
Регистрация нового пользователя.

Body:

```json
{
  "name": "Alice",
  "email": "alice@example.com",
  "password": "qwerty123"
}
```

Успешный ответ (`200`):

```json
{
  "id": 1,
  "name": "Alice",
  "email": "alice@example.com"
}
```

Ошибки:
- `400/422` при невалидном body
- `500` с сообщением `Email already in use`, если почта уже занята

---

### `POST /login`
Логин пользователя.

Body:

```json
{
  "email": "alice@example.com",
  "password": "qwerty123"
}
```

Успешный ответ (`200`):

```json
{
  "id": 1,
  "name": "Alice",
  "email": "alice@example.com",
  "token": "<jwt-token>"
}
```

Ошибки:
- `400/422` при невалидном body
- `500` с сообщением `Invalid credentials`, если логин/пароль неверные

---

### `GET /users`
Получить список всех пользователей.

Успешный ответ (`200`):

```json
[
  {
    "id": 1,
    "name": "Alice",
    "email": "alice@example.com"
  }
]
```

---

### `GET /users/:id`
Получить одного пользователя по `id`.

Пример: `GET /users/1`

Успешный ответ (`200`):

```json
{
  "id": 1,
  "name": "Alice",
  "email": "alice@example.com"
}
```

Ошибки:
- `404` с сообщением `User not found`, если пользователя нет

## Авторизация

Сейчас JWT выдаётся на `/login`.

Плагин guard уже есть в коде (`src/plugins/guard`), но защищённые роуты пока не подключены в `src/index.ts`.

Когда появятся защищённые endpoint’ы, фронт будет отправлять токен так:

```http
Authorization: Bearer <jwt-token>
```

## Базовая структура проекта

```text
src/
  index.ts                 # Точка входа, подключение роутов
  database/
    service.ts             # Подключение к Postgres через Drizzle
  plugins/
    auth/                  # /login + JWT
    user/                  # /users/register, /users, /users/:id
    guard/                 # Проверка Bearer token (подготовлено)
    records/               # Заготовка для записей звонков (ещё не подключено)
    errors/                # Глобальный обработчик ошибок
```

## Минимальные примеры для фронта

Регистрация:

```bash
curl -X POST http://localhost:3000/users/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice","email":"alice@example.com","password":"qwerty123"}'
```

Логин:

```bash
curl -X POST http://localhost:3000/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"qwerty123"}'
```

Список пользователей:

```bash
curl http://localhost:3000/users
```
