import { useQuery } from "@tanstack/react-query"
import { Activity, CheckCircle2, FileAudio, TrendingUp, Users, XCircle } from "lucide-react"
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Line,
    LineChart,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts"
import { healthApi } from "~/axios/health"
import { PageHeader } from "~/components/layout"
import { Badge } from "~/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { useUsers } from "~/hooks/useUsers"
import {
    AGENT_STATS,
    MOCK_RECORDS,
    QUALITY_DISTRIBUTION,
    WEEKLY_CALLS,
} from "~/lib/mock-data"

function StatCard({
    title,
    value,
    sub,
    icon: Icon,
}: {
    title: string
    value: string | number
    sub?: string
    icon: React.ElementType
}) {
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
    const { data: health } = useQuery({
        queryKey: ["health"],
        queryFn: healthApi.check,
        refetchInterval: 30_000,
    })
    const { data: users } = useUsers()

    const totalCalls = MOCK_RECORDS.length
    const successCalls = MOCK_RECORDS.filter((r) => r.status === "success").length
    const failedCalls = MOCK_RECORDS.filter((r) => r.status === "failed").length
    const avgQuality = Math.round(
        MOCK_RECORDS.reduce((acc, r) => acc + r.qualityScore, 0) / MOCK_RECORDS.length,
    )

    const pieData = [
        { name: "Успешные", value: successCalls, fill: "#22c55e" },
        { name: "Отказ", value: failedCalls, fill: "#ef4444" },
        { name: "В обработке", value: totalCalls - successCalls - failedCalls, fill: "#f97316" },
    ]

    return (
        <div>
            <PageHeader
                title="Дэшборд"
                description="Общая аналитика платформы"
                actions={
                    <div className="flex items-center gap-2">
                        {health?.status === "ok" ? (
                            <Badge variant="outline" className="gap-1.5 border-green-200 text-green-700 bg-green-50 dark:border-green-700 dark:bg-green-950/35 dark:text-green-300">
                                <CheckCircle2 className="size-3" />
                                Сервер работает
                            </Badge>
                        ) : (
                            <Badge variant="outline" className="gap-1.5 border-red-200 text-red-700 bg-red-50 dark:border-red-700 dark:bg-red-950/35 dark:text-red-300">
                                <XCircle className="size-3" />
                                Сервер недоступен
                            </Badge>
                        )}
                    </div>
                }
            />

            {/* Stat cards */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <StatCard title="Всего звонков" value={totalCalls} sub="за период" icon={FileAudio} />
                <StatCard title="Успешных" value={successCalls} sub={`${Math.round((successCalls / totalCalls) * 100)}% от всех`} icon={TrendingUp} />
                <StatCard title="Качество звонков" value={`${avgQuality}%`} sub="средний балл" icon={Activity} />
                <StatCard title="Менеджеров" value={users?.length ?? "—"} sub="активных" icon={Users} />
            </div>

            {/* Charts row 1 */}
            <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
                <Card className="lg:col-span-2">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Звонки за неделю</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={200}>
                            <LineChart data={WEEKLY_CALLS}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                                <YAxis tick={{ fontSize: 11 }} />
                                <Tooltip
                                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                                    formatter={(v: number, name: string) => [
                                        v,
                                        name === "calls" ? "Всего" : "Успешных",
                                    ]}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="calls"
                                    stroke="#64748b"
                                    strokeWidth={2}
                                    dot={false}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="success"
                                    stroke="#3b82f6"
                                    strokeWidth={2}
                                    dot={false}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                        <div className="mt-2 flex gap-4 text-xs text-neutral-500">
                            <span className="flex items-center gap-1"><span className="inline-block size-2 rounded-full bg-neutral-500" />Всего</span>
                            <span className="flex items-center gap-1"><span className="inline-block size-2 rounded-full bg-blue-500" />Успешных</span>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Статус звонков</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center">
                        <ResponsiveContainer width="100%" height={160}>
                            <PieChart>
                                <Pie
                                    data={pieData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={45}
                                    outerRadius={70}
                                    dataKey="value"
                                    paddingAngle={3}
                                >
                                    {pieData.map((entry) => (
                                        <Cell key={entry.name} fill={entry.fill} />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="mt-2 flex flex-col gap-1 self-start text-xs text-neutral-600">
                            {pieData.map((d) => (
                                <span key={d.name} className="flex items-center gap-1.5">
                                    <span className="inline-block size-2 rounded-full" style={{ background: d.fill }} />
                                    {d.name}: {d.value}
                                </span>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Charts row 2 */}
            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Распределение качества</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={180}>
                            <BarChart data={QUALITY_DISTRIBUTION} barSize={28}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                <XAxis dataKey="range" tick={{ fontSize: 11 }} />
                                <YAxis tick={{ fontSize: 11 }} />
                                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                                <Bar dataKey="count" name="Звонков" radius={[4, 4, 0, 0]}>
                                    {QUALITY_DISTRIBUTION.map((entry) => (
                                        <Cell key={entry.range} fill={entry.fill} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Статистика по агентам</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={180}>
                            <BarChart data={AGENT_STATS} layout="vertical" barSize={16}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                                <XAxis type="number" tick={{ fontSize: 11 }} />
                                <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={80} />
                                <Tooltip
                                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                                    formatter={(v: number, name: string) => [
                                        v,
                                        name === "calls" ? "Звонков" : "Ср. балл",
                                    ]}
                                />
                                <Bar dataKey="calls" name="Звонков" fill="#64748b" radius={[0, 4, 4, 0]} />
                                <Bar dataKey="avgScore" name="Ср. балл" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
