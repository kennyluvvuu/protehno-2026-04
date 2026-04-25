import { Activity, CheckCircle2, FileAudio, List, TrendingUp, Upload, XCircle } from "lucide-react"
import { useOutletContext } from "react-router"
import { Link } from "react-router"
import type { User } from "~/types/auth"
import { PageHeader } from "~/components/layout"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent } from "~/components/ui/card"
import { useRecords } from "~/hooks/useRecords"
import { useQuery } from "@tanstack/react-query"
import { healthApi } from "~/axios/health"

function StatCard({ title, value, sub, icon: Icon }: { title: string; value: string | number; sub?: string; icon: React.ElementType }) {
    return (
        <Card>
            <CardContent className="pt-5">
                <div className="flex items-start justify-between">
                    <div>
                        <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide">{title}</p>
                        <p className="mt-1.5 text-2xl font-semibold tracking-tight">{value}</p>
                        {sub && <p className="mt-0.5 text-xs text-neutral-400">{sub}</p>}
                    </div>
                    <div className="flex size-9 items-center justify-center rounded-lg bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
                        <Icon className="size-4" />
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}

export default function Dashboard() {
    const { user } = useOutletContext<{ user: User }>()
    const { data: health } = useQuery({ queryKey: ["health"], queryFn: healthApi.check, refetchInterval: 30_000 })
    const { data: records = [] } = useRecords()

    const total = records.length
    const done = records.filter((r) => r.status === "done").length
    const failed = records.filter((r) => r.status === "failed").length
    const successRate = total > 0 ? Math.round((done / total) * 100) : 0

    return (
        <div>
            <PageHeader
                title={`Добро пожаловать, ${user.name}`}
                description="Обзор ваших звонков"
                actions={
                    <div className="flex items-center gap-2">
                        {health?.status === "ok" ? (
                            <Badge variant="outline" className="gap-1.5 border-green-200 text-green-700 bg-green-50 dark:border-green-700 dark:bg-green-950/35 dark:text-green-300">
                                <CheckCircle2 className="size-3" />Сервер работает
                            </Badge>
                        ) : (
                            <Badge variant="outline" className="gap-1.5 border-red-200 text-red-700 bg-red-50 dark:border-red-700 dark:bg-red-950/35 dark:text-red-300">
                                <XCircle className="size-3" />Сервер недоступен
                            </Badge>
                        )}
                        <Button asChild size="sm" className="gap-1.5">
                            <Link to="/upload">
                                <Upload className="size-4" />
                                Загрузить звонок
                            </Link>
                        </Button>
                    </div>
                }
            />

            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <StatCard title="Всего записей" value={total} sub="в вашем feed" icon={FileAudio} />
                <StatCard title="Выполнено" value={done} sub={`${successRate}% от всех`} icon={TrendingUp} />
                <StatCard title="Успешность" value={`${successRate}%`} sub="обработка AI" icon={Activity} />
                <StatCard title="Ошибок" value={failed} sub="требуют внимания" icon={List} />
            </div>

            {total === 0 && (
                <div className="mt-8 flex flex-col items-center justify-center rounded-xl border border-dashed border-neutral-200 px-6 py-16 text-center dark:border-neutral-800">
                    <div className="flex size-12 items-center justify-center rounded-full bg-neutral-100 text-neutral-500 dark:bg-neutral-900">
                        <FileAudio className="size-5" />
                    </div>
                    <p className="mt-4 text-sm font-medium">Нет записей</p>
                    <p className="mt-1 max-w-xs text-xs text-neutral-500">Загрузите первый звонок, чтобы запустить AI-обработку</p>
                    <Button asChild size="sm" className="mt-4 gap-1.5">
                        <Link to="/upload">
                            <Upload className="size-4" />
                            Загрузить звонок
                        </Link>
                    </Button>
                </div>
            )}
        </div>
    )
}
