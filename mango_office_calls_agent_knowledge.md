# Mango Office VPBX API — звонки, записи и метаданные для ИИ-агента

Источник: `MangoOffice_VPBX_API.pdf`, версия документа от 16.02.2026.  
Назначение файла: дать ИИ-агенту компактную, но полную карту API MANGO OFFICE, связанную со звонками, событиями звонков, статистикой, записями разговоров, расшифровками и оффлайн-загрузкой аудио.

---

## 0. Что агент должен уметь делать

Основные сценарии:

1. Получать realtime-события звонков от ВАТС:
   - появление/изменение состояния плеча звонка;
   - завершение звонка;
   - DTMF;
   - события записи;
   - готовность записи к скачиванию;
   - готовность тематик/распознавания.
2. Получать историю звонков через API статистики:
   - базовая статистика в CSV;
   - расширенная статистика в JSON с плечами звонка, признаками направления, записью, переводом, удержанием, обзвоном и т.д.
3. Получать аудиофайлы записей разговоров.
4. Получать расшифровки, тематики, summary/конспект и список коммуникаций с расшифровками.
5. Загружать оффлайн-аудио для распознавания речи и получать результат распознавания.
6. Управлять звонками при необходимости:
   - инициировать callback;
   - завершить звонок;
   - стартовать запись;
   - маршрутизировать/переводить/удерживать вызов.

---

## 1. Базовая модель API

### 1.1 Базовые URL

```text
API ВАТС base URL: https://app.mango-office.ru/vpbx/
API КЦ base URL:   https://app.mango-office.ru/cc/
Личный кабинет:    https://lk.mango-office.ru
```

### 1.2 Транспорт и сетевые требования

- Используется HTTPS.
- Требуется TLS 1.2.
- TLS 1.0, TLS 1.1, TLS 1.3 и SSLv3 не поддерживаются.
- Для API Realtime внешняя система должна быть доступна по публичному HTTPS-адресу.
- IP-адреса Mango Office, с которых приходят realtime-уведомления и которые нужно добавить в allowlist:

```text
81.88.80.132
81.88.80.133
81.88.82.36
81.88.82.44
81.88.82.45
```

### 1.3 Авторизация и подпись

Большинство POST-запросов передает параметры в form-urlencoded теле:

```text
vpbx_api_key = <уникальный код ВАТС>
sign         = <sha256-подпись>
json         = <JSON-строка без искусственных пробелов/переносов>
```

`vpbx_api_key` — уникальный код продукта ВАТС.  
`vpbx_api_salt` — секретный ключ для подписи, в запросе не передается.  
Обычная формула подписи:

```text
sign = sha256(vpbx_api_key + json + vpbx_api_salt)
```

Для GET-ссылки на запись без авторизации формула другая:

```text
sign = sha256(vpbx_api_key + timestamp + recording_id + vpbx_api_salt)
```

### 1.4 Важные лимиты

Критичные лимиты для звонков и записей:

```yaml
api_vpbx_total: 100 requests/sec
api_vpbx_per_product: 10 requests/sec
callback:
  per_product: 4 requests/sec
  total: 10 requests/sec
call_hangup:
  per_product: 4 requests/sec
  total: 10 requests/sec
recording_start:
  per_product: 4 requests/sec
  total: 10 requests/sec
recording_access:
  per_product: 10 requests/sec
  total: 120 requests/sec
stats_request:
  per_product: 1 request / 2 sec
  total: 10 requests/sec
stats_result:
  total: 50 requests/sec
route:
  per_product: 1 request / 2 sec
  total: 10 requests/sec
```

Если превышен лимит API ВАТС, возможен HTTP 429 с сообщением `Rate limit exceeded`. При неверных запросах действует строгий лимит: 1 неверный запрос за 2 минуты; при превышении можно получить 401 до истечения блокировки.

---

## 2. Основные идентификаторы и как их связывать

### 2.1 Главные идентификаторы

```yaml
entry_id:
  meaning: "Внутренний идентификатор группы вызовов / call context"
  scope: "Одинаковый для всех последующих вызовов/плеч, возникших при обработке одного звонка: переадресация, перевод средствами ВАТС и т.п."
  use: "Главный ключ для сборки дерева звонка и связи realtime-событий, summary, статистики и записей."
  not_equal_to: "SIP Call-ID"

call_id:
  meaning: "Внутренний идентификатор конкретного вызова/плеча"
  scope: "Уникален для плеча вызова; может меняться при переводах и продолжении записи в другом вызове."
  use: "Ключ для управления конкретным плечом: hangup, route, transfer, hold, recording/start."
  not_equal_to: "SIP Call-ID"

external_call_id:
  meaning: "В расширенной статистике — внутренний идентификатор плеча вызова"
  use: "Связывать context_calls из stats/calls/result с realtime call_id, если значения совпадают."

recording_id:
  meaning: "Идентификатор записи разговора"
  sources:
    - "/events/recording"
    - "/events/record/added"
    - "basic stats field records"
    - "extended stats context_calls[].recording_id"
  use: "Скачать запись, получить тематики, расшифровку."

command_id:
  meaning: "Идентификатор команды внешней системы"
  generated_by: "Внешняя система"
  use: "Корреляция команды с /result/* и порожденными событиями."

request_id:
  meaning: "Идентификатор запроса внешней системы"
  use: "Корреляция асинхронных запросов статистики или оффлайн-распознавания."

sip_call_id:
  meaning: "Идентификатор входящего звонка по SIP, сформированный внешней системой"
  condition: "Сохраняется только если в ЛК включен флаг 'Разрешаю пробрасывать идентификатор входящего звонка'."
  use: "Связь входящего звонка ВАТС с записью во внешней системе клиента."

product_id:
  meaning: "Идентификатор продукта ВАТС"
  sources: ["/events/record/added", "/events/record/tagged", "/events/recognized/offline"]

user_id:
  meaning: "Идентификатор сотрудника ВАТС"
  note: "В realtime record events может быть user_id системного пользователя Admin или -1, если запись нельзя связать с сотрудником."

group_id:
  meaning: "Идентификатор группы ВАТС"
  sources: ["/vpbx/groups", "extended stats context_calls.call_abonent_id when call_type=group"]

communication_id:
  meaning: "id коммуникации в Speech2Text/КЦ-слое"
  sources: ["/s2t/queries/records"]
  use: "Получить summary через /s2t/queries/recording_summary."
```

### 2.2 Рекомендуемый порядок связывания данных

1. Realtime `/events/call` и `/events/summary` связывать по `entry_id`.
2. Плечи внутри одного звонка связывать по `entry_id + call_id`.
3. Записи связывать по `recording_id`, дополнительно хранить `entry_id`, `call_id`, `extension`/`user_id`.
4. Историю из расширенной статистики связывать с realtime по `entry_id`; каждое плечо — по `external_call_id`/`call_id`, если доступно.
5. Расшифровки и тематики связывать по `recording_id`.
6. Summary в S2T связывать по `communication_id`; если нужно соединить с ВАТС-звонком, использовать поля `info.from_number`, `info.to_number`, `info.time_created`, `duration`, а также найденные `recording_id`/период.

---

## 3. Realtime-события звонков

Realtime-события — это POST-запросы от Mango Office во внешнюю систему. Все запросы подписаны так же, как обычные API-запросы.

### 3.1 `/events/call` — уведомление о вызове

```text
POST https://external-system.com/events/call
```

Содержит информацию о вызове и его текущем состоянии. Отправляется при прохождении вызова через IVR, очередь, распределение на абонента и при изменениях состояния.

#### Поля

```yaml
entry_id: string            # идентификатор группы вызовов
call_id: string             # идентификатор плеча вызова
timestamp: integer          # время события UTC+3
seq: integer                # счетчик последовательности событий по вызову
call_state: string          # Appeared | Connected | OnHold | Disconnected
location: string            # ivr | queue | abonent
from:
  extension: integer?       # сотрудник-инициатор, если определен
  number: string?           # номер вызывающего абонента
  taken_from_call_id: string?
  was_transferred: bool?    # актуально в Disconnected
  hold_initiator: bool?     # актуально в OnHold
to:
  extension: integer?
  number: string?
  line_number: string?      # входящая линия ВАТС
  acd_group: integer?       # внутренний номер группы операторов
  was_transferred: bool?
  hold_initiator: bool?
dct:
  number: string?           # номер коллтрекинга
  type: integer             # 0 none, 1 dynamic, 2 static
disconnect_reason: integer? # передается в Disconnected
transfer: string?           # consultative | blind | return_blind
sip_call_id: string?
command_id: string?
task_id: integer?
callback_initiator: string?
```

#### Состояния `call_state`

```yaml
Appeared: "В ВАТС появился входящий или исходящий вызов в режиме дозвона; вызываемый абонент известен."
Connected: "Разговор двух абонентов."
OnHold: "Вызов поставлен на удержание одним из абонентов средствами ВАТС."
Disconnected: "Вызов завершен."
```

#### `location`

```yaml
ivr: "Голосовое меню"
queue: "Очередь дозвона на группу"
abonent: "Сотрудник ВАТС"
```

#### `disconnect_reason`

Коды сгруппированы так:

```yaml
11xx: "Нормальное завершение вызова"
2xxx: "Ограничение биллинговой системы"
32xx: "Неверно указан номер абонента"
42xx: "Связаться с абонентом сейчас невозможно"
5001: "Перегрузка"
5003: "Технические проблемы"
```

#### Важное для агента

- События могут приходить не в фактическом порядке. Нужно сортировать по `seq` в рамках `call_id` или игнорировать события с меньшим `seq`.
- `entry_id` — контекст всего звонка, `call_id` — конкретное плечо.
- `sip_call_id` сохраняется только при включенном флаге в ЛК.
- Для callback поле `callback_initiator` может принимать:

```yaml
CC: "Callback Контакт-центра"
API: "API-callback"
WEB: "Callback из Личного кабинета"
ObDial: "Callback из кампании исходящего обзвона"
CallbackWidget: "Callback из виджета обратного звонка"
MissGroupCallCallback: "Перезвон по пропущенному в группе"
MissInIvrCallCallback: "Перезвон по пропущенному в голосовом меню"
```

### 3.2 `/events/summary` — финальное событие звонка

```text
POST https://external-system.com/events/summary
```

Событие является индикатором окончания разговора. После него вызов можно считать завершенным.

#### Поля

```yaml
entry_id: string
call_direction: integer     # 0 internal, 1 inbound, 2 outbound
from:
  extension: string?        # для исходящего/внутреннего, если есть
  number: string?           # номер вызывающего
to:
  extension: string?        # сотрудник или группа
  number: string?           # оконечное устройство / основной номер
line_number: string?        # входящая/исходящая линия; нет для внутренних
create_time: timestamp      # поступление/начало звонка, UTC+3
forward_time: timestamp     # начало переадресации; 0 если разговор не состоялся; для исходящих = create_time
talk_time: timestamp        # время ответа; 0 если разговор не состоялся
end_time: timestamp         # время завершения
entry_result: integer       # 1 successful, 0 missed/unsuccessful
disconnect_reason: integer
sip_call_id: string?
```

#### Правила `to` для цепочки переадресации

- Успешный звонок: `to` = абонент, который ответил.
- Неуспешный/пропущенный: `to` = первый абонент, который пропустил вызов.

### 3.3 `/events/recording` — процесс записи разговора

```text
POST https://external-system.com/events/recording
```

Событие описывает процесс записи: старт, продолжение в другом вызове, завершение.

#### Как может стартовать запись

- По API-команде внешней системы.
- Автоматически по настройкам ВАТС.
- По DTMF-команде с телефона.
- По команде другой внешней системы или интегрированного сервиса Mango Office.

#### Поля

```yaml
recording_id: string
recording_state: string     # Started | Continued | Completed
seq: integer
entry_id: string
call_id: string
extension: string?          # идентификатор записываемого сотрудника
timestamp: timestamp        # UTC+3
completion_code: integer?   # только Completed
recipient: string?          # Cloud | Mail | CloudAndMail, только Completed
command_id: string?         # если запись началась по API-команде
```

#### `recording_state`

```yaml
Started: "Запись начата"
Continued: "Запись продолжена в другом вызове; новый идентификатор указан в call_id"
Completed: "Запись завершена"
```

#### `completion_code`

```yaml
1000: "Успешно"
22xx: "Доступ к счету ограничен"
4002: "Запись короче минимальной длительности, не будет сохранена"
```

#### `recipient`

```yaml
Cloud: "Запись сохранена в облачном хранилище и доступна из ЛК"
Mail: "Запись отправлена на email пользователя"
CloudAndMail: "Сохранена в облаке и отправлена на email"
```

### 3.4 `/events/record/added` — запись готова к скачиванию

```text
POST https://external-system.com/events/record/added
```

Отправляется после помещения записи в облачное хранилище. Это лучший trigger для скачивания записи через API.

```yaml
entry_id: string
product_id: integer
user_id: integer            # employee user_id, Admin user_id или -1
recording_id: string
timestamp: timestamp
```

Возможна задержка: запись иногда не сразу доступна по API даже после окончания разговора.

### 3.5 `/events/record/tagged` — тематики записи готовы

```text
POST https://external-system.com/events/record/tagged
```

Отправляется после распознавания тематик для записи.

```yaml
entry_id: string
product_id: integer
user_id: integer            # employee user_id, Admin user_id или -1
timestamp: timestamp
recording_id: string
```

### 3.6 `/events/dtmf` — DTMF-последовательность

```text
POST https://external-system.com/events/dtmf
```

Отправляется не на каждое нажатие, а после сбора полной значимой DTMF-последовательности в IVR.

```yaml
seq: integer
dtmf: string
timestamp: timestamp        # UTC+3
call_id: string
entry_id: string
location: string            # например ivr.2
initiator: string            # номер абонента, который ввел DTMF
from_number: string?
to_number: string?
line_number: string?
```

`location` имеет вид `[system].[subsystem]...`; для IVR пример: `ivr.2` означает пункт меню 2.

### 3.7 `/events/sms` — статус SMS

Не звонок, но может быть связан с коммуникацией.

```yaml
command_id: string
timestamp: integer
reason: integer             # результат отправки SMS, коды 43xx
```

---

## 4. API статистики звонков

API статистики дает историю вызовов асинхронно:

1. Запустить формирование статистики.
2. Получить `key`.
3. Дождаться события готовности или опрашивать result endpoint.
4. Забрать CSV или JSON.

### 4.1 Базовая статистика — `/vpbx/stats/request`

```text
POST /vpbx/stats/request
```

Формирует базовую статистику. Обязательные параметры: `date_from`, `date_to`. Период выборки не более 1 месяца.

#### Входные параметры

```yaml
date_from: timestamp        # required, unix time, UTC+3, точность до секунды
date_to: timestamp          # required
fields: string?             # список полей ответа и порядок
from:
  extension: string?
  number: string?
to:
  extension: string?
  number: string?
call_party:
  extension: string?
  number: string?
request_id: string?
```

`call_party` нельзя использовать вместе с `to`/`from`.

#### Поля `fields`

По умолчанию:

```text
records,start,finish,answer,from_extension,from_number,to_extension,to_number,disconnect_reason,line_number,location
```

Для связи со realtime обязательно добавлять:

```text
entry_id
```

Доступные поля:

```yaml
records: "Идентификаторы записей разговоров [rec1,rec2,rec3]"
start: "Время начала разговора"
finish: "Время окончания разговора"
answer: "Время ответа; 0 если трубку не сняли"
from_extension: "Идентификатор сотрудника-вызывающего"
from_number: "Номер вызывающего"
to_extension: "Идентификатор сотрудника-вызываемого"
to_number: "Номер вызываемого"
disconnect_reason: "Причина завершения"
entry_id: "Идентификатор группы вызовов"
line_number: "Линия ВАТС"
location: "Расположение вызова при завершении"
create: "Время создания группы вызовов"
```

#### Результат

На `/vpbx/stats/request` приходит:

```json
{ "key": "B+DvIt8hPJReV8v4MYspQQA==" }
```

Далее можно ждать событие:

```text
POST /vpbx/result/stat
```

```yaml
key: string
request_id: string?
```

И забрать данные:

```text
POST /vpbx/stats/result
json = { "key": "..." }
```

HTTP-коды:

```yaml
204: "Данные еще не подготовлены; повторять не чаще 1 раза в 5 сек"
404: "Данные не найдены, key неправильный или устарел"
200: "Данные готовы; тело ответа — CSV"
```

CSV:

```yaml
separator: ";"
row_separator: "\n"
escaping: "не предполагается; значения не должны содержать зарезервированные символы"
```

### 4.2 Расширенная статистика — `/vpbx/stats/calls/request`

```text
POST /vpbx/stats/calls/request/
```

Формирует расширенную статистику в JSON. Обязательные параметры: `start_date`, `end_date`, `limit`, `offset`. Период выборки не более 1 месяца.

#### Фильтры запроса

```yaml
start_date: string          # required, datetime-compatible; если время не указано, 00:00:00
end_date: string            # required
user_ids: integer[]?        # сотрудники, general.user_id из /config/users/request
group_ids: integer[]?       # группы, group_id из /vpbx/groups
context_type: integer|integer[]?
  values:
    1: inbound
    2: outbound
    3: internal
context_status: integer?
  values:
    0: unsuccessful
    1: successful
recall_status: integer?
  values:
    0: unsuccessful_recall
    1: successful_recall
    2: no_recall
search_string: string?      # минимум 3 символа, фильтр по номерам внешним/внутренним
limit: integer              # required: 1,5,10,20,50,100,500,1000,2000,5000
offset: integer             # required
ext_params: integer?        # 0 no, 1 include CC data
ext_fields: string[]?       # e.g. context_cost_full, context_cost_tariff
```

#### Получение результата

1. `POST /vpbx/stats/calls/request/` → `{ "key": "..." }`
2. `POST /vpbx/stats/calls/result/` с `json={"key":"..."}`

#### Верхний уровень ответа

```yaml
result: integer
status: string              # request | work | complete | cancel | error | not-found
data:
  - list: CallContext[]
    period: string?
    total_talks_duration: integer?
    total_calls_duration: integer?
    total_calls_count: integer?
```

#### `CallContext` — объект звонка

```yaml
entry_id: string
context_type: integer       # 1 inbound, 2 outbound, 3 internal
context_status: integer     # 0 unsuccessful, 1 successful
caller_id: integer|null     # user_id сотрудника, если звонил сотрудник
caller_name: string
caller_number: string
called_number: string
context_start_time: integer # UTC timestamp
duration: integer           # длительность звонка, sec
talk_duration: integer      # длительность разговора, sec
context_cost_full: number?  # стоимость всего звонка, если ext_fields
context_cost_tariff: number?# стоимость без услуг, если ext_fields
context_init_type: integer  # инициатор звонка
recall_status: integer      # 0/1/2
cost: number
conversion: object?         # данные обращения КЦ, если ext_params=1
tag_id: integer[]?          # ID тематик
call_comment: string?       # комментарий
script_id: integer[]?       # ID скриптов КЦ
mark_client: integer|null?  # постзвонковая оценка клиента
mark_controller: object?    # оценка контролера
context_calls: CallLeg[]    # плечи вызова
```

#### `context_init_type`

```yaml
0: "Звонок пользователя с любого устройства"
1: "Звонок пользователя с SIP на номер"
2: "Звонок пользователя на SIP"
3: "Звонок пользователя с Контакт-центра"
4: "Заказ звонка"
5: "Заказ звонка через виджет"
6: "Обратный звонок и автоперезвоны на группу"
```

#### `conversion` — данные обращения, если запрошены данные КЦ

```yaml
conversion_id: integer
channel_type: integer       # 0 unknown, 1 call, 2 Site, 3 VK, 4 Facebook, 5 Viber, 6 Telegram, 7 SMS, 8 Email, 9 WhatsApp, 10 dialogs
create: timestamp
end: timestamp
result: integer             # 1 processed, 2 transferred, 3 timeout, 4 no answer, 5 spam, 6 sending forbidden
assign_user_id: integer
close_user_id: integer
contact_id: integer
first_answer: timestamp
start: timestamp            # взятие обращения в работу
entry_point: string         # для звонка — номер, на который пришел входящий вызов
group_id: integer
deal_id: integer
params: integer             # битовая маска направления/автоматичности/триггерности
```

#### `CallLeg` — плечо вызова

```yaml
call_type: string           # number | user | group | conference
call_abonent_id: integer    # group_id или user_id в зависимости от call_type
call_abonent_info: string   # текстовое описание абонента
call_abonent_number: string|null # номер/SIP-учетка, на котором сотрудник принимал звонок
call_start_time: integer    # UTC timestamp
call_answer_time: integer|null
call_end_time: integer
call_duration: integer      # sec
talk_duration: integer      # sec
dial_duration: integer      # sec
hold_duration: integer|null # sec
call_end_reason: integer
recording_id: string[]      # массив id записей разговора
external_call_id: string    # внутренний id плеча, сопоставим с call_id
DirectionInbound: boolean
DirectionOutbound: boolean
ModeConversation: boolean
ModeListen: boolean
ModePrompt: boolean
ModeConference: boolean
ModeGroup: boolean
RecordInbound: boolean
RecordOutbound: boolean
BlindTransfer: boolean
ConsultTransfer: boolean
OutboundDialing: boolean
Intercepted: boolean
IvrNotUsed: boolean         # в документе описано как признак использования голосового меню; по имени вероятно true = IVR не использован
members: CallLeg[]|null     # для call_type=group структура аналогична context_calls
```

#### Важное для агента

- Расширенная статистика — лучший источник для batch-обогащения звонков: есть плечи, записи, transfer/hold/IVR flags, обзвон, стоимость, КЦ-данные.
- Для realtime-архитектуры: сначала принимать события, затем периодически сверять/обогащать через расширенную статистику.
- Если нужны записи, брать `recording_id` из `context_calls[].recording_id` и/или из `/events/record/added`.

---

## 5. Получение записей разговоров

### 5.1 Условия

- Для работы с расшифровками нужна услуга «Речевая аналитика».
- Записи должны храниться в «Облачном хранилище» ВАТС.
- После окончания разговора запись сохраняется не мгновенно. Если запись недоступна, повторять запрос с интервалом примерно 1 минута.
- Если запись удалена в ЛК, через API получить ее нельзя.
- `recording_id` можно получить из статистики или events recording/record added.

### 5.2 Безопасный способ: POST `/vpbx/queries/recording/post`

```text
POST /vpbx/queries/recording/post
```

```yaml
recording_id: string
action: string              # download | play
```

Ответ: HTTP 302 Redirect на временную ссылку `files.mango-office.ru`; затем GET временной ссылки возвращает аудио.

```yaml
content_type_examples:
  - audio/mp3
  - audio/mpeg
note: "Redirect-ссылки временные, после первого доступа недействительны; их нельзя сохранять как постоянные ссылки."
```

### 5.3 GET без авторизации: `/vpbx/queries/recording/link/...`

```text
GET /vpbx/queries/recording/link/[recording_id]/[action]/[vpbx_api_key]/[timestamp]/[sign]
```

Эта возможность по умолчанию выключена и требует явного включения в ЛК.

```yaml
recording_id: string
action: download|play
timestamp: timestamp        # UTC+3, время, до которого ссылка действует
vpbx_api_key: string
sign: sha256(vpbx_api_key + timestamp + recording_id + vpbx_api_salt)
```

### 5.4 Через авторизацию ЛК: `/vpbx/queries/recording/issa/...`

```text
GET /vpbx/queries/recording/issa/[recording_id]/[action]
```

API делает redirect в ЛК. Пользователь должен иметь права на запись. Временные ссылки не сохранять.

---

## 6. Речевая аналитика: тематики, транскрипты, summary

### 6.1 Тематики записи — `/vpbx/queries/recording_categories`

```text
POST /vpbx/queries/recording_categories
```

```yaml
recording_id: string        # массив id записей, упакованный строкой в примерах
with_terms: boolean?        # добавить стоп-слова/термы, на которые сработала тематика
with_names: boolean?        # добавить имя тематики из БД
```

Ответ:

```yaml
result: integer
data:
  - recording_id: string
    categories:
      - terms:
          - channels: integer[] # -1 left stereo, 0 mono, 1 right stereo
            count: integer
            value: string       # распознанное ключевое слово/терм
        id: integer             # id тематики в БД
        assign_time: timestamp  # UTC
        version: integer
        name: string
```

### 6.2 Расшифровки записей — `/vpbx/queries/recording_transcripts`

```text
POST /vpbx/queries/recording_transcripts
```

```yaml
recording_id: string[]      # массив идентификаторов записей, не более 500
```

Ответ:

```yaml
result: integer
data:
  - recording_id: string
    names:
      client: string
      operator: string
    phrases:
      - [speaker, text]      # speaker обычно client|operator
```

Правила именования:

```yaml
if_both_members_known:
  client: "имя сотрудника или Канал 1"
  operator: "имя сотрудника или Канал 2"
if_both_unknown:
  client: "Канал 1"
  operator: "Канал 2"
otherwise:
  client: "Клиент"
  operator: "Сотрудник"
```

### 6.3 Конспект/summary разговора — `/s2t/queries/recording_summary`

```text
POST /s2t/queries/recording_summary
```

```yaml
communication_id: string
```

Ответ:

```yaml
result: integer
data:
  - communication_id: string
    summary: string
```

Работает только если используется Речевая аналитика.

### 6.4 Записи с расшифровками звонков — `/s2t/queries/records`

```text
POST /s2t/queries/records
```

Параметры:

```yaml
date_from: string           # required
date_to: string             # required
offset: integer?
limit: integer?
# В примере body также может содержать number, например {"number":"74951112233"}
```

Ответ:

```yaml
result: integer
data:
  - communication_id: string
    communication_type: integer
    info:
      direction: string|integer
      duration: integer
      time_created: timestamp
      from_number: string
      to_number: string
    sentiments:
      client: string|null
      operator: string|null
    has_s2t: boolean
    has_transcript: boolean
    has_summary: boolean
```

---

## 7. API для оффлайн-загрузки аудио и распознавания

Используется для оффлайн-скоринга и распознавания речи в файлах.

### 7.1 С привязкой к сотруднику: `/vpbx/offline_record/recognize`

```text
POST /vpbx/offline_record/recognize
Content-Type: multipart/form-data
```

Назначение:

- загрузить звуковой файл в ВАТС;
- привязать к сотруднику по `member_id` или `device_code`;
- сохранить в облачное хранилище, если оно подключено;
- создать задание в сервисе речевой аналитики.

Требуются услуги:

```yaml
required_services:
  - "Речевая аналитика"
  - "Распознавание разговоров"
  - "Офлайн-скоринг"
recommended_services:
  - "Облачное хранилище ВАТС"
```

Требования к файлу из раздела 3.10.1:

```yaml
format: "WAV, несжатый аудиопоток"
max_size: "100 MB"
max_filename_length: "64 latin chars"
```

Пример JSON-части:

```json
{
  "member_id": "10090397",
  "created": "2022-02-07 14:27:00",
  "member_channel": "-1"
}
```

Ответ:

```yaml
result: integer
request_id: integer?
```

Коды:

```yaml
1000: "Успешно"
3103: "Отсутствует обязательный параметр"
3104: "Неверный формат параметра"
3109: "Значение больше ожидаемого / файл больше лимита"
3129: "Неверная канальность аудиозаписи, например одноканальная запись"
3300: "member_id или device_code не найдены"
5000: "Ошибка сервера"
5008: "Услуга недоступна"
5228: "Превышен лимит сотрудников, ограничение 5000"
413: "Request Entity Too Large — POST данные/файл больше ограничений метода"
```

### 7.2 Без сохранения и без привязки к сотруднику: `/vpbx/record/recognize`

```text
POST /vpbx/record/recognize
Content-Type: multipart/form-data
```

Назначение: загрузить аудио для распознавания без сохранения в хранилище ВАТС и без привязки к сотруднику.

Требования к файлу в описании метода:

```yaml
formats: ["wav", "mp3", "mp4", "ogg"]
bitrate_min: "128 kbps"
max_size: "100 MB"
filename: "latin only"
max_filename_length: 64
```

Ответ:

```yaml
request_id: integer
result: integer
```

### 7.3 Событие завершения оффлайн-распознавания — `/events/recognized/offline`

```text
POST /events/recognized/offline
```

Может приходить с задержкой до 60 секунд.

```yaml
product_id: integer
request_id: string|integer
recognized: integer?        # время завершения распознавания
result: integer
message: string?            # обязательно если result != 1000
```

### 7.4 Получить результат оффлайн-распознавания — `/vpbx/transcribes/tasks/`

```text
POST /vpbx/transcribes/tasks/
```

```yaml
request_ids: string[]|integer[]
```

Ответ:

```yaml
result: integer
data:
  <request_id>:
    status: string           # e.g. ready
    time_created: integer
    time_updated: integer
    transcribes:
      - channel: string|integer # e.g. client
        data:
          - word: string?
            begin: number
            end: number
```

---

## 8. Сквозная аналитика и коллтрекинг

Работает только при использовании динамического коллтрекинга.

Realtime `/events/call` может содержать блок:

```yaml
dct:
  number: string             # номер коллтрекинга
  type: integer
```

`dct.type`:

```yaml
0: "Не относится к коллтрекингу"
1: "Динамический номер"
2: "Статический номер"
```

В расширенной статистике полезны поля:

```yaml
called_number: "номер, на который звонят"
caller_number: "номер звонящего"
entry_point: "в данных обращения КЦ — для звонка это номер, на который пришел входящий вызов"
```

Для полного маркетингового контекста в документе также есть методы:

```text
/vpbx/queries/dct/visitor
/vpbx/queries/dct/navigation_history
```

Их использовать, если нужен посетитель сайта и история навигации по динамическому номеру.

---

## 9. Команды управления звонком

Эти методы нужны не для выгрузки метаданных, но агенту полезно знать их как источники `command_id` и как способы управления звонками.

### 9.1 Инициировать исходящий вызов от сотрудника

```text
POST /vpbx/commands/callback
```

```yaml
command_id: string
from:
  extension: string          # required, внутренний номер сотрудника
  number: string?            # конкретный номер/SIP/FMC/PSTN сотрудника
to_number: string
line_number: string?         # имя линии, если нужно явно выбрать линию
sip_headers:
  Call-Info/answer-after: string?
```

Результат приходит на:

```text
POST /vpbx/result/callback
```

```yaml
command_id: string?
result: integer              # 1000 success, 2xxx billing, 3100 invalid params, 4001 unsupported, 5xxx server
```

### 9.2 Инициировать исходящий вызов от группы

```text
POST /vpbx/commands/callback_group
```

```yaml
command_id: string
from: string                 # внешний номер или короткий номер группы
to: string                   # внешний номер или короткий номер группы
line_number: string          # required
```

Правило:

- `from` внешний, `to` группа: сначала звонок клиенту, затем дозвон группе.
- `from` группа, `to` внешний: сначала дозвон группе, затем внешний номер.

### 9.3 Завершить вызов

```text
POST /vpbx/commands/call/hangup
```

```yaml
command_id: string
call_id: string
```

Выполняется, если вызов находится `location=ivr` или `location=abonent`.

### 9.4 Включить запись разговора

```text
POST /vpbx/commands/recording/start
```

```yaml
command_id: string
call_id: string
call_party_number: string    # предпочтительно внутренний номер сотрудника; можно номер сотрудника из настроек ВАТС
```

Результат:

```text
POST /vpbx/result/recording/start
```

После фактического старта придет `/events/recording` со `recording_state=Started`.

### 9.5 Маршрутизировать вызов

```text
POST /vpbx/commands/route
```

Меняет маршрут вызова, который еще не распределен сотруднику, находится в IVR/очереди, или перехватывает вызов на сотрудника до ответа (`Appeared`).

```yaml
command_id: string
call_id: string
to_number: string            # сотрудник, группа, SIP, FMC, PSTN
sip_headers:
  From/display-name: string?
```

Режимы:

- `to_number` = внутренний номер сотрудника: применяются настройки карточки сотрудника.
- `to_number` = группа: маршрутизация по алгоритму группы.
- `to_number` = SIP/FMC/PSTN: безусловное перенаправление.

### 9.6 Перевод вызова

```text
POST /vpbx/commands/transfer
```

```yaml
command_id: string
call_id: string
method: string               # blind | hold
to_number: string
initiator: string            # один из from.extension/from.number/to.extension/to.number переводимого вызова; должен быть сотрудником ВАТС
```

- `blind` — слепой перевод.
- `hold` — консультативный перевод.

### 9.7 Соединить OnHold и Connected плечи

```text
POST /commands/calls_connect
```

```yaml
command_id: string
holded_call_id: string
transfer_initiator_number: string
transferred_call_id: string
```

`holded_call_id` и `transferred_call_id` должны иметь одинаковый `entry_id`.

### 9.8 Отменить перевод

```text
POST /commands/transfer_cancel
```

```yaml
command_id: string
call_id: string              # из события call_state=OnHold
```

### 9.9 Поставить вызов на удержание

```text
POST /commands/call/hold/on
```

```yaml
command_id: string
call_id: string
initiator: string            # from.extension/from.number/to.extension/to.number; сотрудник ВАТС
```

---

## 10. Конфигурационные методы, нужные для обогащения звонков

Минимальный набор справочников, который агенту стоит периодически обновлять:

```yaml
users:
  endpoint: "POST /config/users/request"
  purpose: "Получить сотрудников ВАТС; связывать general.user_id и extension с именем, SIP, номером, ролью."

groups:
  endpoint: "POST /vpbx/groups"
  purpose: "Получить группы; связывать group_id и внутренние номера групп."

numbers:
  endpoint: "POST /vpbx/config/numbers или раздел 3.7.7 Получение списка номеров ВАТС"
  purpose: "Связывать line_number/called_number с линиями ВАТС."

sip_accounts:
  endpoint: "POST /vpbx/config/sip или раздел 3.7.17 Получить sip учетные записи сотрудников"
  purpose: "Связывать SIP-адреса с сотрудниками и устройствами."

sip_trunks:
  endpoint: "раздел 3.7.22 Запрос номеров sip-trunk'ов"
  purpose: "Связывать SIP trunk номера и линии."
```

Названия endpoint для некоторых config-методов в оглавлении могут отличаться от фактических URL внутри раздела 3.7; перед реализацией сверить точные URL в соответствующем разделе PDF.

---

## 11. Нормализованная модель данных для агента

### 11.1 Таблица/коллекция `calls`

```json
{
  "entry_id": "string",
  "sip_call_id": "string|null",
  "direction": "inbound|outbound|internal|unknown",
  "status": "success|missed|unknown",
  "caller": {
    "user_id": 123,
    "extension": "123",
    "name": "string|null",
    "number": "string|null"
  },
  "callee": {
    "user_id": 456,
    "group_id": 789,
    "extension": "456",
    "name": "string|null",
    "number": "string|null"
  },
  "line_number": "string|null",
  "dct": {
    "number": "string|null",
    "type": "none|dynamic|static|null"
  },
  "times": {
    "created_at": "timestamp|null",
    "forwarded_at": "timestamp|null",
    "answered_at": "timestamp|null",
    "ended_at": "timestamp|null",
    "duration_sec": 0,
    "talk_duration_sec": 0
  },
  "result": {
    "entry_result": 1,
    "disconnect_reason": 1100,
    "call_end_reason": 1110
  },
  "cost": {
    "total": 0,
    "tariff": 0
  },
  "flags": {
    "has_recording": true,
    "has_transcript": false,
    "has_summary": false,
    "has_categories": false,
    "outbound_dialing": false,
    "callback": false,
    "ivr_used": true,
    "transferred": false,
    "blind_transfer": false,
    "consult_transfer": false,
    "intercepted": false
  },
  "source": {
    "realtime_seen": true,
    "summary_seen": true,
    "stats_enriched": true,
    "last_event_seq": 10
  }
}
```

### 11.2 Таблица/коллекция `call_legs`

```json
{
  "entry_id": "string",
  "call_id": "string|null",
  "external_call_id": "string|null",
  "call_type": "number|user|group|conference",
  "abonent_id": 123,
  "abonent_info": "string|null",
  "abonent_number": "string|null",
  "start_time": "timestamp|null",
  "answer_time": "timestamp|null",
  "end_time": "timestamp|null",
  "call_duration_sec": 0,
  "talk_duration_sec": 0,
  "dial_duration_sec": 0,
  "hold_duration_sec": 0,
  "call_end_reason": 1110,
  "recording_ids": ["string"],
  "flags": {
    "DirectionInbound": false,
    "DirectionOutbound": true,
    "ModeConversation": true,
    "ModeListen": false,
    "ModePrompt": false,
    "ModeConference": false,
    "ModeGroup": false,
    "RecordInbound": true,
    "RecordOutbound": false,
    "BlindTransfer": false,
    "ConsultTransfer": false,
    "OutboundDialing": false,
    "Intercepted": false,
    "IvrNotUsed": true
  }
}
```

### 11.3 Таблица/коллекция `recordings`

```json
{
  "recording_id": "string",
  "entry_id": "string|null",
  "call_id": "string|null",
  "product_id": 123,
  "user_id": 456,
  "extension": "123|null",
  "state": "Started|Continued|Completed|Added|Tagged|Downloaded|Error",
  "recipient": "Cloud|Mail|CloudAndMail|null",
  "completion_code": 1000,
  "created_at": "timestamp|null",
  "ready_at": "timestamp|null",
  "download": {
    "available": true,
    "method": "post|temporary_get|lk_auth",
    "content_type": "audio/mpeg|null",
    "local_path": "string|null"
  },
  "speech": {
    "categories_ready": false,
    "transcript_ready": false,
    "summary_ready": false
  }
}
```

### 11.4 Таблица/коллекция `transcripts`

```json
{
  "recording_id": "string|null",
  "communication_id": "string|null",
  "names": {
    "client": "string|null",
    "operator": "string|null"
  },
  "phrases": [
    { "speaker": "client|operator|channel", "text": "...", "order": 0 }
  ],
  "words": [
    { "channel": "client", "word": "...", "begin": 1.94, "end": 2.2 }
  ],
  "summary": "string|null",
  "categories": [
    {
      "id": 1688,
      "name": "Тематика",
      "assign_time": 1561883955,
      "version": 7,
      "terms": [
        { "value": "Трубка", "count": 5, "channels": [-1] }
      ]
    }
  ]
}
```

---

## 12. Рекомендуемый workflow для ИИ-агента

### 12.1 Realtime ingestion

1. Поднять HTTPS endpoint внешней системы.
2. Allowlist Mango IP.
3. Проверять подпись каждого входящего события.
4. Для `/events/call`:
   - сохранить `entry_id`, `call_id`, `seq`, `call_state`, `from`, `to`, `location`, `dct`, `transfer`, `callback_initiator`;
   - если для `call_id` уже есть event с большим `seq`, игнорировать старое событие.
5. Для `/events/summary`:
   - пометить звонок завершенным;
   - заполнить итоговые времена, направление, результат, disconnect_reason.
6. Для `/events/recording`:
   - создать/обновить запись по `recording_id`;
   - при `Completed` сохранить `completion_code` и `recipient`.
7. Для `/events/record/added`:
   - пометить запись готовой;
   - поставить задачу на скачивание записи.
8. Для `/events/record/tagged`:
   - поставить задачу на получение тематик.
9. Для `/events/dtmf`:
   - сохранять DTMF как события внутри `entry_id`/`call_id`.

### 12.2 Batch enrichment через расширенную статистику

Запускать периодически, например каждые 5-15 минут для недавних звонков и раз в сутки для сверки:

1. `POST /vpbx/stats/calls/request/` за окно не более месяца.
2. Poll `/vpbx/stats/calls/result/` по `key`.
3. Для каждого `entry_id`:
   - обновить call summary;
   - upsert `context_calls` как legs;
   - сохранить `recording_id` массивы;
   - обогатить стоимость, оценки, КЦ conversion, теги, скрипты.

### 12.3 Recording + Speech pipeline

1. Получить `recording_id` из `/events/record/added` или статистики.
2. Скачать через `POST /vpbx/queries/recording/post` с `action=download`.
3. После успешного сохранения:
   - запросить тематики `/vpbx/queries/recording_categories`;
   - запросить расшифровку `/vpbx/queries/recording_transcripts`;
   - если доступен `communication_id`, запросить summary `/s2t/queries/recording_summary`.
4. Если запись/транскрипт еще не готова — retry с backoff, начальный интервал ~60 секунд.

### 12.4 Offline audio pipeline

1. Загрузить файл:
   - с привязкой к сотруднику: `/vpbx/offline_record/recognize`;
   - без сохранения/привязки: `/vpbx/record/recognize`.
2. Сохранить `request_id`.
3. Дождаться `/events/recognized/offline`.
4. Получить слова и тайминги через `/vpbx/transcribes/tasks/`.

---

## 13. Практические правила и ловушки

1. `entry_id` — основной ключ звонка, не `call_id`.
2. `call_id` — ключ плеча; он может меняться при переводах.
3. `seq` обязателен для правильной обработки realtime-событий.
4. `recording_id` может быть массивом: один звонок или группа могут иметь несколько записей.
5. Не сохранять временные ссылки на файлы; сохранять только `recording_id` и локальную копию, если политика это разрешает.
6. После события завершения звонка запись может быть не готова. Надежный trigger — `/events/record/added`.
7. Для batch-выгрузки истории лучше использовать расширенную статистику, а не только базовую CSV.
8. Для связи с внешней SIP-системой использовать `sip_call_id`, но он требует включенного флага в ЛК.
9. В basic stats явно указывать `entry_id` в `fields`, иначе связка с realtime будет слабее.
10. Период выборки stats ограничен 1 месяцем.
11. Для речевой аналитики и оффлайн-скоринга нужны подключенные услуги; ошибки 5008/5201 часто означают недоступность/неподключенность услуги.
12. При ошибке 401 после неверных запросов ждать 2 минуты и исправлять подпись/параметры, не ретраить агрессивно.
13. При 429 снижать частоту запросов.

---

## 14. Минимальный набор endpoint для реализации выгрузки звонков

```yaml
must_have:
  realtime:
    - POST /events/call
    - POST /events/summary
    - POST /events/recording
    - POST /events/record/added
  stats:
    - POST /vpbx/stats/calls/request/
    - POST /vpbx/stats/calls/result/
  recording:
    - POST /vpbx/queries/recording/post
  speech:
    - POST /vpbx/queries/recording_transcripts
    - POST /vpbx/queries/recording_categories

nice_to_have:
  realtime:
    - POST /events/dtmf
    - POST /events/record/tagged
  speech:
    - POST /s2t/queries/records
    - POST /s2t/queries/recording_summary
  offline:
    - POST /vpbx/offline_record/recognize
    - POST /vpbx/record/recognize
    - POST /events/recognized/offline
    - POST /vpbx/transcribes/tasks/
  commands:
    - POST /vpbx/commands/callback
    - POST /vpbx/commands/call/hangup
    - POST /vpbx/commands/recording/start
    - POST /vpbx/commands/route
    - POST /vpbx/commands/transfer
```

---

## 15. Prompt для агента-реализатора

```text
Ты реализуешь интеграцию Mango Office VPBX API для выгрузки звонков, записей и речевой аналитики.
Используй entry_id как главный идентификатор звонка, call_id/external_call_id как идентификатор плеча, recording_id как идентификатор записи.
Принимай realtime events: /events/call, /events/summary, /events/recording, /events/record/added, /events/record/tagged, /events/dtmf.
Сортируй /events/call по seq внутри call_id.
После /events/summary помечай звонок завершенным.
После /events/record/added скачивай запись через POST /vpbx/queries/recording/post.
Для batch-обогащения используй /vpbx/stats/calls/request/ и /vpbx/stats/calls/result/ с окном не более 1 месяца.
Для речевой аналитики получай /vpbx/queries/recording_transcripts, /vpbx/queries/recording_categories и, если есть communication_id, /s2t/queries/recording_summary.
Все POST-запросы подписывай sign = sha256(vpbx_api_key + json + vpbx_api_salt), а GET recording/link подписывай sign = sha256(vpbx_api_key + timestamp + recording_id + vpbx_api_salt).
Не сохраняй временные redirect-ссылки на файлы. Храни recording_id и локальный путь к скачанному аудио.
Соблюдай лимиты API и делай backoff при 204, 429, 503, 5008.
```
