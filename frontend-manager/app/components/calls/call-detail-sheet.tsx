import { Play } from "lucide-react"
import { useState } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "~/components/ui/sheet"
import { cn } from "~/lib/cn"
import type { Record } from "~/types/record"

function formatDuration(sec: number): string {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${m}:${s.toString().padStart(2, "0")}`
}

function CheckboxList({ items }: { items: Array<{ label: string; checked: boolean }> }) {
    const [checked, setChecked] = useState<globalThis.Record<number, boolean>>({})
    const toggle = (i: number) => setChecked((prev) => ({ ...prev, [i]: !prev[i] }))

    return (
        <ul className="flex flex-col gap-2">
            {items.map((item, i) => (
                <li key={i} className="flex items-start gap-2.5">
                    <button
                        type="button"
                        onClick={() => toggle(i)}
                        role="checkbox"
                        aria-checked={!!checked[i]}
                        className={cn(
                            "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border transition-colors",
                            checked[i]
                                ? "border-neutral-500 bg-neutral-700 dark:border-neutral-400 dark:bg-neutral-500"
                                : "border-neutral-300 bg-white dark:border-neutral-600 dark:bg-neutral-800",
                        )}
                    >
                        {checked[i] && (
                            <svg viewBox="0 0 10 8" className="size-2.5 text-white" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <path d="M1 4l3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        )}
                    </button>
                    <span className={cn("text-sm leading-5", checked[i] && "line-through text-neutral-400")}>{item.label}</span>
                </li>
            ))}
        </ul>
    )
}

interface CallDetailSheetProps {
    record: Record | null
    open: boolean
    onClose: () => void
}

export function CallDetailSheet({ record, open, onClose }: CallDetailSheetProps) {
    if (!record) return null

    const phone = record.callerNumber ?? record.calleeNumber ?? null
    const date = record.startedAt ? new Date(record.startedAt).toLocaleDateString("ru-RU") : null

    return (
        <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
            <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
                <SheetHeader>
                    <SheetTitle className="text-base">{record.title ?? `Звонок #${record.id}`}</SheetTitle>
                    <p className="text-sm text-neutral-500">
                        {[record.callTo, phone, date].filter(Boolean).join(" · ")}
                    </p>
                </SheetHeader>

                <div className="mt-6 flex flex-col gap-5">
                    {record.durationSec != null && (
                        <div className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-700 dark:bg-neutral-800">
                            <button type="button" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-neutral-700 text-neutral-100">
                                <Play className="size-3.5 translate-x-0.5" />
                            </button>
                            <div className="flex flex-1 items-center gap-1.5">
                                {Array.from({ length: 40 }).map((_, i) => (
                                    <div key={i} className="w-0.5 rounded-full bg-neutral-300 dark:bg-neutral-600" style={{ height: `${8 + Math.random() * 20}px` }} />
                                ))}
                            </div>
                            <span className="text-xs text-neutral-400">{formatDuration(record.durationSec)}</span>
                        </div>
                    )}

                    {record.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                            {record.tags.map((tag) => (
                                <span key={tag} className="rounded-full border border-neutral-200 px-2.5 py-0.5 text-xs text-neutral-600 dark:border-neutral-700 dark:text-neutral-400">
                                    {tag}
                                </span>
                            ))}
                        </div>
                    )}

                    {record.transcription && (
                        <div>
                            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-400">Диалог</p>
                            <div className="rounded-lg border border-neutral-100 bg-neutral-50 p-3 text-sm text-neutral-700 whitespace-pre-wrap dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">{record.transcription}</div>
                        </div>
                    )}

                    {record.summary && (
                        <div>
                            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-400">Суммирование</p>
                            <div className="rounded-lg border border-neutral-100 bg-neutral-50 p-3 text-sm text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">{record.summary}</div>
                        </div>
                    )}

                    {record.checkboxes?.promises && record.checkboxes.promises.length > 0 && (
                        <div>
                            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-400">Обещания</p>
                            <CheckboxList items={record.checkboxes.promises} />
                        </div>
                    )}
                    {record.checkboxes?.tasks && record.checkboxes.tasks.length > 0 && (
                        <div>
                            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-400">Задачи</p>
                            <CheckboxList items={record.checkboxes.tasks} />
                        </div>
                    )}
                    {record.checkboxes?.agreements && record.checkboxes.agreements.length > 0 && (
                        <div>
                            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-400">Договорённости</p>
                            <CheckboxList items={record.checkboxes.agreements} />
                        </div>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    )
}
