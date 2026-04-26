import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  CheckCircle2,
  Clock,
  FileAudio,
  PhoneMissed,
  TrendingUp,
  Users,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate, useOutletContext } from "react-router";
import {
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
} from "recharts";
import { healthApi } from "~/axios/health";
import { PageHeader } from "~/components/layout";
import { ManagersModal } from "~/components/users/managers-modal";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { useGlobalStats, type StatsPeriod } from "~/hooks/useStats";
import type { User } from "~/types/auth";

const PERIOD_OPTIONS: Array<{ value: StatsPeriod; label: string }> = [
  { value: "7d", label: "7 дней" },
  { value: "14d", label: "14 дней" },
  { value: "30d", label: "30 дней" },
  { value: "90d", label: "90 дней" },
  { value: "all", label: "Все время" },
];

function formatPercent(value: number | null): string {
  return value == null ? "—" : `${Math.round(value)}%`;
}

function formatDuration(sec: number | null): string {
  if (sec == null) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
  });
}

function StatCard({
  title,
  value,
  sub,
  icon: Icon,
  onClick,
}: {
  title: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  onClick?: () => void;
}) {
  const inner = (
    <CardContent className="pt-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            {title}
          </p>
          <p className="mt-1.5 text-2xl font-semibold tracking-tight">
            {value}
          </p>
          {sub && <p className="mt-0.5 text-xs text-neutral-400">{sub}</p>}
        </div>
        <div className="flex size-9 items-center justify-center rounded-lg bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
          <Icon className="size-4" />
        </div>
      </div>
    </CardContent>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="text-left">
        <Card>{inner}</Card>
      </button>
    );
  }

  return <Card>{inner}</Card>;
}

export default function Dashboard() {
  const { user } = useOutletContext<{ user: User }>();
  const navigate = useNavigate();
  const [managersOpen, setManagersOpen] = useState(false);
  const [period, setPeriod] = useState<StatsPeriod>("7d");

  const { data: health } = useQuery({
    queryKey: ["health"],
    queryFn: healthApi.check,
    refetchInterval: 30_000,
  });

  const { data: stats, isPending } = useGlobalStats({ period });

  const ov = stats?.overview;
  const successRate =
    ov && ov.totalRecords > 0
      ? Math.round((ov.doneRecords / ov.totalRecords) * 100)
      : 0;

  const trendData = useMemo(
    () =>
      (stats?.trend ?? []).map((t) => ({
        day: formatDate(t.date),
        total: t.total,
        done: t.done,
        failed: t.failed,
        missed: t.missed,
      })),
    [stats],
  );

  const ownershipData = useMemo(
    () =>
      stats?.ownership
        ? [
            {
              name: "Привязано",
              value: stats.ownership.assigned,
              fill: "#3b82f6",
            },
            {
              name: "Без владельца",
              value: stats.ownership.unassigned,
              fill: "#f97316",
            },
          ]
        : [],
    [stats],
  );

  return (
    <div>
      <PageHeader
        title="Дэшборд"
        description="Общая аналитика платформы"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-full sm:w-[160px]">
              <Select
                value={period}
                onValueChange={(v) => setPeriod(v as StatsPeriod)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Период" />
                </SelectTrigger>
                <SelectContent>
                  {PERIOD_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        }
      />

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        {isPending ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-5">
                <div className="flex items-start justify-between">
                  <div className="flex flex-col gap-2">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-7 w-14" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                  <Skeleton className="size-9 rounded-lg" />
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <StatCard
              title="Всего записей"
              value={ov?.totalRecords ?? 0}
              sub="за период"
              icon={FileAudio}
              onClick={() => navigate("/calls")}
            />
            <StatCard
              title="Выполнено"
              value={ov?.doneRecords ?? 0}
              sub={`${successRate}% от всех`}
              icon={TrendingUp}
            />
            <StatCard
              title="Средний балл"
              value={formatPercent(ov?.avgQualityScore ?? null)}
              sub="quality score"
              icon={Activity}
            />
            <StatCard
              title="Пропущено"
              value={ov?.missedRecords ?? 0}
              sub="нет аудио / пропущено"
              icon={PhoneMissed}
            />
            <StatCard
              title="Ср. длит."
              value={formatDuration(ov?.avgTalkDurationSec ?? null)}
              sub="разговора"
              icon={Clock}
            />
            <StatCard
              title="Менеджеров"
              value={ov?.totalManagers ?? 0}
              sub="нажмите для просмотра"
              icon={Users}
              onClick={() => setManagersOpen(true)}
            />
          </>
        )}
      </div>

      <ManagersModal
        open={managersOpen}
        onClose={() => setManagersOpen(false)}
        currentUserId={user.id}
      />

      {/* Trend + Ownership */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {isPending ? (
          <>
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-[200px] w-full rounded-lg" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-28" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-[160px] w-full rounded-lg" />
              </CardContent>
            </Card>
          </>
        ) : (
          <>
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Тренд звонков
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8 }}
                      formatter={(v: number, name: string) => [
                        v,
                        {
                          total: "Всего",
                          done: "Выполнено",
                          failed: "Ошибки",
                          missed: "Пропущено",
                        }[name] ?? name,
                      ]}
                    />
                    <Line
                      type="monotone"
                      dataKey="total"
                      stroke="#64748b"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="done"
                      stroke="#22c55e"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="failed"
                      stroke="#ef4444"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="missed"
                      stroke="#f97316"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
                <div className="mt-2 flex flex-wrap gap-4 text-xs text-neutral-500">
                  {[
                    { color: "#64748b", label: "Всего" },
                    { color: "#22c55e", label: "Выполнено" },
                    { color: "#ef4444", label: "Ошибки" },
                    { color: "#f97316", label: "Пропущено" },
                  ].map((l) => (
                    <span key={l.label} className="flex items-center gap-1">
                      <span
                        className="inline-block size-2 rounded-full"
                        style={{ background: l.color }}
                      />
                      {l.label}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Привязка записей
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center">
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie
                      data={ownershipData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={70}
                      dataKey="value"
                      paddingAngle={3}
                    >
                      {ownershipData.map((entry) => (
                        <Cell key={entry.name} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-2 flex flex-col gap-1 self-start text-xs text-neutral-600">
                  {ownershipData.map((d) => (
                    <span key={d.name} className="flex items-center gap-1.5">
                      <span
                        className="inline-block size-2 rounded-full"
                        style={{ background: d.fill }}
                      />
                      {d.name}: {d.value}
                    </span>
                  ))}
                  {stats?.ownership.unassignedMango != null &&
                    stats.ownership.unassignedMango > 0 && (
                      <span className="mt-1 text-neutral-400">
                        в т.ч. Mango без маппинга:{" "}
                        {stats.ownership.unassignedMango}
                      </span>
                    )}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* By agent table */}
      <div className="mt-4">
        {isPending ? (
          <Card>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-40" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[180px] w-full rounded-lg" />
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Статистика по менеджерам
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-neutral-50/80 dark:bg-neutral-900/80">
                    <TableHead>Менеджер</TableHead>
                    <TableHead>Всего</TableHead>
                    <TableHead>Выполнено</TableHead>
                    <TableHead>Ошибки</TableHead>
                    <TableHead>Пропущено</TableHead>
                    <TableHead>Ср. длит.</TableHead>
                    <TableHead>Ср. балл</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(stats?.byAgent ?? []).length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="py-10 text-center text-sm text-neutral-400"
                      >
                        Нет данных
                      </TableCell>
                    </TableRow>
                  ) : (
                    (stats?.byAgent ?? []).map((row) => (
                      <TableRow
                        key={row.userId}
                        className="cursor-pointer hover:bg-neutral-50/60 dark:hover:bg-neutral-900/40"
                        onClick={() => navigate(`/users/${row.userId}`)}
                      >
                        <TableCell className="font-medium">
                          {row.name}
                        </TableCell>
                        <TableCell>{row.total}</TableCell>
                        <TableCell className="text-green-600 dark:text-green-400">
                          {row.done}
                        </TableCell>
                        <TableCell className="text-red-600 dark:text-red-400">
                          {row.failed}
                        </TableCell>
                        <TableCell className="text-orange-600 dark:text-orange-400">
                          {row.missed}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {formatDuration(row.avgTalkDurationSec)}
                        </TableCell>
                        <TableCell>
                          {formatPercent(row.avgQualityScore)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
