import { Home, Settings, User, LogOut } from "lucide-react"
import { NavLink, useNavigate, useRevalidator } from "react-router"
import { toast } from "sonner"
import { authApi } from "~/axios/auth"
import { ThemeToggle } from "~/components/ui/theme-toggle"
import { cn } from "~/lib/cn"
import { useAuthStore } from "~/stores/useAuthStore"
import type { User as UserType } from "~/types/auth"

interface SidebarProps {
    user: UserType
}

const nav = [
    { to: "/", label: "Главная", icon: Home, end: true },
    { to: "/profile", label: "Профиль", icon: User, end: false },
    { to: "/settings", label: "Настройки", icon: Settings, end: false },
]

export function Sidebar({ user }: SidebarProps): React.ReactElement {
    const navigate = useNavigate()
    const { revalidate } = useRevalidator()
    const reset = useAuthStore((s) => s.reset)

    const handleLogout = async (): Promise<void> => {
        try {
            await authApi.logout()
            reset()
            toast.success("Вы вышли")
            await revalidate()
            navigate("/login", { replace: true })
        } catch {
            toast.error("Не удалось выйти")
        }
    }

    return (
        <aside className="flex h-dvh w-64 shrink-0 flex-col border-r border-neutral-200 bg-white px-4 py-6 dark:border-neutral-900 dark:bg-neutral-950">
            <div className="px-2 pb-8">
                <span className="text-base font-bold tracking-tight">
                    protehno
                </span>
            </div>

            <nav className="flex flex-1 flex-col gap-1">
                {nav.map(({ to, label, icon: Icon, end }) => (
                    <NavLink
                        key={to}
                        to={to}
                        end={end}
                        className={({ isActive }) =>
                            cn(
                                "flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
                                isActive
                                    ? "bg-[color:var(--color-accent-soft)] text-[color:var(--color-accent)] dark:bg-neutral-900 dark:text-[color:var(--color-accent)]"
                                    : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-neutral-100",
                            )
                        }
                    >
                        <Icon className="size-4" />
                        {label}
                    </NavLink>
                ))}
            </nav>

            <div className="flex flex-col gap-2 border-t border-neutral-200 pt-4 dark:border-neutral-900">
                <div className="flex items-center gap-2 px-2">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-accent-soft)] text-sm font-semibold text-[color:var(--color-accent)] dark:bg-neutral-900">
                        {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{user.name}</p>
                        <p className="truncate text-xs text-neutral-500">
                            {user.email}
                        </p>
                    </div>
                    <ThemeToggle />
                </div>
                <button
                    type="button"
                    onClick={handleLogout}
                    className="flex h-9 items-center gap-2 rounded-lg px-3 text-sm text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-neutral-100"
                >
                    <LogOut className="size-4" />
                    Выйти
                </button>
            </div>
        </aside>
    )
}
