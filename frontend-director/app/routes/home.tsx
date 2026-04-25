import { useQuery } from "@tanstack/react-query";
import {
  useStatsByAgent,
  useStatsOverview,
  useStatsWeekly,
} from "~/hooks/useStats";
import {
  Activity,
  CheckCircle2,
  FileAudio,
  TrendingUp,
  Users,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useOutletContext } from "react-router";
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
} from "recharts";
import { healthApi } from "~/axios/health";
import { PageHeader } from "~/components/layout";
import { ManagersModal } from "~/components/users/managers-modal";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import type { User } from "~/types/auth";

function StatCard({
  title,
  value,
  sub,
  icon: Icon,
}: {
  title: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
}) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide">
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
    </Card>
  );
}

function formatWeekLabel(date: string): string {
  return new Date(date).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
  });
}

function formatPercent(value: number | null): string {
  return value == null ? "—" : `${Math.round(value)}%`;
}

export default function Dashboard() {
  const { user } = useOutletContext<{ user: User }>();
  const [managersOpen, setManagersOpen] = useState(false);

  const { data: health } = useQuery({
    queryKey: ["health"],
    queryFn: healthApi.check,
    refetchInterval: 30_000,
  });

  const { data: overview } = useStatsOverview();

  const { data: weekly = [] } = useStatsWeekly();

  const { data: byAgent = [] } = useStatsByAgent();

  const totalCalls = overview?.totalRecords ?? 0;
  const doneCalls = overview?.doneRecords ?? 0;
  const failedCalls = overview?.failedRecords ?? 0;
  const inProgressCalls = Math.max(totalCalls - doneCalls - failedCalls, 0);
  const totalManagers = overview?.totalManagers ?? 0;
  const avgQualityScore = overview?.avgQualityScore ?? null;
  const successRate =
    totalCalls > 0 ? Math.round((doneCalls / totalCalls) * 100) : 0;

  const pieData = useMemo(
    () => [
      { name: "Выполнено", value: doneCalls, fill: "#22c55e" },
      { name: "Ошибка", value: failedCalls, fill: "#ef4444" },
      { name: "В обработке", value: inProgressCalls, fill: "#f97316" },
    ],
    [doneCalls, failedCalls, inProgressCalls],
  );

  const weeklyChartData = useMemo(
    () =>
      weekly.map((item) => ({
        day: formatWeekLabel(item.date),
        calls: item.total,
        success: item.done,
      })),
    [weekly],
  );

  const agentChartData = useMemo(
    () =>
      byAgent.map((item) => ({
        name: item.name,
        calls: item.total,
        avgScore:
          item.avgQualityScore == null ? 0 : Math.round(item.avgQualityScore),
      })),
    [byAgent],
  );

  return (
    <div>
      <PageHeader
        title="Дэшборд"
        description="Общая аналитика платформы"
        actions={
          <div className="flex items-center gap-2">
            {health?.status === "ok" ? (
              <Badge
                variant="outline"
                className="gap-1.5 border-green-200 text-green-700 bg-green-50 dark:border-green-700 dark:bg-green-950/35 dark:text-green-300"
              >
                <CheckCircle2 className="size-3" />
                Сервер работает
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="gap-1.5 border-red-200 text-red-700 bg-red-50 dark:border-red-700 dark:bg-red-950/35 dark:text-red-300"
              >
                <XCircle className="size-3" />
                Сервер недоступен
              </Badge>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          title="Всего записей"
          value={totalCalls}
          sub="по backend stats"
          icon={FileAudio}
        />
        <StatCard
          title="Выполнено"
          value={doneCalls}
          sub={`${successRate}% от всех`}
          icon={TrendingUp}
        />
        <StatCard
          title="Средний балл"
          value={formatPercent(avgQualityScore)}
          sub="quality score"
          icon={Activity}
        />
        <button
          type="button"
          onClick={() => setManagersOpen(true)}
          className="text-left"
        >
          <StatCard
            title="Менеджеров"
            value={totalManagers}
            sub="нажмите для просмотра"
            icon={Users}
          />
        </button>
      </div>

      <ManagersModal
        open={managersOpen}
        onClose={() => setManagersOpen(false)}
        currentUserId={user.id}
      />

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Звонки за неделю
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={weeklyChartData}>
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
              <span className="flex items-center gap-1">
                <span className="inline-block size-2 rounded-full bg-neutral-500" />
                Всего
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block size-2 rounded-full bg-blue-500" />
                Успешных
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Статус обработки
            </CardTitle>
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
                  <span
                    className="inline-block size-2 rounded-full"
                    style={{ background: d.fill }}
                  />
                  {d.name}: {d.value}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Статистика по агентам
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={agentChartData} layout="vertical" barSize={16}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#f0f0f0"
                  horizontal={false}
                />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis
                  dataKey="name"
                  type="category"
                  tick={{ fontSize: 11 }}
                  width={120}
                />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  formatter={(v: number, name: string) => [
                    v,
                    name === "calls" ? "Звонков" : "Ср. балл",
                  ]}
                />
                <Bar
                  dataKey="calls"
                  name="Звонков"
                  fill="#64748b"
                  radius={[0, 4, 4, 0]}
                />
                <Bar
                  dataKey="avgScore"
                  name="Ср. балл"
                  fill="#3b82f6"
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
