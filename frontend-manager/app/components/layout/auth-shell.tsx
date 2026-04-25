import type { ReactNode } from "react"
import { ThemeToggle } from "~/components/ui/theme-toggle"

interface AuthShellProps {
    title: string
    subtitle: string
    children: ReactNode
}

export function AuthShell({ title, subtitle, children }: AuthShellProps): React.ReactElement {
    return (
        <div className="relative flex min-h-dvh items-center justify-center px-6 py-12 bg-neutral-50 dark:bg-neutral-900">
            <div className="absolute right-4 top-4">
                <ThemeToggle />
            </div>
            <div className="w-full max-w-sm">
                <div className="mb-8 text-center">
                    <span className="text-sm font-bold tracking-widest uppercase text-neutral-400">
                        Connectio
                    </span>
                    <p className="mt-1 text-xs text-neutral-400">Панель менеджера</p>
                </div>
                <div className="rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm dark:border-neutral-700 dark:bg-neutral-800">
                    <div className="mb-6">
                        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
                        <p className="mt-1 text-sm text-neutral-500">{subtitle}</p>
                    </div>
                    {children}
                </div>
            </div>
        </div>
    )
}
