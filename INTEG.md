# План интеграции Mango для фронтэнда

## Цель

Сделать на фронтенде простой и рабочий контур интеграции с Mango Office, который позволит:

1. видеть сотрудников Mango и их статус привязки;
2. сопоставлять Mango users с локальными пользователями;
3. создавать локальных пользователей из данных Mango;
4. запускать синхронизацию звонков;
5. видеть результат синка и работать с импортированными звонками.

---

## Общая идея UX

Интеграция делится на 3 основных сценария:

1. **Настройка и синхронизация**
   - обновить Mango users;
   - запустить sync звонков;
   - увидеть результат.

2. **Маппинг пользователей**
   - посмотреть список Mango users;
   - увидеть уже привязанных;
   - выбрать кандидата;
   - вручную привязать;
   - при отсутствии кандидатов — создать локального пользователя.

3. **Работа с импортированными звонками**
   - видеть Mango записи в общей ленте;
   - понимать, кто из сотрудников привязан;
   - фильтровать пропущенные/непривязанные/без записи.

---

# 1. Экран: `Интеграция Mango`

## Назначение

Главный вход в интеграцию. Здесь директор должен видеть состояние интеграции и запускать основные действия.

## Разделы экрана

### 1.1. Блок состояния
Показывать:

- Mango integration enabled
- last users refresh
- last calls sync
- количество Mango users
- количество уже связанных локальных пользователей
- количество несвязанных Mango users

Если бэкенд пока не хранит историю запусков, можно на первом этапе показывать только:
- текущее количество записей из `users/candidates`
- сколько из них имеют `linkedUserId`
- сколько не имеют

---

### 1.2. Блок действий
Кнопки:

- `Обновить пользователей Mango`
- `Синхронизировать звонки`
- `Синхронизировать звонки за период`

---

### 1.3. Форма запуска sync звонков
Поля:

- `startDate`
- `endDate`
- `downloadRecordings` — checkbox
- опционально:
  - `limit`
  - `offset`

Кнопка:
- `Запустить синхронизацию`

---

### 1.4. Блок результата sync
После ручного запуска показывать ответ:

- `fetched`
- `created`
- `updated`
- `downloaded`
- `failedDownloads`
- `skippedNoAudio`

Дополнительно можно показать alert:
- успех
- ошибка
- частичный успех

---

## Backend endpoints

### Обновление users cache
- `POST /integrations/mango/sync/users/refresh`

### Синхронизация звонков
- `POST /integrations/mango/sync`

Пример body:
```/dev/null/mango-sync-request.json#L1-8
{
  "startDate": "01.04.2026 00:00:00",
  "endDate": "25.04.2026 23:59:59",
  "limit": 500,
  "offset": 0,
  "pollIntervalMs": 3000,
  "maxAttempts": 30,
  "downloadRecordings": true
}
```

---

# 2. Экран: `Пользователи Mango`

## Назначение

Показать всех пользователей Mango, которых вернул API, и дать удобный интерфейс для маппинга.

## Источник данных

- `GET /integrations/mango/users/candidates`

---

## Что отображать в таблице

Для каждой строки Mango user показывать:

### Базовые поля
- `name`
- `mangoUserId`
- `login`
- `email`
- `mobile`

### Рабочие данные
- `position`
- `department`
- `extension`
- `outgoingLine`

### Телефония
- `sips`
- `telephonyNumbers`

### Организационные данные
- `groups`
- `accessRoleId`

### Статус привязки
- `linkedUserId`
- `linkedByMangoUserId`

---

## Визуальные статусы

### `Привязан`
Если:
- `linkedUserId !== null`

### `Не привязан`
Если:
- `linkedUserId === null`

### `Есть кандидаты`
Если:
- `candidates.length > 0`

### `Нет кандидатов`
Если:
- `candidates.length === 0`

---

## Фильтры

Добавить фильтры:

- все
- привязанные
- непривязанные
- с кандидатами
- без кандидатов

Поиск:
- по имени
- по логину
- по extension
- по mango user id

---

# 3. Экран / секция: `Кандидаты для маппинга`

## Назначение

Помочь директору быстро понять, кого из локальных пользователей нужно привязать к Mango user.

## Для каждого кандидата показывать

- `user.name`
- `user.fio`
- `user.email`
- `user.role`
- `user.mangoUserId`
- `score`
- `reasons[]`

---

## Расшифровка `reasons`

Фронт должен показывать human-readable label.

### Таблица преобразования
- `mango_user_id_exact` → `Точный Mango user id`
- `login_hint` → `Похожий логин`
- `extension_hint` → `Совпадение по внутреннему номеру`
- `sip_hint` → `Совпадение по SIP`
- `record_history` → `Есть история звонков`

---

## UX для кандидатов

Для каждой строки Mango user:

- показать top-3 кандидатов сразу;
- кнопку `Показать все`, если кандидатов больше;
- рядом с каждым кандидатом кнопка:
  - `Привязать`

---

## Backend endpoint для привязки

- `PATCH /integrations/mango/users/:mangoUserId/link`

### Привязать к existing user
```/dev/null/mango-link-request.json#L1-3
{
  "userId": 7
}
```

### Отвязать
```/dev/null/mango-unlink-request.json#L1-3
{
  "userId": null
}
```

---

# 4. Экран / модалка: `Создать локального пользователя из Mango`

## Когда показывать

Показывать кнопку:
- `Создать локального пользователя`

если:
- `linkedUserId === null`

и особенно если:
- `candidates.length === 0`
- или ни один кандидат не подходит

---

## Источник данных для формы

Использовать `createLocalUserDraft` из ответа:
- `GET /integrations/mango/users/candidates`

---

## Какие поля показывать в форме

### Редактируемые
- `name`
- `fio`
- `email`
- `role`
- `password`

### Read-only или скрытые, но отправляемые
- `mangoUserId`
- `mangoLogin`
- `mangoExtension`
- `mangoPosition`
- `mangoDepartment`
- `mangoMobile`
- `mangoOutgoingLine`
- `mangoAccessRoleId`
- `mangoGroups`
- `mangoSips`
- `mangoTelephonyNumbers`

---

## Рекомендуемый UX

### Блок 1. Локальный пользователь
Поля:
- Имя
- ФИО
- Email
- Роль
- Временный пароль

### Блок 2. Данные из Mango
Read-only:
- Mango user id
- Mango login
- Extension
- Position
- Department
- Mobile
- Outgoing line
- SIP
- Groups

---

## Backend endpoint

- `POST /users/mango/create-local-user`

Пример:
```/dev/null/create-local-user-request.json#L1-18
{
  "name": "Колмакова Александра Владимировна",
  "fio": "Колмакова Александра Владимировна",
  "email": "abk202@example.com",
  "role": "manager",
  "password": "TempPass123",
  "mangoUserId": 406103407,
  "mangoLogin": "400359245/abk202",
  "mangoExtension": "202",
  "mangoPosition": "Куратор",
  "mangoDepartment": "",
  "mangoMobile": null,
  "mangoOutgoingLine": "74232028823",
  "mangoAccessRoleId": 0,
  "mangoGroups": [20004692, 20004709],
  "mangoSips": ["user202@vpbx400359245.mangosip.ru"],
  "mangoTelephonyNumbers": [
    { "number": "sip:user202@vpbx400359245.mangosip.ru", "protocol": "sip", "order": 0, "wait_sec": 60, "status": "on" }
  ]
}
```

---

# 5. Экран / действие: `Редактирование локального пользователя`

## Назначение

После создания локального пользователя директор должен иметь возможность дописать или поправить данные.

## Что редактируется

### Основные поля
- `name`
- `fio`
- `email`
- `role`

### Mango profile fields
- `mangoUserId`
- `mangoLogin`
- `mangoExtension`
- `mangoPosition`
- `mangoDepartment`
- `mangoMobile`
- `mangoOutgoingLine`
- `mangoAccessRoleId`
- `mangoGroups`
- `mangoSips`
- `mangoTelephonyNumbers`

---

## Backend endpoint

- `PATCH /users/:id`

---

# 6. Экран / модалка: `Смена пароля`

## Назначение

Если локальный пользователь был создан из Mango, директор должен иметь возможность задать или сменить ему пароль.

## Поля
- `newPassword`

## Кнопка
- `Сохранить новый пароль`

## Backend endpoint
- `PATCH /users/:id/reset-password`

Пример:
```/dev/null/reset-password-request.json#L1-3
{
  "password": "NewStrong123"
}
```

---

# 7. Экран: `Лента звонков`

## Назначение

Использовать уже существующую ленту звонков, но улучшить отображение Mango-данных.

## Что отображать для Mango calls

- источник: `Mango`
- направление
- caller / callee
- дата и время
- `Пропущенный`
- есть запись / нет записи
- связан ли звонок с локальным пользователем
- `mangoUserId`, если нужно в тех. режиме

---

## Фильтры
Добавить фильтры:

- все
- только Mango
- пропущенные
- с записью
- без записи
- привязанные к пользователю
- не привязанные

---

# 8. Роли и доступ

## Кто видит интеграцию
Только `director`.

## Кто может:
- обновлять Mango users
- запускать sync
- привязывать / отвязывать Mango users
- создавать локальных пользователей из Mango
- менять пароль пользователям

Обычный `manager` не должен видеть экран интеграции.

---

# 9. Последовательность внедрения

## Этап 1. Базовый экран интеграции
Сделать:
- страницу `Mango`
- кнопки refresh users и sync calls
- форму запуска sync
- вывод summary результата

---

## Этап 2. Таблица Mango users
Сделать:
- запрос `GET /integrations/mango/users/candidates`
- таблицу Mango users
- фильтры
- отображение linked / unlinked

---

## Этап 3. Кандидаты и ручной mapping
Сделать:
- отображение кандидатов
- кнопки `Привязать`
- кнопка `Отвязать`

---

## Этап 4. Создание локального пользователя из Mango
Сделать:
- модалку создания
- prefill из `createLocalUserDraft`
- submit в `POST /users/mango/create-local-user`

---

## Этап 5. Редактирование и сброс пароля
Сделать:
- редактирование локального пользователя
- смену пароля через отдельную модалку

---

## Этап 6. Улучшение ленты звонков
Сделать:
- фильтры для Mango звонков
- визуальные бейджи:
  - `Mango`
  - `Пропущен`
  - `Без записи`
  - `Не привязан`

---

# 10. Рекомендуемая структура UI

## Раздел в навигации
- `Интеграции`
  - `Mango`

## Вкладки внутри страницы Mango
- `Обзор`
- `Пользователи Mango`
- `Синхронизация звонков`

---

# 11. Минимальный state management

## Данные страницы обзора
- `syncResult`
- `refreshLoading`
- `syncLoading`

## Данные страницы пользователей
- `mangoUsers`
- `filters`
- `selectedMangoUser`
- `linkingLoading`
- `createUserLoading`

## Данные модалки создания
- `draft`
- `form`
- `submitError`

---

# 12. Ошибки и обработка

## Что показывать пользователю
Все ошибки с backend показывать в toast / alert.

Типовые случаи:
- invalid mango user id
- user not found
- email already in use
- mango user id already in use
- forbidden
- invalid date range
- mango api unavailable

---

# 13. Что важно учесть фронтенду

1. `createLocalUserDraft` — это draft, а не гарантированно идеальные данные.
2. Email почти всегда нужно разрешать редактировать.
3. Пароль при создании обязателен.
4. `mangoGroups`, `mangoSips`, `mangoTelephonyNumbers` лучше показывать как списки/теги.
5. Не надо давать менеджерам доступ к интеграции.
6. После link/create-local-user желательно автоматически перезагружать список `users/candidates`.

---

# 14. MVP definition

Функциональность считается внедрённой, если директор может:

1. открыть страницу Mango;
2. обновить список Mango users;
3. увидеть всех Mango users и статус их привязки;
4. привязать Mango user к локальному пользователю;
5. создать локального пользователя из Mango draft;
6. сбросить пароль созданному пользователю;
7. запустить синхронизацию звонков;
8. увидеть импортированные Mango calls в общей ленте.

---

# 15. Следующие улучшения после MVP

1. Автоматический periodic sync.
2. История запусков sync.
3. Более богатые match reasons.
4. Массовое создание / привязка пользователей.
5. Отдельный блок аналитики по Mango calls.
6. Автоматическая подсветка конфликтов:
   - одинаковый login
   - одинаковый extension
   - несколько кандидатов с близким score