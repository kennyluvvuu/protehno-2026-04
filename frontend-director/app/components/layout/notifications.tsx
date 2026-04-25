import { Bell, Check, CheckCheck, Trash2, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { Button } from "~/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog"
import { useNotificationsStore, type Notification } from "~/stores/useNotificationsStore"
import { cn } from "~/lib/utils"

function NotificationItem({
    n,
    onRead,
    onDelete,
}: {
    n: Notification
    onRead: () => void
    onDelete: () => void
}) {
    return (
        <div className={cn(
            "flex items-start gap-3 rounded-lg p-3 transition-colors",
            n.isRead
                ? "opacity-50"
                : "bg-neutral-50 dark:bg-neutral-800/60",
        )}>
            <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-tight">{n.title}</p>
                <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400 leading-snug">{n.message}</p>
                <p className="mt-1 text-[10px] text-neutral-400">{n.createdAt}</p>
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
                {!n.isRead && (
                    <button
                        type="button"
                        onClick={onRead}
                        title="Прочитать"
                        className="flex size-7 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-neutral-200 hover:text-neutral-700 dark:hover:bg-neutral-700 dark:hover:text-neutral-200"
                    >
                        <Check className="size-3.5" />
                    </button>
                )}
                <button
                    type="button"
                    onClick={onDelete}
                    title="Удалить"
                    className="flex size-7 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                >
                    <X className="size-3.5" />
                </button>
            </div>
        </div>
    )
}

function NotificationsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
    const { notifications, markAsRead, markAllAsRead, remove, removeAll } = useNotificationsStore()
    const unreadCount = notifications.filter((n) => !n.isRead).length

    return (
        <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="w-[min(520px,calc(100%-2rem))] max-w-none p-0 gap-0 [&>button:last-child]:hidden">
                <DialogHeader className="flex flex-row items-center justify-between border-b border-neutral-200 dark:border-neutral-800 px-5 py-4">
                    <DialogTitle className="text-base font-semibold">
                        Уведомления
                        {unreadCount > 0 && (
                            <span className="ml-2 inline-flex size-5 items-center justify-center rounded-full bg-neutral-800 text-[11px] text-white dark:bg-neutral-200 dark:text-neutral-900">
                                {unreadCount}
                            </span>
                        )}
                    </DialogTitle>
                    <div className="flex items-center gap-1">
                        {unreadCount > 0 && (
                            <Button variant="ghost" size="sm" onClick={markAllAsRead} className="h-8 gap-1.5 text-xs">
                                <CheckCheck className="size-3.5" />
                                Прочитать все
                            </Button>
                        )}
                        {notifications.length > 0 && (
                            <Button variant="ghost" size="sm" onClick={removeAll} className="h-8 gap-1.5 text-xs text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30">
                                <Trash2 className="size-3.5" />
                                Удалить все
                            </Button>
                        )}
                    </div>
                </DialogHeader>

                <div className="max-h-[60vh] overflow-y-auto p-3">
                    {notifications.length === 0 ? (
                        <div className="flex flex-col items-center gap-2 py-14 text-center">
                            <Bell className="size-8 text-neutral-300" />
                            <p className="text-sm text-neutral-500">Нет уведомлений</p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-1">
                            {notifications.map((n) => (
                                <NotificationItem
                                    key={n.id}
                                    n={n}
                                    onRead={() => markAsRead(n.id)}
                                    onDelete={() => remove(n.id)}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}

export function NotificationsBell(): React.ReactElement {
    const [panelOpen, setPanelOpen] = useState(false)
    const [modalOpen, setModalOpen] = useState(false)
    const { notifications, markAsRead, remove } = useNotificationsStore()
    const containerRef = useRef<HTMLDivElement>(null)

    const unreadCount = notifications.filter((n) => !n.isRead).length
    const latest = notifications.slice(0, 3)

    useEffect(() => {
        if (!panelOpen) return
        const handleMouseDown = (e: MouseEvent) => {
            if (!containerRef.current?.contains(e.target as Node)) {
                setPanelOpen(false)
            }
        }
        document.addEventListener("mousedown", handleMouseDown)
        return () => document.removeEventListener("mousedown", handleMouseDown)
    }, [panelOpen])

    const handleShowAll = (): void => {
        setPanelOpen(false)
        setModalOpen(true)
    }

    return (
        <>
            <div className="relative" ref={containerRef}>
                <button
                    type="button"
                    onClick={() => setPanelOpen((v) => !v)}
                    aria-label="Уведомления"
                    className="relative flex size-9 items-center justify-center rounded-lg text-neutral-600 transition-colors hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
                >
                    <Bell className="size-4" />
                    {unreadCount > 0 && (
                        <span className="absolute -right-0.5 -top-0.5 flex min-w-[16px] h-4 items-center justify-center rounded-full bg-neutral-800 px-1 text-[10px] font-medium leading-none text-white dark:bg-neutral-200 dark:text-neutral-900">
                            {unreadCount}
                        </span>
                    )}
                </button>

                {/* Dropdown panel */}
                {panelOpen && (
                    <div className="absolute right-0 top-11 z-50 w-80 rounded-xl border border-neutral-200 bg-white shadow-lg dark:border-neutral-800 dark:bg-neutral-950">
                            <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3 dark:border-neutral-800">
                                <span className="text-sm font-medium">Уведомления</span>
                                {unreadCount > 0 && (
                                    <span className="text-xs text-neutral-400">{unreadCount} непрочитанных</span>
                                )}
                            </div>

                            <div className="p-2">
                                {notifications.length === 0 ? (
                                    <p className="py-6 text-center text-xs text-neutral-400">Нет уведомлений</p>
                                ) : (
                                    <div className="flex flex-col gap-0.5">
                                        {latest.map((n) => (
                                            <NotificationItem
                                                key={n.id}
                                                n={n}
                                                onRead={() => markAsRead(n.id)}
                                                onDelete={() => remove(n.id)}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="border-t border-neutral-100 p-2 dark:border-neutral-800">
                                <button
                                    type="button"
                                    onClick={handleShowAll}
                                    className="w-full rounded-lg py-2 text-xs font-medium text-neutral-600 transition-colors hover:bg-neutral-50 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-neutral-100"
                                >
                                    Показать все ({notifications.length})
                                </button>
                            </div>
                        </div>
                )}
            </div>

            <NotificationsModal open={modalOpen} onClose={() => setModalOpen(false)} />
        </>
    )
}
