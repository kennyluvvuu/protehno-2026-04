import { create } from "zustand"

export interface Notification {
    id: number
    title: string
    message: string
    isRead: boolean
    createdAt: string
}

interface NotificationsState {
    notifications: Notification[]
    markAsRead: (id: number) => void
    markAllAsRead: () => void
    remove: (id: number) => void
    removeAll: () => void
}

const INITIAL: Notification[] = [
    {
        id: 1,
        title: "Новая запись",
        message: "Менеджер Иванов А. загрузил звонок «ООО Альфа»",
        isRead: false,
        createdAt: "2026-04-25 10:42",
    },
    {
        id: 2,
        title: "Низкое качество",
        message: "Звонок «ИП Смирнов» получил оценку 45% — ниже порога",
        isRead: false,
        createdAt: "2026-04-25 09:18",
    },
    {
        id: 3,
        title: "Новая загрузка",
        message: "Файл «Лид-обзвон 24.04» поставлен в очередь обработки",
        isRead: false,
        createdAt: "2026-04-24 17:05",
    },
    {
        id: 4,
        title: "Рекламация",
        message: "Зафиксирована рекламация по звонку «ИП Фролова»",
        isRead: true,
        createdAt: "2026-04-24 15:30",
    },
    {
        id: 5,
        title: "Сервер",
        message: "Health check прошёл успешно — все системы работают штатно",
        isRead: true,
        createdAt: "2026-04-24 12:00",
    },
    {
        id: 6,
        title: "Апсейл завершён",
        message: "Подтверждена демонстрация с ООО ГазПром Инвест на 2 мая",
        isRead: true,
        createdAt: "2026-04-23 16:45",
    },
]

export const useNotificationsStore = create<NotificationsState>((set) => ({
    notifications: INITIAL,
    markAsRead: (id) =>
        set((state) => ({
            notifications: state.notifications.map((n) =>
                n.id === id ? { ...n, isRead: true } : n,
            ),
        })),
    markAllAsRead: () =>
        set((state) => ({
            notifications: state.notifications.map((n) => ({
                ...n,
                isRead: true,
            })),
        })),
    remove: (id) =>
        set((state) => ({
            notifications: state.notifications.filter((n) => n.id !== id),
        })),
    removeAll: () => set({ notifications: [] }),
}))
