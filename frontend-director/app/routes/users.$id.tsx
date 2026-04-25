import { ArrowLeft, FileAudio, Loader2, Mail, Phone, Star } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { CallDetailSheet } from "~/components/calls/call-detail-sheet";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { useRecords } from "~/hooks/useRecords";
import { useUsers } from "~/hooks/useUsers";
import { cn } from "~/lib/utils";
import type { Record, RecordStatus } from "~/types/record";

function StatusBadge({ status }: { status: RecordStatus }) {
  if (status === "done") {
    return (
      <Badge
        variant="outline"
        className="border-green-200 bg-green-50 text-green-700 dark:border-green-700 dark:bg-green-950/35 dark:text-green-300"
      >
        Выполнено
      </Badge>
    );
  }

  if (status === "failed") {
    return (
      <Badge
        variant="outline"
        className="border-red-200 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-950/35 dark:text-red-300"
      >
        Ошибка
      </Badge>
    );
  }

  if (status === "not_applicable") {
    return (
      <Badge
        variant="outline"
        className="border-neutral-200 bg-neutral-50 text-neutral-500 dark:border-neutral-700 dark:text-neutral-400"
      >
        Нет аудио
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className="border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-700 dark:bg-orange-950/35 dark:text-orange-300"
    >
      Обработка
    </Badge>
  );
}

function StatItem({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-[10px] uppercase tracking-wide text-neutral-400">
        {label}
      </p>
      <p className="text-xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function getDisplayName(name: string, fio: string | null): string {
  return fio?.trim() || name;
}

function getRecordDate(record: Record): string | null {
  return record.callStartedAt ?? record.startedAt ?? record.finishedAt ?? null;
}

function formatRecordDate(record: Record): string {
  const value = getRecordDate(record);
  return value ? new Date(value).toLocaleDateString("ru-RU") : "—";
}

function formatQuality(value: number | null | undefined): string {
  return value == null ? "—" : `${Math.round(value)}%`;
}

function formatMangoUserId(value: number | null): string {
  return value == null ? "Mango ID не привязан" : `Mango ID: ${value}`;
}

export default function UserDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<Record | null>(null);

  const { data: users = [], isLoading: usersLoading } = useUsers();
  const { data: records = [], isLoading: recordsLoading } = useRecords();

  const userId = id ? Number.parseInt(id, 10) : null;
  const user = users.find((item) => item.id === userId);

  const userRecords = useMemo(
    () => records.filter((record) => record.userId === userId),
    [records, userId],
  );

  const doneCount = userRecords.filter(
    (record) => record.status === "done",
  ).length;
  const failedCount = userRecords.filter(
    (record) => record.status === "failed",
  ).length;

  const scoredRecords = userRecords.filter(
    (record) => record.qualityScore != null,
  );
  const avgQuality =
    scoredRecords.length > 0
      ? scoredRecords.reduce(
          (sum, record) => sum + (record.qualityScore ?? 0),
          0,
        ) / scoredRecords.length
      : null;

  const isLoading = usersLoading || recordsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="size-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center gap-3 py-32 text-center">
        <p className="text-sm text-neutral-500">Пользователь не найден</p>
        <Button variant="outline" size="sm" onClick={() => navigate("/users")}>
          <ArrowLeft className="size-3.5" /> Назад
        </Button>
      </div>
    );
  }

  const displayName = getDisplayName(user.name, user.fio);

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
          aria-label="Назад"
        >
          <ArrowLeft className="size-4" />
        </Button>

        <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-lg font-semibold text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
          {displayName.charAt(0).toUpperCase()}
        </div>

        <div>
          <h1 className="text-lg font-semibold">{displayName}</h1>
          <p className="text-sm text-neutral-400">{user.email}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Профиль</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <div className="flex items-center gap-2 text-neutral-600 dark:text-neutral-400">
              <Mail className="size-3.5 shrink-0" />
              <span className="truncate">{user.email}</span>
            </div>

            {user.fio && (
              <div className="text-neutral-600 dark:text-neutral-400">
                <p className="text-[10px] uppercase tracking-wide text-neutral-400">
                  ФИО
                </p>
                <p className="mt-0.5">{user.fio}</p>
              </div>
            )}

            <div className="flex items-center gap-2 text-neutral-600 dark:text-neutral-400">
              <Phone className="size-3.5 shrink-0" />
              <span>{formatMangoUserId(user.mangoUserId)}</span>
            </div>

            <Badge variant="secondary" className="w-fit text-xs">
              {user.role === "director" ? "Директор" : "Менеджер"}
            </Badge>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Аналитика</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-6 md:grid-cols-4">
            <StatItem label="Всего звонков" value={userRecords.length} />
            <StatItem label="Выполнено" value={doneCount} />
            <StatItem label="Ошибок" value={failedCount} />
            <StatItem label="Средний балл" value={formatQuality(avgQuality)} />
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <h2 className="mb-3 text-sm font-medium text-neutral-700 dark:text-neutral-300">
          Звонки менеджера
        </h2>

        <div
          className={cn(
            "overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-700",
          )}
        >
          <Table>
            <TableHeader>
              <TableRow className="bg-neutral-50/80 dark:bg-neutral-800/80">
                <TableHead>Название</TableHead>
                <TableHead>Контрагент</TableHead>
                <TableHead>Дата</TableHead>
                <TableHead>Длит.</TableHead>
                <TableHead>Балл</TableHead>
                <TableHead>Статус</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {userRecords.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-14 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <FileAudio className="size-8 text-neutral-300" />
                      <p className="text-sm text-neutral-500">Нет звонков</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                userRecords.map((record) => (
                  <TableRow
                    key={record.id}
                    className="cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                    onClick={() => setSelected(record)}
                  >
                    <TableCell className="max-w-48 truncate font-medium">
                      {record.title ?? `Звонок #${record.id}`}
                    </TableCell>
                    <TableCell className="text-neutral-500">
                      {record.callTo ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm text-neutral-500">
                      {formatRecordDate(record)}
                    </TableCell>
                    <TableCell className="text-sm tabular-nums text-neutral-500">
                      {record.durationSec != null
                        ? formatDuration(record.durationSec)
                        : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-neutral-500">
                      <span className="inline-flex items-center gap-1">
                        <Star className="size-3.5" />
                        {formatQuality(record.qualityScore)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={record.status} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <p className="mt-2 text-xs text-neutral-400">
          {userRecords.length} записей
        </p>
      </div>

      <CallDetailSheet
        record={selected}
        open={!!selected}
        onClose={() => setSelected(null)}
        agentName={displayName}
      />
    </div>
  );
}
