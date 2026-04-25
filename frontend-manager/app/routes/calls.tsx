import { FileAudio, Loader2 } from "lucide-react"
import { useState } from "react"
import { CallDetailSheet } from "~/components/calls/call-detail-sheet"
import { Badge } from "~/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table"
import { PageHeader } from "~/components/layout"
import { useRecords } from "~/hooks/useRecords"
import { cn } from "~/lib/cn"
import type { Record, RecordStatus } from "~/types/record"

function StatusBadge({ status }: { status: RecordStatus }) {
    if (status === "done")
        return <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700 dark:border-green-700 dark:bg-green-950/35 dark:text-green-300">Выполнено</Badge>
    if (status === "failed")
        return <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-950/35 dark:text-red-300">Ошибка</Badge>
    if (status === "not_applicable")
        return <Badge variant="outline" className="border-neutral-200 bg-neutral-50 text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">Нет аудио</Badge>
    return <Badge variant="outline" className="border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-700 dark:bg-orange-950/35 dark:text-orange-300">Обработка</Badge>
}

function formatDuration(sec: number): string {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${m}:${s.toString().padStart(2, "0")}`
}

export default function CallsPage() {
    const { data: records = [], isLoading } = useRecords()
    const [selected, setSelected] = useState<Record | null>(null)

    return (
        <div>
            <PageHeader title="Мои звонки" description="Ваши записи звонков и результаты обработки" />

            <div className={cn("rounded-xl border border-neutral-200 dark:border-neutral-700 overflow-hidden")}>
                <Table>
                    <TableHeader>
                        <TableRow className="bg-neutral-50/80 dark:bg-neutral-900/80">
                            <TableHead>Название</TableHead>
                            <TableHead>Контрагент</TableHead>
                            <TableHead>Дата</TableHead>
                            <TableHead>Длит.</TableHead>
                            <TableHead>Статус</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={5} className="py-16 text-center">
                                    <Loader2 className="mx-auto size-6 animate-spin text-neutral-400" />
                                </TableCell>
                            </TableRow>
                        ) : records.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="py-16 text-center">
                                    <div className="flex flex-col items-center gap-2">
                                        <FileAudio className="size-8 text-neutral-300" />
                                        <p className="text-sm text-neutral-500">Нет звонков</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            records.map((r) => (
                                <TableRow key={r.id} className="cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800/50" onClick={() => setSelected(r)}>
                                    <TableCell className="font-medium max-w-48 truncate">{r.title ?? `Звонок #${r.id}`}</TableCell>
                                    <TableCell className="text-neutral-500">{r.callTo ?? "—"}</TableCell>
                                    <TableCell className="text-neutral-500 text-sm">{r.startedAt ? new Date(r.startedAt).toLocaleDateString("ru-RU") : "—"}</TableCell>
                                    <TableCell className="text-neutral-500 text-sm tabular-nums">{r.durationSec != null ? formatDuration(r.durationSec) : "—"}</TableCell>
                                    <TableCell><StatusBadge status={r.status} /></TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {!isLoading && (
                <p className="mt-2 text-xs text-neutral-400">{records.length} записей</p>
            )}

            <CallDetailSheet record={selected} open={!!selected} onClose={() => setSelected(null)} />
        </div>
    )
}
