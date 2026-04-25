import { useMemo, useState } from "react"
import { ArrowDown, ArrowUp, ArrowUpDown, Check, ClipboardList, Filter } from "lucide-react"
import { Link } from "react-router"
import { CallDetailSheet } from "~/components/calls/call-detail-sheet"
import { PageHeader } from "~/components/layout"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem,
    DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import { Pagination } from "~/components/ui/pagination"
import { Skeleton } from "~/components/ui/skeleton"
import { usePagination } from "~/hooks/usePagination"
import { useRecords } from "~/hooks/useRecords"
import type { Record } from "~/types/record"

type TaskType = "all" | "tasks" | "promises" | "agreements"
type SortField = "text" | "date"
type SortDir = "asc" | "desc"

const TYPE_OPTIONS: { value: TaskType; label: string }[] = [
    { value: "all", label: "Все типы" },
    { value: "tasks", label: "Задачи" },
    { value: "promises", label: "Обещания" },
    { value: "agreements", label: "Договорённости" },
]

const TYPE_LABELS: { [K in TaskType]: string } = {
    all: "Все",
    tasks: "Задача",
    promises: "Обещание",
    agreements: "Договорённость",
}

interface TaskItem {
    id: string
    text: string
    type: Exclude<TaskType, "all">
    isDone: boolean
    record: Record
    date: string | null
}

export default function TasksPage(): React.ReactElement {
    const { data: records = [], isPending } = useRecords()
    const [selectedRecord, setSelectedRecord] = useState<Record | null>(null)
    const [typeFilter, setTypeFilter] = useState<TaskType>("all")
    const [sortField, setSortField] = useState<SortField>("date")
    const [sortDir, setSortDir] = useState<SortDir>("desc")

    const allTasks = useMemo<TaskItem[]>(() => {
        return records.flatMap((record) => {
            const date = record.startedAt ?? record.callStartedAt ?? null
            const fromType = (items: { label: string; checked: boolean }[], type: Exclude<TaskType, "all">): TaskItem[] =>
                items.map((t, i) => ({
                    id: `${record.id}-${type}-${i}`,
                    text: t.label,
                    type,
                    isDone: t.checked,
                    record,
                    date,
                }))
            return [
                ...fromType(record.checkboxes?.tasks ?? [], "tasks"),
                ...fromType(record.checkboxes?.promises ?? [], "promises"),
                ...fromType(record.checkboxes?.agreements ?? [], "agreements"),
            ]
        })
    }, [records])

    const filtered = useMemo(() => {
        let list = allTasks.filter((t) => !t.isDone && (typeFilter === "all" || t.type === typeFilter))
        list = [...list].sort((a, b) => {
            const dir = sortDir === "asc" ? 1 : -1
            if (sortField === "text") return dir * a.text.localeCompare(b.text, "ru")
            return dir * (a.date ?? "").localeCompare(b.date ?? "")
        })
        return list
    }, [allTasks, typeFilter, sortField, sortDir])

    const { page, totalPages, pageItems, setPage } = usePagination(filtered)

    const toggleSort = (field: SortField) => {
        if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"))
        else { setSortField(field); setSortDir("desc") }
    }

    const SortIcon = ({ field }: { field: SortField }): React.ReactElement => {
        if (sortField !== field) return <ArrowUpDown className="ml-1 inline size-3 text-neutral-300" />
        return sortDir === "asc"
            ? <ArrowUp className="ml-1 inline size-3 text-neutral-600 dark:text-neutral-300" />
            : <ArrowDown className="ml-1 inline size-3 text-neutral-600 dark:text-neutral-300" />
    }

    const activeTasksCount = allTasks.filter((t) => !t.isDone).length

    return (
        <div>
            <PageHeader
                title="Задачи"
                description="Текущие задачи по звонкам"
                actions={<Badge variant="outline">{activeTasksCount} активных</Badge>}
            />

            {isPending ? (
                <div className="rounded-xl border border-neutral-200 dark:border-neutral-700">
                    <ul className="divide-y divide-neutral-200 dark:divide-neutral-700">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <li key={i} className="px-4 py-3 flex flex-col gap-1.5">
                                <Skeleton className="h-4 w-3/4" />
                                <Skeleton className="h-3 w-1/2" />
                            </li>
                        ))}
                    </ul>
                </div>
            ) : activeTasksCount === 0 ? (
                <div className="flex flex-col items-center rounded-xl border border-dashed border-neutral-200 px-6 py-16 text-center dark:border-neutral-700">
                    <ClipboardList className="size-8 text-neutral-300" />
                    <p className="mt-3 text-sm font-medium">Активных задач нет</p>
                    <p className="mt-1 text-xs text-neutral-500">Задачи появятся после обработки звонков</p>
                    <Button asChild size="sm" className="mt-4">
                        <Link to="/calls">Перейти к звонкам</Link>
                    </Button>
                </div>
            ) : (
                <>
                    <div className="mb-4 flex flex-wrap items-center gap-2">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="gap-1.5">
                                    <Filter className="size-3.5" />
                                    {typeFilter === "all" ? "Тип задачи" : TYPE_LABELS[typeFilter]}
                                    {typeFilter !== "all" && (
                                        <span className="ml-0.5 flex size-4 items-center justify-center rounded-full bg-neutral-800 text-[10px] text-white dark:bg-neutral-300 dark:text-neutral-900">1</span>
                                    )}
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-44">
                                <DropdownMenuLabel className="text-xs text-neutral-400">Тип</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                {TYPE_OPTIONS.map(({ value, label }) => (
                                    <DropdownMenuItem key={value} onClick={() => setTypeFilter(value)} className="flex items-center justify-between">
                                        {label}
                                        {typeFilter === value && <Check className="size-3.5 text-neutral-600" />}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <div className="flex items-center gap-1 rounded-md border border-input bg-background px-1">
                            <button
                                type="button"
                                onClick={() => toggleSort("date")}
                                className={`flex items-center gap-1 rounded px-2 py-1.5 text-xs transition-colors ${sortField === "date" ? "text-neutral-800 dark:text-neutral-100" : "text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"}`}
                            >
                                По дате <SortIcon field="date" />
                            </button>
                            <button
                                type="button"
                                onClick={() => toggleSort("text")}
                                className={`flex items-center gap-1 rounded px-2 py-1.5 text-xs transition-colors ${sortField === "text" ? "text-neutral-800 dark:text-neutral-100" : "text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"}`}
                            >
                                По названию <SortIcon field="text" />
                            </button>
                        </div>
                    </div>

                    {filtered.length === 0 ? (
                        <div className="flex flex-col items-center rounded-xl border border-dashed border-neutral-200 px-6 py-12 text-center dark:border-neutral-700">
                            <ClipboardList className="size-7 text-neutral-300" />
                            <p className="mt-2 text-sm text-neutral-500">Нет задач с выбранным фильтром</p>
                        </div>
                    ) : (
                        <>
                            <div className="rounded-xl border border-neutral-200 dark:border-neutral-700">
                                <ul className="divide-y divide-neutral-200 dark:divide-neutral-700">
                                    {pageItems.map((task) => (
                                        <li key={task.id} className="px-4 py-3">
                                            <button
                                                type="button"
                                                onClick={() => setSelectedRecord(task.record)}
                                                className="w-full text-left"
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <p className="text-sm font-medium leading-5">{task.text}</p>
                                                    {typeFilter === "all" && (
                                                        <span className="shrink-0 rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
                                                            {TYPE_LABELS[task.type]}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="mt-1 text-xs text-neutral-500">
                                                    {task.record.title ?? `Звонок #${task.record.id}`}
                                                    {task.record.callTo ? ` · ${task.record.callTo}` : ""}
                                                    {task.date ? ` · ${new Date(task.date).toLocaleDateString("ru-RU")}` : ""}
                                                </p>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <div className="mt-3 flex items-center justify-between">
                                <p className="text-xs text-neutral-400">{filtered.length} задач</p>
                                <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
                            </div>
                        </>
                    )}
                </>
            )}

            <CallDetailSheet
                record={selectedRecord}
                open={!!selectedRecord}
                onClose={() => setSelectedRecord(null)}
            />
        </div>
    )
}
