import { useMemo, useRef, useState } from "react"
import { ArrowUp, ArrowDown, ArrowUpDown, Check, Filter, Mic, Play, Search, CalendarDays, X } from "lucide-react"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import { Input } from "~/components/ui/input"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "~/components/ui/sheet"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table"
import { MOCK_RECORDS, type MockRecord } from "~/lib/mock-data"
import { cn } from "~/lib/utils"
import { PageHeader } from "~/components/layout"

type SortField = "name" | "callTo" | "durationSec" | "qualityScore" | "date"
type SortDir = "asc" | "desc"
type StatusFilter = MockRecord["status"] | "all"
const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
    { value: "all", label: "Все статусы" },
    { value: "success", label: "Успешные" },
    { value: "failed", label: "Отказ" },
    { value: "processing", label: "В обработке" },
]


function formatDuration(sec: number): string {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${m}:${s.toString().padStart(2, "0")}`
}

function QualityScore({ score }: { score: number }) {
    const color =
        score >= 80 ? "text-green-600 dark:text-green-400"
        : score >= 60 ? "text-yellow-600 dark:text-yellow-400"
        : "text-red-600 dark:text-red-400"
    return <span className={cn("tabular-nums font-medium text-sm", color)}>{score}%</span>
}

function CheckboxList({ items }: { items: string[] }) {
    const [checked, setChecked] = useState<Record<number, boolean>>({})
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
                    <span className={cn("text-sm leading-5", checked[i] && "line-through text-neutral-400")}>{item}</span>
                </li>
            ))}
        </ul>
    )
}

function StatusBadge({ status }: { status: MockRecord["status"] }) {
    if (status === "success") return <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700 dark:border-green-700 dark:bg-green-950/35 dark:text-green-300">Успешно</Badge>
    if (status === "failed") return <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-950/35 dark:text-red-300">Отказ</Badge>
    return <Badge variant="outline" className="border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-700 dark:bg-orange-950/35 dark:text-orange-300">Обработка</Badge>
}

function CallDetailSheet({ record, open, onClose }: { record: MockRecord | null; open: boolean; onClose: () => void }) {
    if (!record) return null
    return (
        <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
            <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
                <SheetHeader>
                    <SheetTitle className="text-base">{record.name}</SheetTitle>
                    <p className="text-sm text-neutral-500">{record.callTo} · {record.phone} · {record.date}</p>
                    <div className="flex items-center gap-2 pt-1">
                        <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xs font-semibold text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                            {record.agentName.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm text-neutral-600 dark:text-neutral-400">Менеджер: {record.agentName}</span>
                    </div>
                </SheetHeader>

                <div className="mt-6 flex flex-col gap-5">
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

                    <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-0.5 rounded-lg border border-neutral-100 p-3 dark:border-neutral-700">
                            <p className="text-[10px] uppercase tracking-wide text-neutral-400">Длительность</p>
                            <p className="text-sm font-medium">{formatDuration(record.durationSec)}</p>
                        </div>
                        <div className="flex flex-col gap-0.5 rounded-lg border border-neutral-100 p-3 dark:border-neutral-700">
                            <p className="text-[10px] uppercase tracking-wide text-neutral-400">Качество</p>
                            <QualityScore score={record.qualityScore} />
                        </div>
                    </div>

                    <div>
                        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-400">Диалог</p>
                        <div className="rounded-lg border border-neutral-100 bg-neutral-50 p-3 text-sm text-neutral-700 whitespace-pre-wrap dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">{record.transcription}</div>
                    </div>

                    <div>
                        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-400">Суммирование</p>
                        <div className="rounded-lg border border-neutral-100 bg-neutral-50 p-3 text-sm text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">{record.summary}</div>
                    </div>

                    {record.promises.length > 0 && (
                        <div>
                            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-400">Обещания</p>
                            <CheckboxList items={record.promises} />
                        </div>
                    )}
                    {record.tasks.length > 0 && (
                        <div>
                            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-400">Задачи</p>
                            <CheckboxList items={record.tasks} />
                        </div>
                    )}
                    {record.agreements.length > 0 && (
                        <div>
                            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-400">Договорённости</p>
                            <CheckboxList items={record.agreements} />
                        </div>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    )
}

function fmtDate(iso: string): string {
    const [y, m, d] = iso.split("-")
    return `${d}.${m}.${y.slice(2)}`
}

function matchesDate(dateStr: string, from: string, to: string): boolean {
    if (!from && !to) return true
    const date = new Date(dateStr)
    if (from && date < new Date(from)) return false
    if (to && date > new Date(`${to}T23:59:59`)) return false
    return true
}

export default function Calls() {
    const [search, setSearch] = useState("")
    const [sortField, setSortField] = useState<SortField>("date")
    const [sortDir, setSortDir] = useState<SortDir>("desc")
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
    const [dateFrom, setDateFrom] = useState("")
    const [dateTo, setDateTo] = useState("")
    const [selected, setSelected] = useState<MockRecord | null>(null)
    const dateFromRef = useRef<HTMLInputElement>(null)
    const dateToRef = useRef<HTMLInputElement>(null)

    const records = useMemo(() => {
        const q = search.toLowerCase()
        let list = MOCK_RECORDS.filter((r) => {
            const matchSearch = !q || r.name.toLowerCase().includes(q) || r.callTo.toLowerCase().includes(q) || r.agentName.toLowerCase().includes(q)
            const matchStatus = statusFilter === "all" || r.status === statusFilter
            const matchDate = matchesDate(r.date, dateFrom, dateTo)
            return matchSearch && matchStatus && matchDate
        })
        list = [...list].sort((a, b) => {
            const dir = sortDir === "asc" ? 1 : -1
            if (sortField === "name") return dir * a.name.localeCompare(b.name)
            if (sortField === "callTo") return dir * a.callTo.localeCompare(b.callTo)
            if (sortField === "durationSec") return dir * (a.durationSec - b.durationSec)
            if (sortField === "qualityScore") return dir * (a.qualityScore - b.qualityScore)
            return dir * a.date.localeCompare(b.date)
        })
        return list
    }, [search, sortField, sortDir, statusFilter, dateFrom, dateTo])

    const isDateActive = dateFrom !== "" || dateTo !== ""

    const toggleSort = (field: SortField): void => {
        if (sortField === field) {
            setSortDir((d) => (d === "asc" ? "desc" : "asc"))
        } else {
            setSortField(field)
            setSortDir("desc")
        }
    }

    const SortIcon = ({ field }: { field: SortField }): React.ReactElement => {
        if (sortField !== field) return <ArrowUpDown className="ml-1 inline size-3 text-neutral-300" />
        return sortDir === "asc"
            ? <ArrowUp className="ml-1 inline size-3 text-neutral-700 dark:text-neutral-300" />
            : <ArrowDown className="ml-1 inline size-3 text-neutral-700 dark:text-neutral-300" />
    }

    return (
        <div>
            <PageHeader title="Список звонков" description="Все записи разговоров менеджеров" />

            {/* Toolbar */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-48">
                    <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-neutral-400" />
                    <Input
                        placeholder="Поиск по названию, контрагенту, агенту…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9"
                    />
                </div>

                {/* Date range inputs */}
                <div className="flex items-center rounded-md border border-input bg-background overflow-hidden">
                    <div className="relative flex items-center gap-1.5 border-r border-input px-3 h-9">
                        <CalendarDays className="size-3.5 shrink-0 text-neutral-400" />
                        <span className="text-xs text-neutral-400">От</span>
                        <button
                            type="button"
                            onClick={() => dateFromRef.current?.showPicker?.()}
                            className="text-xs min-w-14 text-left select-none"
                        >
                            {dateFrom ? fmtDate(dateFrom) : <span className="text-neutral-300 dark:text-neutral-600">дд.мм.гг</span>}
                        </button>
                        <input
                            ref={dateFromRef}
                            type="date"
                            value={dateFrom}
                            max={dateTo || undefined}
                            onChange={(e) => setDateFrom(e.target.value)}
                            className="absolute inset-0 opacity-0 pointer-events-none"
                            tabIndex={-1}
                        />
                    </div>
                    <div className="relative flex items-center gap-1.5 px-3 h-9">
                        <span className="text-xs text-neutral-400">До</span>
                        <button
                            type="button"
                            onClick={() => dateToRef.current?.showPicker?.()}
                            className="text-xs min-w-14 text-left select-none"
                        >
                            {dateTo ? fmtDate(dateTo) : <span className="text-neutral-300 dark:text-neutral-600">дд.мм.гг</span>}
                        </button>
                        <input
                            ref={dateToRef}
                            type="date"
                            value={dateTo}
                            min={dateFrom || undefined}
                            onChange={(e) => setDateTo(e.target.value)}
                            className="absolute inset-0 opacity-0 pointer-events-none"
                            tabIndex={-1}
                        />
                    </div>
                    {isDateActive && (
                        <button
                            type="button"
                            onClick={() => { setDateFrom(""); setDateTo("") }}
                            title="Сбросить"
                            className="flex items-center justify-center h-9 w-8 border-l border-input text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors"
                        >
                            <X className="size-3" />
                        </button>
                    )}
                </div>

                {/* Status filter dropdown */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-1.5">
                            <Filter className="size-3.5" />
                            Фильтрация
                            {statusFilter !== "all" && (
                                <span className="ml-0.5 flex size-4 items-center justify-center rounded-full bg-neutral-800 text-[10px] text-white dark:bg-neutral-300 dark:text-neutral-900">1</span>
                            )}
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-44">
                        <DropdownMenuLabel className="text-xs text-neutral-400">Статус</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {STATUS_OPTIONS.map(({ value, label }) => (
                            <DropdownMenuItem
                                key={value}
                                onClick={() => setStatusFilter(value)}
                                className="flex items-center justify-between"
                            >
                                {label}
                                {statusFilter === value && <Check className="size-3.5 text-neutral-600" />}
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>

            </div>

            {/* Table */}
            <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-neutral-50/80 dark:bg-neutral-800/80">
                            <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("name")}>
                                Название <SortIcon field="name" />
                            </TableHead>
                            <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("callTo")}>
                                Контрагент <SortIcon field="callTo" />
                            </TableHead>
                            <TableHead>Агент</TableHead>
                            <TableHead>Телефон</TableHead>
                            <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("date")}>
                                Дата <SortIcon field="date" />
                            </TableHead>
                            <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("qualityScore")}>
                                Качество <SortIcon field="qualityScore" />
                            </TableHead>
                            <TableHead>Статус</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {records.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="py-16 text-center">
                                    <div className="flex flex-col items-center gap-2">
                                        <Mic className="size-8 text-neutral-300" />
                                        <p className="text-sm text-neutral-500">Звонков не найдено</p>
                                        {search && <p className="text-xs text-neutral-400">Попробуйте изменить параметры поиска</p>}
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            records.map((r) => (
                                <TableRow key={r.id} className="cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800/50" onClick={() => setSelected(r)}>
                                    <TableCell className="font-medium max-w-48 truncate">{r.name}</TableCell>
                                    <TableCell className="text-neutral-600 dark:text-neutral-400">{r.callTo}</TableCell>
                                    <TableCell className="text-neutral-600 dark:text-neutral-400">{r.agentName}</TableCell>
                                    <TableCell className="text-neutral-500 text-sm tabular-nums">{r.phone}</TableCell>
                                    <TableCell className="text-neutral-500 text-sm">{r.date}</TableCell>
                                    <TableCell><QualityScore score={r.qualityScore} /></TableCell>
                                    <TableCell><StatusBadge status={r.status} /></TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <p className="mt-2 text-xs text-neutral-400">{records.length} из {MOCK_RECORDS.length} записей</p>

            <CallDetailSheet record={selected} open={!!selected} onClose={() => setSelected(null)} />
        </div>
    )
}
