import { Moon, Sun } from "lucide-react"
import { cn } from "~/lib/cn"
import { useThemeStore } from "~/stores/useThemeStore"

interface ThemeToggleProps {
    className?: string
}

export function ThemeToggle({
    className,
}: ThemeToggleProps): React.ReactElement {
    const toggle = useThemeStore((s) => s.toggle)

    return (
        <button
            type="button"
            onClick={toggle}
            aria-label="Переключить тему"
            className={cn(
                "inline-flex size-9 items-center justify-center rounded-lg text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-neutral-100",
                className,
            )}
        >
            <Sun className="hidden size-4 dark:block" />
            <Moon className="block size-4 dark:hidden" />
        </button>
    )
}
