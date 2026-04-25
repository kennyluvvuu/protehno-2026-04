import { BarChart2, List, ListChecks, LogOut, Settings, Upload } from "lucide-react"
import { NavLink, useNavigate, useRevalidator } from "react-router"
import { toast } from "sonner"
import { authApi } from "~/axios/auth"
import { cn } from "~/lib/cn"
import { useAuthStore } from "~/stores/useAuthStore"
import type { User } from "~/types/auth"

interface SidebarProps {
    user: User
    isCollapsed: boolean
}

const nav = [
    { to: "/", label: "Дэшборд", icon: BarChart2, end: true },
    { to: "/calls", label: "Мои звонки", icon: List, end: false },
    { to: "/tasks", label: "Задачи", icon: ListChecks, end: false },
    { to: "/upload", label: "Загрузить", icon: Upload, end: false },
    { to: "/settings", label: "Настройки", icon: Settings, end: false },
]

export function Sidebar({ user, isCollapsed }: SidebarProps): React.ReactElement {
    const navigate = useNavigate()
    const { revalidate } = useRevalidator()
    const reset = useAuthStore((s) => s.reset)

    const handleLogout = async (): Promise<void> => {
        try {
            await authApi.logout()
            reset()
            toast.success("Вы вышли из системы")
            await revalidate()
            navigate("/login", { replace: true })
        } catch {
            toast.error("Не удалось выйти")
        }
    }

    return (
        <aside
            className={cn(
                "flex h-dvh shrink-0 flex-col border-r border-neutral-300 bg-neutral-50 py-5 transition-[width,padding] duration-200 dark:border-neutral-600 dark:bg-neutral-800",
                isCollapsed ? "w-[72px] px-2" : "w-56 px-3",
            )}
        >
            <div className={cn("px-2 pb-6", isCollapsed && "px-0 pb-5 text-center")}>
                <span className="text-sm font-bold tracking-widest uppercase text-neutral-800 dark:text-neutral-100">
                    {isCollapsed ? "Cn" : "Connectio"}
                </span>
                {!isCollapsed && (
                    <p className="text-[10px] text-neutral-400 mt-0.5">Платформа для обработки звонков</p>
                )}
            </div>

            <nav className="flex flex-1 flex-col gap-0.5">
                {nav.map(({ to, label, icon: Icon, end }) => (
                    <NavLink
                        key={to}
                        to={to}
                        end={end}
                        className={({ isActive }) =>
                            cn(
                                "flex h-9 items-center rounded-md text-sm transition-colors",
                                isCollapsed ? "justify-center px-0" : "gap-2.5 px-2.5",
                                isActive
                                    ? "bg-neutral-100 text-neutral-900 font-medium dark:bg-neutral-700 dark:text-neutral-100"
                                    : "text-neutral-500 hover:bg-neutral-50 hover:text-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-neutral-100",
                            )
                        }
                        title={isCollapsed ? label : undefined}
                    >
                        <Icon className="size-3.5 shrink-0" />
                        {!isCollapsed && label}
                    </NavLink>
                ))}
            </nav>

            <div className="border-t border-neutral-100 pt-3 dark:border-neutral-700">
                <div className={cn("flex items-center px-2 py-1", isCollapsed ? "justify-center gap-1" : "gap-2")}>
                    <button
                        type="button"
                        onClick={() => navigate("/settings")}
                        className="flex size-7 shrink-0 items-center justify-center rounded-full bg-neutral-800 text-xs font-semibold text-white dark:bg-neutral-700 hover:opacity-80 transition-opacity"
                    >
                        {(user.fio ?? user.name).charAt(0).toUpperCase()}
                    </button>
                    {!isCollapsed && (
                        <button
                            type="button"
                            onClick={() => navigate("/settings")}
                            className="min-w-0 flex-1 text-left hover:opacity-70 transition-opacity"
                        >
                            <p className="truncate text-xs font-medium">{user.fio ?? user.name}</p>
                            <p className="truncate text-[10px] text-neutral-400">{user.email}</p>
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={handleLogout}
                        aria-label="Выйти из системы"
                        className="flex size-7 shrink-0 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-neutral-200 hover:text-neutral-700 dark:hover:bg-neutral-700 dark:hover:text-neutral-200"
                    >
                        <LogOut className="size-3.5" />
                    </button>
                </div>
            </div>
        </aside>
    )
}
