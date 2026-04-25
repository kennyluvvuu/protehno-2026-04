import { useState } from "react"
import { PageHeader } from "~/components/layout"

interface Toggle {
    id: string
    title: string
    description: string
    defaultOn: boolean
}

const toggles: Toggle[] = [
    {
        id: "notifications",
        title: "Уведомления",
        description: "Получать письма о новых записях",
        defaultOn: true,
    },
    {
        id: "autoplay",
        title: "Автовоспроизведение",
        description: "Запускать плеер при открытии записи",
        defaultOn: false,
    },
    {
        id: "analytics",
        title: "Аналитика",
        description: "Помочь сделать сервис лучше",
        defaultOn: true,
    },
]

export default function Settings() {
    const [state, setState] = useState<Record<string, boolean>>(() =>
        Object.fromEntries(toggles.map((t) => [t.id, t.defaultOn])),
    )

    const handleToggle = (id: string): void => {
        setState((prev) => ({ ...prev, [id]: !prev[id] }))
    }

    return (
        <>
            <PageHeader
                title="Настройки"
                description="Управляйте поведением приложения"
            />

            <div className="divide-y divide-neutral-200 rounded-xl border border-neutral-200 dark:divide-neutral-900 dark:border-neutral-900">
                {toggles.map((toggle) => {
                    const isOn = state[toggle.id]
                    return (
                        <div
                            key={toggle.id}
                            className="flex items-center justify-between gap-6 px-5 py-4"
                        >
                            <div className="min-w-0">
                                <p className="text-sm font-medium">{toggle.title}</p>
                                <p className="text-xs text-neutral-500">
                                    {toggle.description}
                                </p>
                            </div>
                            <button
                                type="button"
                                role="switch"
                                aria-checked={isOn}
                                onClick={() => handleToggle(toggle.id)}
                                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                                    isOn
                                        ? "bg-[color:var(--color-accent)]"
                                        : "bg-neutral-200 dark:bg-neutral-800"
                                }`}
                            >
                                <span
                                    className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform ${
                                        isOn ? "translate-x-[22px]" : "translate-x-0.5"
                                    }`}
                                />
                            </button>
                        </div>
                    )
                })}
            </div>
        </>
    )
}
