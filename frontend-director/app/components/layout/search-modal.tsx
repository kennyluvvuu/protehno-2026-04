import { FileAudio, Search, X } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router"
import { Badge } from "~/components/ui/badge"
import { Dialog, DialogContent, DialogTitle } from "~/components/ui/dialog"
import { Input } from "~/components/ui/input"
import { MOCK_RECORDS, type MockRecord } from "~/lib/mock-data"
import { cn } from "~/lib/utils"

interface SearchModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

interface SearchResult {
    record: MockRecord
    matches: string[]
}

const SEARCH_FIELDS = [
    { key: "callTo", label: "Контрагент" },
    { key: "name", label: "Название" },
    { key: "agentName", label: "Агент" },
    { key: "transcription", label: "Диалог" },
    { key: "summary", label: "Суммирование" },
] as const

export function SearchModal({ open, onOpenChange }: SearchModalProps): React.ReactElement {
    const navigate = useNavigate()
    const inputRef = useRef<HTMLInputElement>(null)
    const [query, setQuery] = useState("")

    useEffect(() => {
        if (!open) {
            setQuery("")
            return
        }
        const timeoutId = window.setTimeout(() => inputRef.current?.focus(), 10)
        return () => window.clearTimeout(timeoutId)
    }, [open])

    const results = useMemo<SearchResult[]>(() => {
        const q = query.trim().toLowerCase()
        if (!q) return []

        return MOCK_RECORDS.reduce<SearchResult[]>((acc, record) => {
            const matches = SEARCH_FIELDS.filter(({ key }) => {
                const value = String(record[key] ?? "").toLowerCase()
                return value.includes(q)
            }).map(({ label }) => label)

            if (matches.length > 0) {
                acc.push({ record, matches })
            }
            return acc
        }, []).slice(0, 8)
    }, [query])

    const handleResultClick = (): void => {
        onOpenChange(false)
        navigate("/search")
    }

    const hasQuery = query.trim().length > 0

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="h-[110vh] max-h-[600px] w-[min(620px,calc(100%-2rem))] max-w-none grid-rows-[auto_1fr] overflow-hidden p-0 [&>button:last-child]:hidden">
                <DialogTitle className="sr-only">Глобальный поиск</DialogTitle>

                <div className="border-b border-border p-4">
                    <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            ref={inputRef}
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="Введите текст для поиска"
                            className="h-10 pl-9 pr-10"
                        />
                        {hasQuery && (
                            <button
                                type="button"
                                onClick={() => setQuery("")}
                                className="absolute right-2 top-1/2 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                aria-label="Очистить поиск"
                            >
                                <X className="size-3.5" />
                            </button>
                        )}
                    </div>
                </div>

                <div className="overflow-y-auto p-3">
                    {!hasQuery ? (
                        <div className="py-20 text-center text-sm text-muted-foreground">Начните вводить текст</div>
                    ) : results.length === 0 ? (
                        <div className="py-20 text-center text-sm text-muted-foreground">Ничего не найдено</div>
                    ) : (
                        <div className="flex flex-col gap-2">
                            {results.map(({ record, matches }) => (
                                <button
                                    key={record.id}
                                    type="button"
                                    onClick={handleResultClick}
                                    className="flex w-full items-start gap-3 rounded-lg border border-border bg-card px-3 py-2 text-left transition-colors hover:bg-accent"
                                >
                                    <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
                                        <FileAudio className="size-4 text-muted-foreground" />
                                    </div>

                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-medium">{record.name}</p>
                                        <p className="truncate text-xs text-muted-foreground">
                                            {record.callTo} · {record.agentName} · {record.date}
                                        </p>
                                        <div className="mt-1.5 flex flex-wrap gap-1">
                                            {matches.slice(0, 3).map((label) => (
                                                <Badge key={`${record.id}-${label}`} variant="outline" className={cn("text-[10px]", "border-border")}>{label}</Badge>
                                            ))}
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}