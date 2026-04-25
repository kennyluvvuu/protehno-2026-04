import { ArrowLeft, FileAudio, Loader2, Mail, Phone } from "lucide-react"
import { useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router"
import { CallDetailSheet } from "~/components/calls/call-detail-sheet"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table"
import { useRecords } from "~/hooks/useRecords"
import { useUsers } from "~/hooks/useUsers"
import { cn } from "~/lib/utils"
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

function StatItem({ label, value }: { label: string; value: string | number }) {
    return (
        <div className="flex flex-col gap-0.5">
            <p className="text-[10px] uppercase tracking-wide text-neutral-400">{label}</p>
            <p className="text-xl font-semibold tracking-tight">{value}</p>
        </div>
    )
}

function formatDuration(sec: number): string {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${m}:${s.toString().padStart(2, "0")}`
}

export default function UserDetailPage() {
    const { id } = useParams()
    const navigate = useNavigate()
    const [selected, setSelected] = useState<Record | null>(null)

    const { data: users = [], isLoading: usersLoading } = useUsers()
    const { data: records = [], isLoading: recordsLoading } = useRecords()

    const userId = id ? parseInt(id, 10) : null
    const user = users.find((u) => u.id === userId)
    const userRecords = useMemo(
        () => records.filter((r) => r.userId === userId),
        [records, userId],
    )

    const done = userRecords.filter((r) => r.status === "done").length
    const failed = userRecords.filter((r) => r.status === "failed").length

    const isLoading = usersLoading || recordsLoading

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-32">
                <Loader2 className="size-6 animate-spin text-neutral-400" />
            </div>
        )
    }

    if (!user) {
        return (
            <div className="flex flex-col items-center gap-3 py-32 text-center">
                <p className="text-sm text-neutral-500">Пользователь не найден</p>
                <Button variant="outline" size="sm" onClick={() => navigate("/users")}>
                    <ArrowLeft className="size-3.5" /> Назад
                </Button>
            </div>
        )
    }

    return (
        <div>
            <div className="mb-6 flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Назад">
                    <ArrowLeft className="size-4" />
                </Button>
                <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-lg font-semibold text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                    {user.name.charAt(0).toUpperCase()}
                </div>
                <div>
                    <h1 className="text-lg font-semibold">{user.name}</h1>
                    <p className="text-sm text-neutral-400">{user.email}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                {/* Profile card */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium">Профиль</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3 text-sm">
                        <div className="flex items-center gap-2 text-neutral-600 dark:text-neutral-400">
                            <Mail className="size-3.5 shrink-0" />
                            <span className="truncate">{user.email}</span>
                        </div>
                        {user.mangoUserId && (
                            <div className="flex items-center gap-2 text-neutral-600 dark:text-neutral-400">
                                <Phone className="size-3.5 shrink-0" />
                                <span>Mango ID: {user.mangoUserId}</span>
                            </div>
                        )}
                        <Badge variant="secondary" className="w-fit text-xs">Менеджер</Badge>
                    </CardContent>
                </Card>

                {/* Stats card */}
                <Card className="lg:col-span-2">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium">Аналитика</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-3 gap-6">
                        <StatItem label="Всего звонков" value={userRecords.length} />
                        <StatItem label="Выполнено" value={done} />
                        <StatItem label="Ошибок" value={failed} />
                    </CardContent>
                </Card>
            </div>

            {/* Calls table */}
            <div className="mt-6">
                <h2 className="mb-3 text-sm font-medium text-neutral-700 dark:text-neutral-300">Звонки менеджера</h2>
                <div className={cn("rounded-xl border border-neutral-200 dark:border-neutral-700 overflow-hidden")}>
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-neutral-50/80 dark:bg-neutral-800/80">
                                <TableHead>Название</TableHead>
                                <TableHead>Контрагент</TableHead>
                                <TableHead>Дата</TableHead>
                                <TableHead>Длит.</TableHead>
                                <TableHead>Статус</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {userRecords.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="py-14 text-center">
                                        <div className="flex flex-col items-center gap-2">
                                            <FileAudio className="size-8 text-neutral-300" />
                                            <p className="text-sm text-neutral-500">Нет звонков</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                userRecords.map((r) => (
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
                <p className="mt-2 text-xs text-neutral-400">{userRecords.length} записей</p>
            </div>

            <CallDetailSheet record={selected} open={!!selected} onClose={() => setSelected(null)} agentName={user.name} />
        </div>
    )
}
