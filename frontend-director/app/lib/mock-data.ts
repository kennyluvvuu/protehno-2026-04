export interface MockRecord {
    id: number
    name: string
    callTo: string
    phone: string
    agentName: string
    durationSec: number
    qualityScore: number
    date: string
    transcription: string
    summary: string
    promises: string[]
    tasks: string[]
    agreements: string[]
    status: "success" | "failed" | "processing"
}

export const MOCK_RECORDS: MockRecord[] = [
    {
        id: 1,
        name: "Переговоры с ООО Альфа",
        callTo: "ООО Альфа",
        phone: "+7 (495) 123-45-67",
        agentName: "Иванов А.",
        durationSec: 342,
        qualityScore: 87,
        date: "2026-04-24",
        transcription: "— Добрый день, меня зовут Алексей...\n— Здравствуйте, чем могу помочь?\n— Мы хотели бы обсудить условия поставки...",
        summary: "Обсуждение условий поставки оборудования на Q2 2026. Клиент заинтересован в скидке при объёме от 50 единиц.",
        promises: ["Выслать КП до пятницы", "Согласовать скидку с руководством"],
        tasks: ["Подготовить коммерческое предложение", "Уточнить сроки поставки"],
        agreements: ["Встреча на следующей неделе", "Объём от 50 единиц — скидка 8%"],
        status: "success",
    },
    {
        id: 2,
        name: "Холодный звонок — ИП Смирнов",
        callTo: "ИП Смирнов",
        phone: "+7 (912) 456-78-90",
        agentName: "Петрова М.",
        durationSec: 78,
        qualityScore: 45,
        date: "2026-04-24",
        transcription: "— Добрый день, это Мария из Connectio...\n— Нет, спасибо, нам не интересно.\n— Подождите, я хотела бы...",
        summary: "Клиент отказался от продолжения разговора. Рекомендуется повторный звонок через 3 месяца.",
        promises: [],
        tasks: ["Поставить напоминание на повторный звонок через 3 мес."],
        agreements: [],
        status: "failed",
    },
    {
        id: 3,
        name: "Сопровождение — ЗАО Технолог",
        callTo: "ЗАО Технолог",
        phone: "+7 (383) 210-33-44",
        agentName: "Козлов Д.",
        durationSec: 620,
        qualityScore: 92,
        date: "2026-04-23",
        transcription: "— Алло, Дмитрий, добрый день...\n— Да, слушаю...\n— Хотим обсудить расширение договора...",
        summary: "Успешное обсуждение расширения действующего договора. Клиент готов увеличить объём закупок на 30%.",
        promises: ["Выслать дополнительное соглашение до 28 апреля"],
        tasks: ["Подготовить доп. соглашение", "Согласовать с юристами"],
        agreements: ["Увеличение объёма на 30%", "Пролонгация договора на 1 год"],
        status: "success",
    },
    {
        id: 4,
        name: "Первичный контакт — ООО Промстрой",
        callTo: "ООО Промстрой",
        phone: "+7 (495) 987-65-43",
        agentName: "Иванов А.",
        durationSec: 195,
        qualityScore: 71,
        date: "2026-04-23",
        transcription: "— Здравствуйте, я по поводу вашего запроса на сайте...\n— А, да, нам нужно уточнить детали...",
        summary: "Первичный контакт по входящей заявке. Требуется дополнительная квалификация потребности.",
        promises: ["Перезвонить с техническими характеристиками"],
        tasks: ["Уточнить технические требования", "Назначить встречу с инженером"],
        agreements: ["Следующий звонок в четверг в 11:00"],
        status: "success",
    },
    {
        id: 5,
        name: "Рекламация — ИП Фролова",
        callTo: "ИП Фролова",
        phone: "+7 (926) 111-22-33",
        agentName: "Петрова М.",
        durationSec: 480,
        qualityScore: 58,
        date: "2026-04-22",
        transcription: "— Добрый день, у нас проблема с последней партией...\n— Расскажите подробнее, пожалуйста...",
        summary: "Клиент предъявил рекламацию по качеству товара. Требуется передача в отдел качества.",
        promises: ["Ответ от отдела качества в течение 2 рабочих дней"],
        tasks: ["Передать рекламацию в отдел качества", "Выслать форму акта"],
        agreements: ["Компенсация или замена товара по результатам проверки"],
        status: "processing",
    },
    {
        id: 6,
        name: "Апсейл — ООО ГазПром Инвест",
        callTo: "ООО ГазПром Инвест",
        phone: "+7 (499) 555-00-11",
        agentName: "Козлов Д.",
        durationSec: 890,
        qualityScore: 95,
        date: "2026-04-22",
        transcription: "— Добрый день, Дмитрий. Есть отличное предложение...\n— О, расскажите...",
        summary: "Успешный апсейл на расширенный пакет услуг. Клиент согласился на демо в следующую пятницу.",
        promises: ["Провести демонстрацию нового модуля 2 мая"],
        tasks: ["Подготовить демо-стенд", "Выслать повестку встречи"],
        agreements: ["Демонстрация 2 мая в 14:00", "Принятие решения по итогам демо"],
        status: "success",
    },
]

export const WEEKLY_CALLS = [
    { day: "Пн", calls: 12, success: 9 },
    { day: "Вт", calls: 18, success: 14 },
    { day: "Ср", calls: 15, success: 11 },
    { day: "Чт", calls: 22, success: 19 },
    { day: "Пт", calls: 20, success: 15 },
    { day: "Сб", calls: 6, success: 5 },
    { day: "Вс", calls: 3, success: 3 },
]

export const QUALITY_DISTRIBUTION = [
    { range: "0–40", count: 3, fill: "#ef4444" },
    { range: "41–60", count: 8, fill: "#f97316" },
    { range: "61–75", count: 14, fill: "#eab308" },
    { range: "76–90", count: 22, fill: "#22c55e" },
    { range: "91–100", count: 9, fill: "#3b82f6" },
]

export const AGENT_STATS = [
    { name: "Иванов А.", calls: 28, avgScore: 79 },
    { name: "Петрова М.", calls: 22, avgScore: 62 },
    { name: "Козлов Д.", calls: 35, avgScore: 88 },
]
