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

const INITIAL: Notification[] = []

export const useNotificationsStore = create<NotificationsState>((set) => ({
    notifications: INITIAL,
    markAsRead: (id) =>
        set((s) => ({
            notifications: s.notifications.map((n) => n.id === id ? { ...n, isRead: true } : n),
        })),
    markAllAsRead: () =>
        set((s) => ({
            notifications: s.notifications.map((n) => ({ ...n, isRead: true })),
        })),
    remove: (id) =>
        set((s) => ({
            notifications: s.notifications.filter((n) => n.id !== id),
        })),
    removeAll: () => set({ notifications: [] }),
}))
