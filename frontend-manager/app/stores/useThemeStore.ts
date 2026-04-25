import { create } from "zustand"

export type Theme = "light" | "dark"

interface ThemeState {
    theme: Theme
    setTheme: (theme: Theme) => void
    toggle: () => void
}

const STORAGE_KEY = "theme"

function getInitialTheme(): Theme {
    if (typeof window === "undefined") return "light"
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored === "light" || stored === "dark") return stored
    return window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
}

function persist(theme: Theme): void {
    if (typeof window === "undefined") return
    window.localStorage.setItem(STORAGE_KEY, theme)
}

export const useThemeStore = create<ThemeState>((set, get) => ({
    theme: getInitialTheme(),
    setTheme: (theme) => {
        persist(theme)
        set({ theme })
    },
    toggle: () => {
        const next: Theme = get().theme === "dark" ? "light" : "dark"
        persist(next)
        set({ theme: next })
    },
}))
