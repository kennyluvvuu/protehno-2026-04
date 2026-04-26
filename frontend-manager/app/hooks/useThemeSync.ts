import { useEffect } from "react"
import { useThemeStore } from "~/stores/useThemeStore"

export function useThemeSync(): void {
    const theme = useThemeStore((s) => s.theme)
    const setTheme = useThemeStore((s) => s.setTheme)

    useEffect(() => {
        const stored = localStorage.getItem("theme")
        const isDark = stored === "dark" || (!stored && window.matchMedia("(prefers-color-scheme: dark)").matches)
        setTheme(isDark ? "dark" : "light")
    }, [])

    useEffect(() => {
        document.documentElement.classList.toggle("dark", theme === "dark")
    }, [theme])
}
