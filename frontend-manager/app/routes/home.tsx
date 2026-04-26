import {
  Activity,
  Clock,
  FileAudio,
  PhoneMissed,
  TrendingUp,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useOutletContext } from "react-router";
import { useQuery } from "@tanstack/react-query";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { healthApi } from "~/axios/health";
import { PageHeader } from "~/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Skeleton } from "~/components/ui/skeleton";
import { useRecords } from "~/hooks/useRecords";
import type { User } from "~/types/auth";
import type { Record } from "~/types/record";

type Period = "7d" | "14d" | "30d" | "90d";

const PERIOD_OPTIONS: Array<{ value: Period; label: string }> = [
  { value: "7d", label: "7 дней" },
  { value: "14d", label: "14 дней" },
  { value: "30d", label: "30 дней" },
  { value: "90d", label: "90 дней" },
];

const PERIOD_DAYS: Record<Period, number> = {
  "7d": 7,
  "14d": 14,
  "30d": 30,
  "90d": 90,
};

function isMissed(record: Record): boolean {
  return (
    record.isMissed === true ||
    record.ingestionStatus === "no_audio" ||
    record.status === "not_applicable" ||
    (record.talkDurationSec != null && record.talkDurationSec === 0)
  );
}

function getActivityDate(record: Record): Date | null {
  const raw =
    record.callStartedAt ??
    record.callEndedAt ??
    record.callAnsweredAt ??
    record.finishedAt ??
    record.startedAt;
  return raw ? new Date(raw) : null;
}

function formatPercent(value: number | null): string {
  return value == null ? "—" : `${Math.round(value)}%`;
}

function formatDuration(sec: number | null): string {
  if (sec == null) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatShortDate(date: Date): string {
  return date.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });
}

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
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">{title}</p>
            <p className="mt-1.5 text-2xl font-semibold tracking-tight">{value}</p>
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

export default function Dashboard() {
  const { user } = useOutletContext<{ user: User }>();
  const [period, setPeriod] = useState<Period>("7d");

  const { data: health } = useQuery({
    queryKey: ["health"],
    queryFn: healthApi.check,
    refetchInterval: 30_000,
  });

  const { data: allRecords = [], isPending } = useRecords();

  // фильтруем по выбранному периоду
  const records = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - PERIOD_DAYS[period]);
    return allRecords.filter((r) => {
      const d = getActivityDate(r);
      return d != null && d >= cutoff;
    });
  }, [allRecords, period]);

  const totalRecords = records.length;
  const doneRecords = records.filter((r) => r.status === "done").length;
  const missedRecords = records.filter(isMissed).length;
  const successRate = totalRecords > 0 ? Math.round((doneRecords / totalRecords) * 100) : 0;

  const avgQualityScore = useMemo(() => {
    const scored = records.filter((r) => r.qualityScore != null);
    if (scored.length === 0) return null;
    return scored.reduce((sum, r) => sum + (r.qualityScore ?? 0), 0) / scored.length;
  }, [records]);

  const avgTalkDuration = useMemo(() => {
    const withDuration = records.filter((r) => {
      const d = r.durationSec ?? r.talkDurationSec;
      return d != null && d > 0;
    });
    if (withDuration.length === 0) return null;
    return withDuration.reduce((sum, r) => sum + (r.durationSec ?? r.talkDurationSec ?? 0), 0) / withDuration.length;
  }, [records]);

  // тренд по дням
  const trendData = useMemo(() => {
    const days = PERIOD_DAYS[period];
    const map = new Map<string, { total: number; done: number; failed: number; missed: number }>();

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = formatShortDate(d);
      map.set(key, { total: 0, done: 0, failed: 0, missed: 0 });
    }

    for (const r of records) {
      const d = getActivityDate(r);
      if (!d) continue;
      const key = formatShortDate(d);
      const entry = map.get(key);
      if (!entry) continue;
      entry.total++;
      if (r.status === "done") entry.done++;
      if (r.status === "failed") entry.failed++;
      if (isMissed(r)) entry.missed++;
    }

    return Array.from(map.entries()).map(([day, v]) => ({ day, ...v }));
  }, [records, period]);

  return (
    <div>
      <PageHeader
        title={`Добро пожаловать, ${user.fio ?? user.name}`}
        description="Ваша аналитика"
        healthStatus={health?.status}
        actions={
          <div className="w-full sm:w-[160px]">
            <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
              <SelectTrigger>
                <SelectValue placeholder="Период" />
              </SelectTrigger>
              <SelectContent>
                {PERIOD_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-5">
        {isPending
          ? Array.from({ length: 5 }).map((_, i) => (
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
          : (
            <>
              <StatCard title="Всего записей" value={totalRecords} sub="за период" icon={FileAudio} />
              <StatCard title="Выполнено" value={doneRecords} sub={`${successRate}% от всех`} icon={TrendingUp} />
              <StatCard title="Средний балл" value={formatPercent(avgQualityScore)} sub="quality score" icon={Activity} />
              <StatCard title="Пропущено" value={missedRecords} sub="нет аудио / пропущено" icon={PhoneMissed} />
              <StatCard title="Ср. длит." value={formatDuration(avgTalkDuration)} sub="разговора" icon={Clock} />
            </>
          )}
      </div>

      {/* Trend chart */}
      <div className="mt-6">
        {isPending ? (
          <Card>
            <CardHeader className="pb-2"><Skeleton className="h-4 w-32" /></CardHeader>
            <CardContent><Skeleton className="h-[200px] w-full rounded-lg" /></CardContent>
          </Card>
        ) : totalRecords === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-neutral-200 px-6 py-16 text-center dark:border-neutral-800">
            <div className="flex size-12 items-center justify-center rounded-full bg-neutral-100 text-neutral-500 dark:bg-neutral-900">
              <FileAudio className="size-5" />
            </div>
            <p className="mt-4 text-sm font-medium">Нет данных за период</p>
            <p className="mt-1 max-w-xs text-xs text-neutral-500">
              Загрузите звонки или выберите другой период
            </p>
          </div>
        ) : (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Тренд звонков</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    formatter={(v: number, name: string): [number, string] => [
                      v,
                      ({ total: "Всего", done: "Выполнено", failed: "Ошибки", missed: "Пропущено" } as Record<string, string>)[name] ?? name,
                    ]}
                  />
                  <Line type="monotone" dataKey="total" stroke="#64748b" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="done" stroke="#22c55e" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="failed" stroke="#ef4444" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="missed" stroke="#f97316" strokeWidth={2} dot={false} />
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
                    <span className="inline-block size-2 rounded-full" style={{ background: l.color }} />
                    {l.label}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
