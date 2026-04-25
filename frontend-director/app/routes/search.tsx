import { FileAudio, Search } from "lucide-react"
import { useMemo, useState } from "react"
import { Badge } from "~/components/ui/badge"
import { Input } from "~/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select"
import { MOCK_RECORDS, type MockRecord } from "~/lib/mock-data"
import { PageHeader } from "~/components/layout"
import { cn } from "~/lib/utils"

type SearchField = "callTo" | "name" | "transcription" | "summary" | "agentName"

const SEARCH_FIELDS: { value: SearchField; label: string }[] = [
    { value: "callTo", label: "По контрагенту" },
    { value: "name", label: "По названию" },
    { value: "agentName", label: "По агенту" },
    { value: "transcription", label: "По тексту диалога" },
    { value: "summary", label: "По суммированию" },
]

function highlight(text: string, query: string): React.ReactElement {
    if (!query) return <>{text}</>
    const idx = text.toLowerCase().indexOf(query.toLowerCase())
    if (idx === -1) return <>{text}</>
    return (
        <>
            {text.slice(0, idx)}
            <mark className="bg-yellow-100 text-yellow-900 rounded px-0.5 dark:bg-yellow-900/50 dark:text-yellow-100">
                {text.slice(idx, idx + query.length)}
            </mark>
            {text.slice(idx + query.length)}
        </>
    )
}

function ResultCard({ record, query, field }: { record: MockRecord; query: string; field: SearchField }) {
    const statusColor =
        record.status === "success"
            ? "border-green-200 bg-green-50 text-green-700 dark:border-green-700 dark:bg-green-950/35 dark:text-green-300"
            : record.status === "failed"
            ? "border-red-200 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-950/35 dark:text-red-300"
            : "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-700 dark:bg-orange-950/35 dark:text-orange-300"

    const statusLabel =
        record.status === "success" ? "Успешно" : record.status === "failed" ? "Отказ" : "Обработка"

    const fieldValue = String(record[field] ?? "")

    return (
        <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-800">
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-neutral-100 dark:bg-neutral-800">
                        <FileAudio className="size-4 text-neutral-500" />
                    </div>
                    <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{highlight(record.name, field === "name" ? query : "")}</p>
                        <p className="text-xs text-neutral-500 mt-0.5">
                            {highlight(record.callTo, field === "callTo" ? query : "")} · {record.agentName} · {record.date}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-medium text-neutral-500">{record.qualityScore}%</span>
                    <Badge variant="outline" className={cn("text-xs", statusColor)}>{statusLabel}</Badge>
                </div>
            </div>

            {(field === "transcription" || field === "summary") && fieldValue && (
                <div className="mt-3 rounded-lg bg-neutral-50 p-3 text-xs text-neutral-600 dark:bg-neutral-700/50 dark:text-neutral-300 line-clamp-2">
                    {highlight(fieldValue, query)}
                </div>
            )}

            {field === "agentName" && (
                <p className="mt-2 text-xs text-neutral-400">
                    Агент: {highlight(record.agentName, query)}
                </p>
            )}
        </div>
    )
}

export default function SearchPage() {
    const [query, setQuery] = useState("")
    const [field, setField] = useState<SearchField>("callTo")

    const results = useMemo<MockRecord[]>(() => {
        const q = query.trim().toLowerCase()
        if (!q) return []
        return MOCK_RECORDS.filter((r) => {
            const value = String(r[field] ?? "").toLowerCase()
            return value.includes(q)
        })
    }, [query, field])

    const hasQuery = query.trim().length > 0

    return (
        <div>
            <PageHeader title="Глобальный поиск" description="Поиск по всей базе звонков" />

            {/* Search bar */}
            <div className="flex gap-2 mb-6 max-w-2xl">
                <Select value={field} onValueChange={(v) => setField(v as SearchField)}>
                    <SelectTrigger className="w-52 shrink-0">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {SEARCH_FIELDS.map((f) => (
                            <SelectItem key={f.value} value={f.value}>
                                {f.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-neutral-400" />
                    <Input
                        placeholder={`Введите запрос…`}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="pl-9"
                        autoFocus
                    />
                </div>
            </div>

            {/* Results */}
            {!hasQuery ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <Search className="size-10 text-neutral-200 dark:text-neutral-700" />
                    <p className="mt-4 text-sm font-medium text-neutral-500">Начните вводить запрос</p>
                    <p className="mt-1 text-xs text-neutral-400">
                        Выберите поле и введите текст для поиска по записям
                    </p>
                </div>
            ) : results.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <Search className="size-10 text-neutral-200 dark:text-neutral-700" />
                    <p className="mt-4 text-sm font-medium text-neutral-500">Ничего не найдено</p>
                    <p className="mt-1 text-xs text-neutral-400">
                        По запросу «{query}» результатов нет. Попробуйте другое поле или запрос.
                    </p>
                </div>
            ) : (
                <div className="flex flex-col gap-3">
                    <p className="text-xs text-neutral-400 mb-1">
                        Найдено результатов: <strong className="text-neutral-700 dark:text-neutral-300">{results.length}</strong>
                    </p>
                    {results.map((r) => (
                        <ResultCard key={r.id} record={r} query={query} field={field} />
                    ))}
                </div>
            )}
        </div>
    )
}
