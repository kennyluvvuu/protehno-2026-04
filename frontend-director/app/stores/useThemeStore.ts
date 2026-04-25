import { create } from "zustand"

export type Theme = "light" | "dark"

interface ThemeState {
    theme: Theme
    setTheme: (theme: Theme) => void
    toggle: () => void
}

const STORAGE_KEY = "theme"

function persist(theme: Theme): void {
    window.localStorage.setItem(STORAGE_KEY, theme)
}

export const useThemeStore = create<ThemeState>((set, get) => ({
    theme: "light",
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
