import { Moon, Sun, User } from "lucide-react"
import { useOutletContext } from "react-router"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Separator } from "~/components/ui/separator"
import { PageHeader } from "~/components/layout"
import { useThemeStore } from "~/stores/useThemeStore"
import type { User as UserType } from "~/types/auth"

export default function Settings() {
    const { user } = useOutletContext<{ user: UserType }>()
    const { theme, setTheme } = useThemeStore()

    return (
        <div>
            <PageHeader title="Настройки" description="Ваш профиль и параметры системы" />

            <div className="flex flex-col gap-4 max-w-lg">
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium">Профиль</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-4">
                        <div className="flex items-center gap-4">
                            <div className="flex size-14 items-center justify-center rounded-full bg-neutral-100 text-xl font-semibold text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                                {user.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <p className="font-medium">{user.name}</p>
                                <p className="text-sm text-neutral-500">{user.email}</p>
                            </div>
                        </div>
                        <Separator />
                        <div>
                            <p className="text-xs text-neutral-400 uppercase tracking-wide mb-1">Роль</p>
                            <div className="flex items-center gap-2">
                                <User className="size-3.5 text-neutral-500" />
                                <span className="text-sm font-medium">Менеджер</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium">Внешний вид</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-xs text-neutral-500 mb-3">Переключение темы интерфейса</p>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => setTheme("light")}
                                className={`flex flex-1 items-center justify-center gap-2 rounded-lg border py-3 text-sm font-medium transition-all ${
                                    theme === "light"
                                        ? "border-neutral-300 bg-neutral-200 text-neutral-800 dark:border-neutral-600 dark:bg-neutral-600 dark:text-neutral-100"
                                        : "border-neutral-200 text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-700/40"
                                }`}
                            >
                                <Sun className="size-4" />
                                Светлая
                            </button>
                            <button
                                type="button"
                                onClick={() => setTheme("dark")}
                                className={`flex flex-1 items-center justify-center gap-2 rounded-lg border py-3 text-sm font-medium transition-all ${
                                    theme === "dark"
                                        ? "border-neutral-300 bg-neutral-200 text-neutral-800 dark:border-neutral-600 dark:bg-neutral-600 dark:text-neutral-100"
                                        : "border-neutral-200 text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-700/40"
                                }`}
                            >
                                <Moon className="size-4" />
                                Тёмная
                            </button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
