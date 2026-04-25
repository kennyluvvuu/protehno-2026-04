import { useEffect } from "react"
import { useThemeStore } from "~/stores/useThemeStore"

export function useThemeSync(): void {
    const theme = useThemeStore((s) => s.theme)

    useEffect(() => {
        const root = document.documentElement
        root.classList.toggle("dark", theme === "dark")
    }, [theme])
}
