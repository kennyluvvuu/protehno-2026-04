# Схема доработок бэкенда

## Контекст

Frontend-director — панель директора. Директор должен видеть звонки **всех** менеджеров,
управлять пользователями, смотреть аналитику. Текущий бэкенд не различает роли,
не имеет admin-уровня и не отдаёт агрегированные данные.

Ниже — полный список того, что нужно добавить/исправить на бэкенде.

---

## 1. КРИТИЧНО — Данные, которых не хватает прямо сейчас

### 1.1 `GET /records/feed` не видит чужие записи

**Текущее поведение** (`src/plugins/records/service.ts` → `getRecordsFeed()`):
```sql
WHERE userId = :authUserId
   OR (source = 'mango' AND userId IS NULL)
```
Директор видит только **свои** записи + бесхозные Mango. Записи менеджеров — невидимы.

**Нужно:** либо отдельный эндпоинт, либо query-параметр:
```
GET /records/feed?all=true   → все записи всех пользователей
```
или
```
GET /records/admin-feed      → только для директора
```

**Где менять:**
- `src/plugins/records/service.ts` — добавить метод `getAllRecordsFeed()`
- `src/plugins/records/index.ts` — добавить роут с проверкой роли

---

### 1.2 Несоответствие типа `checkboxes` — фронт сломается

**В БД (jsonb) и в ответе API:**
```json
{
  "tasks":     [{ "label": "Подготовить КП", "checked": false }],
  "promises":  [{ "label": "Выслать до пятницы", "checked": false }],
  "agreements":[{ "label": "Встреча в четверг", "checked": false }]
}
```

**Фронт ожидает** (`types/record.ts`):
```ts
checkboxes: { tasks: string[], promises: string[], agreements: string[] } | null
```

**Нужно** выровнять — либо фронт читает `item.label`, либо бэк при отдаче
сериализует массив объектов в массив строк. Рекомендую **исправить на фронте** —
читать `.label` из каждого объекта. Бэк менять не нужно, он правильный.

> ⚠️ Это нужно исправить в `types/record.ts` и `call-detail-sheet.tsx` на **фронте**.

---

### 1.3 Нет `qualityScore` ни в БД, ни в AI pipeline

**Текущий AI pipeline** (`src/plugins/records/ai-service.ts`) возвращает:
- `title`, `summary`, `tags`, `checkboxes`, `transcription`, `durationSec`
- ❌ `qualityScore` **отсутствует**

**Нужно:** добавить LLM-шаг оценки качества звонка (0–100).

**Где менять:**
- `src/plugins/records/ai-service.ts` — добавить prompt с оценкой качества
- Zod-схема результата: добавить поле `qualityScore: z.number().min(0).max(100).nullable()`
- `src/plugins/records/model.ts` — добавить колонку `qualityScore integer`
- `src/plugins/records/schema.ts` — добавить в `getRecordSchema`
- Drizzle migration

---

## 2. ВАЖНО — Управление пользователями

### 2.1 Нет `DELETE /users/:id`

Эндпоинт удаления пользователя **отсутствует** в `src/plugins/user/index.ts`.

**Нужно добавить:**
```
DELETE /users/:id   → только для директора (см. п.3 про роли)
```

Cascading: при удалении пользователя его записи должны остаться (только `userId = null`),
иначе добавить `ON DELETE SET NULL` в FK `records.user_id → users.id`.

**Проверить** текущий FK в `src/plugins/records/model.ts`:
```ts
userId: integer("user_id").references(() => userTable.id)  // нет onDelete
```
→ добавить `.references(() => userTable.id, { onDelete: "set null" })`

---

### 2.2 Нет редактирования пользователя директором

```
PATCH /users/:id   → изменить имя, email, mangoUserId другого пользователя
```

---

## 3. ВАЖНО — Система ролей

Сейчас **нет различия** между директором и менеджером.
`GET /users` и другие защищённые эндпоинты доступны любому авторизованному пользователю.

### 3.1 Добавить поле `role` в таблицу users

**`src/plugins/user/model.ts`:**
```ts
role: text("role").notNull().default("manager")  // "manager" | "director"
```

**Migration** + добавить в response schema.

### 3.2 Добавить middleware проверки роли

**`src/plugins/guard/index.ts`** — добавить `requireRole("director")` decorator:
```ts
// Пример использования в роутах:
.get("/records/admin-feed", handler, { beforeHandle: [guard, requireDirector] })
```

### 3.3 Обновить `POST /users/register`

Опциональное поле `role` (или задавать только через другой эндпоинт).

---

## 4. ЖЕЛАТЕЛЬНО — Агрегации для дашборда

Сейчас фронт получает сырой список записей и сам считает статистику.
При большом числе записей это неэффективно. Нужны эндпоинты:

### 4.1 `GET /stats/overview`

```json
{
  "totalRecords": 120,
  "doneRecords": 95,
  "failedRecords": 10,
  "avgQualityScore": 78.4,
  "totalManagers": 5
}
```

### 4.2 `GET /stats/weekly`

Звонки по дням за последние 7 дней:
```json
[{ "date": "2026-04-25", "total": 18, "done": 14 }, ...]
```

### 4.3 `GET /stats/by-agent`

Статистика по менеджерам:
```json
[{ "userId": 1, "name": "Иванов А.", "total": 28, "avgQualityScore": 79 }, ...]
```

**Где добавить:** новый плагин `src/plugins/stats/index.ts`

---

## 5. ЖЕЛАТЕЛЬНО — Прочее

### 5.1 Нет повторного запуска AI (ретрай)

Если AI упал (`status = "failed"`), нет способа перезапустить обработку.

```
POST /records/:id/reprocess   → reset status to "queued", retry AI
```

### 5.2 Нет удаления записи

```
DELETE /records/:id   → удалить запись (только владелец или директор)
```

### 5.3 Нет пагинации в `/records/feed`

При росте базы нужна пагинация:
```
GET /records/feed?page=1&limit=50
```

### 5.4 `GET /users` — никакой защиты кроме auth

Любой авторизованный менеджер видит список всех пользователей.
После добавления ролей — ограничить только для директора.

---

## Приоритеты

| # | Задача | Срочность |
|---|--------|-----------|
| 1 | Исправить `checkboxes` type mismatch (фронт) | 🔴 КРИТИЧНО |
| 2 | `GET /records/admin-feed` — все записи для директора | 🔴 КРИТИЧНО |
| 3 | Добавить `qualityScore` в AI + DB | 🟡 ВАЖНО |
| 4 | Роли (`director` / `manager`) в users | 🟡 ВАЖНО |
| 5 | `DELETE /users/:id` + FK `onDelete: set null` | 🟡 ВАЖНО |
| 6 | `GET /stats/*` агрегации | 🟢 ЖЕЛАТЕЛЬНО |
| 7 | `POST /records/:id/reprocess` | 🟢 ЖЕЛАТЕЛЬНО |
| 8 | `DELETE /records/:id` | 🟢 ЖЕЛАТЕЛЬНО |
| 9 | Пагинация в feed | 🟢 ЖЕЛАТЕЛЬНО |

---

## Файлы бэкенда для изменений

| Файл | Для чего |
|---|---|
| `src/plugins/records/model.ts` | + `qualityScore`, FK `onDelete` |
| `src/plugins/records/service.ts` | + `getAllRecordsFeed()` |
| `src/plugins/records/index.ts` | + роуты admin-feed, reprocess, delete |
| `src/plugins/records/ai-service.ts` | + scoring в LLM prompt |
| `src/plugins/records/schema.ts` | + `qualityScore` в response |
| `src/plugins/user/model.ts` | + `role` колонка |
| `src/plugins/user/index.ts` | + DELETE, PATCH /:id |
| `src/plugins/guard/index.ts` | + `requireRole()` middleware |
| `src/plugins/stats/index.ts` | новый плагин (агрегации) |
| `src/index.ts` | регистрация нового stats плагина |
| Drizzle migration | для новых колонок |
