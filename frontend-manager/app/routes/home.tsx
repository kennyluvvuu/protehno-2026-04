import {
  Activity,
  ArrowRight,
  ClipboardList,
  FileAudio,
  List,
  TrendingUp,
} from "lucide-react";
import { useMemo } from "react";
import { Link, useOutletContext } from "react-router";
import { useQuery } from "@tanstack/react-query";
import type { User } from "~/types/auth";
import { healthApi } from "~/axios/health";
import { PageHeader } from "~/components/layout";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { useRecords } from "~/hooks/useRecords";

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

export default function Dashboard() {
  const { user } = useOutletContext<{ user: User }>();
  const { data: records = [], isPending } = useRecords();
  const { data: health } = useQuery({
    queryKey: ["health"],
    queryFn: healthApi.check,
    refetchInterval: 30_000,
  });

  const total = records.length;
  const done = records.filter((r) => r.status === "done").length;
  const failed = records.filter((r) => r.status === "failed").length;
  const successRate = total > 0 ? Math.round((done / total) * 100) : 0;

  const pendingTasks = useMemo(() => {
    const getDisplayCounterparty = (record: (typeof records)[number]) => {
      if (record.callTo) return record.callTo;
      if (record.directionKind === "inbound") {
        return record.callerNumber ?? record.calleeNumber ?? null;
      }
      if (record.directionKind === "outbound") {
        return record.calleeNumber ?? record.callerNumber ?? null;
      }
      return record.callerNumber ?? record.calleeNumber ?? null;
    };

    return records
      .flatMap((record) =>
        (record.checkboxes?.tasks ?? [])
          .filter((t) => !t.checked)
          .map((t) => ({
            text: t.label,
            recordTitle: record.title ?? `Звонок #${record.id}`,
            callTo: getDisplayCounterparty(record),
          })),
      )
      .slice(0, 5);
  }, [records]);

  return (
    <div>
      <PageHeader
        title={`Добро пожаловать, ${user.fio ?? user.name}`}
        description="Обзор ваших звонков"
        healthStatus={health?.status}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {isPending ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-5">
                <div className="flex items-start justify-between">
                  <div className="flex flex-col gap-2">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-7 w-16" />
                    <Skeleton className="h-3 w-20" />
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
              value={total}
              sub="в вашем feed"
              icon={FileAudio}
            />
            <StatCard
              title="Выполнено"
              value={done}
              sub={`${successRate}% от всех`}
              icon={TrendingUp}
            />
            <StatCard
              title="Успешность"
              value={`${successRate}%`}
              sub="обработка AI"
              icon={Activity}
            />
            <StatCard
              title="Ошибок"
              value={failed}
              sub="требуют внимания"
              icon={List}
            />
          </>
        )}
      </div>

      {!isPending && total === 0 && (
        <div className="mt-8 flex flex-col items-center justify-center rounded-xl border border-dashed border-neutral-200 px-6 py-16 text-center dark:border-neutral-800">
          <div className="flex size-12 items-center justify-center rounded-full bg-neutral-100 text-neutral-500 dark:bg-neutral-900">
            <FileAudio className="size-5" />
          </div>
          <p className="mt-4 text-sm font-medium">Нет записей</p>
          <p className="mt-1 max-w-xs text-xs text-neutral-500">
            Загрузите первый звонок через раздел «Загрузить»
          </p>
        </div>
      )}

      {!isPending && total > 0 && (
        <div className="mt-6">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                  <ClipboardList className="size-4 text-neutral-500" />
                  Активные задачи
                </CardTitle>
                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className="gap-1 text-xs text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                >
                  <Link to="/tasks">
                    Все задачи
                    <ArrowRight className="size-3" />
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {pendingTasks.length === 0 ? (
                <div className="flex flex-col items-center gap-1 py-8 text-center">
                  <ClipboardList className="size-7 text-neutral-300" />
                  <p className="text-sm text-neutral-500">Активных задач нет</p>
                </div>
              ) : (
                <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
                  {pendingTasks.map((task, i) => (
                    <li key={i} className="flex items-start gap-3 py-2.5">
                      <div className="mt-1 size-1.5 shrink-0 rounded-full bg-neutral-400" />
                      <div className="min-w-0">
                        <p className="text-sm leading-5">{task.text}</p>
                        <p className="mt-0.5 text-xs text-neutral-400">
                          {task.recordTitle}
                          {task.callTo ? ` · ${task.callTo}` : ""}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
