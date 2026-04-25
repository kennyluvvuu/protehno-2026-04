import { useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CalendarDays,
  Check,
  Filter,
  Mic,
  Search,
  X,
} from "lucide-react";
import { CallDetailSheet } from "~/components/calls/call-detail-sheet";
import { PageHeader } from "~/components/layout";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Input } from "~/components/ui/input";
import { Pagination } from "~/components/ui/pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { usePagination } from "~/hooks/usePagination";
import { useRecords } from "~/hooks/useRecords";
import { useUsers } from "~/hooks/useUsers";
import { cn } from "~/lib/utils";
import type { Record, RecordStatus, SortDir, SortField } from "~/types/record";

type StatusFilter = RecordStatus | "all";

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Все статусы" },
  { value: "uploaded", label: "Загружено" },
  { value: "queued", label: "В очереди" },
  { value: "processing", label: "В обработке" },
  { value: "done", label: "Выполнено" },
  { value: "failed", label: "Ошибка" },
];

function formatDuration(sec: number): string {
  const minutes = Math.floor(sec / 60);
  const seconds = sec % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function formatShortDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${day}.${month}.${year.slice(2)}`;
}

function getDisplayTitle(record: Record): string {
  return record.title ?? `Звонок #${record.id}`;
}

function getRecordDate(record: Record): string | null {
  return record.callStartedAt ?? record.startedAt ?? record.finishedAt ?? null;
}

function getDisplayDuration(record: Record): number | null {
  return record.durationSec ?? record.talkDurationSec ?? null;
}

function getDisplayAgentName(
  record: Record,
  userMap: Map<number, string>,
): string {
  if (record.userId != null) {
    return userMap.get(record.userId) ?? "Неизвестный менеджер";
  }

  if (record.source === "mango") {
    return "Не назначен";
  }

  return "—";
}

function buildSearchText(record: Record, agentName: string): string {
  return [
    getDisplayTitle(record),
    record.callTo,
    record.summary,
    record.transcription,
    record.callerNumber,
    record.calleeNumber,
    record.direction,
    record.source,
    record.tags.join(" "),
    agentName,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function matchesDate(
  dateStr: string | null,
  from: string,
  to: string,
): boolean {
  if (!dateStr || (!from && !to)) return true;

  const date = new Date(dateStr);
  if (from && date < new Date(from)) return false;
  if (to && date > new Date(`${to}T23:59:59`)) return false;

  return true;
}

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
        className="border-neutral-200 bg-neutral-50 text-neutral-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-400"
      >
        Нет аудио
      </Badge>
    );
  }

  if (status === "queued") {
    return (
      <Badge
        variant="outline"
        className="border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-950/35 dark:text-blue-300"
      >
        В очереди
      </Badge>
    );
  }

  if (status === "uploaded") {
    return (
      <Badge
        variant="outline"
        className="border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-700 dark:bg-sky-950/35 dark:text-sky-300"
      >
        Загружено
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

export default function Calls() {
  const { data: records = [], isPending } = useRecords();
  const { data: users = [] } = useUsers();

  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("startedAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selected, setSelected] = useState<Record | null>(null);

  const dateFromRef = useRef<HTMLInputElement>(null);
  const dateToRef = useRef<HTMLInputElement>(null);

  const userMap = useMemo(
    () => new Map(users.map((user) => [user.id, user.fio ?? user.name])),
    [users],
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    let list = records.filter((record) => {
      const agentName = getDisplayAgentName(record, userMap);
      const matchSearch =
        !query || buildSearchText(record, agentName).includes(query);
      const matchStatus =
        statusFilter === "all" || record.status === statusFilter;
      const matchDate = matchesDate(getRecordDate(record), dateFrom, dateTo);

      return matchSearch && matchStatus && matchDate;
    });

    list = [...list].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;

      if (sortField === "title") {
        return dir * getDisplayTitle(a).localeCompare(getDisplayTitle(b), "ru");
      }

      if (sortField === "callTo") {
        return dir * (a.callTo ?? "").localeCompare(b.callTo ?? "", "ru");
      }

      if (sortField === "durationSec") {
        return (
          dir * ((getDisplayDuration(a) ?? 0) - (getDisplayDuration(b) ?? 0))
        );
      }

      return (
        dir * (getRecordDate(a) ?? "").localeCompare(getRecordDate(b) ?? "")
      );
    });

    return list;
  }, [
    records,
    search,
    sortField,
    sortDir,
    statusFilter,
    dateFrom,
    dateTo,
    userMap,
  ]);

  const { page, totalPages, pageItems, setPage } = usePagination(filtered);

  const isDateActive = dateFrom !== "" || dateTo !== "";

  const toggleSort = (field: SortField): void => {
    if (sortField === field) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }

    setSortField(field);
    setSortDir("desc");
  };

  const SortIcon = ({ field }: { field: SortField }): React.ReactElement => {
    if (sortField !== field) {
      return <ArrowUpDown className="ml-1 inline size-3 text-neutral-300" />;
    }

    return sortDir === "asc" ? (
      <ArrowUp className="ml-1 inline size-3 text-neutral-700 dark:text-neutral-300" />
    ) : (
      <ArrowDown className="ml-1 inline size-3 text-neutral-700 dark:text-neutral-300" />
    );
  };

  return (
    <div>
      <PageHeader
        title="Список звонков"
        description="Все записи разговоров менеджеров"
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-neutral-400" />
          <Input
            placeholder="Поиск по звонкам, менеджеру, контрагенту или тексту…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex items-center overflow-hidden rounded-md border border-input bg-background">
          <div className="relative flex h-9 items-center gap-1.5 border-r border-input px-3">
            <CalendarDays className="size-3.5 shrink-0 text-neutral-400" />
            <span className="text-xs text-neutral-400">От</span>
            <button
              type="button"
              onClick={() => dateFromRef.current?.showPicker?.()}
              className="min-w-14 select-none text-left text-xs"
            >
              {dateFrom ? (
                formatShortDate(dateFrom)
              ) : (
                <span className="text-neutral-300 dark:text-neutral-600">
                  дд.мм.гг
                </span>
              )}
            </button>
            <input
              ref={dateFromRef}
              type="date"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={(e) => setDateFrom(e.target.value)}
              className="pointer-events-none absolute inset-0 opacity-0"
              tabIndex={-1}
            />
          </div>

          <div className="relative flex h-9 items-center gap-1.5 px-3">
            <span className="text-xs text-neutral-400">До</span>
            <button
              type="button"
              onClick={() => dateToRef.current?.showPicker?.()}
              className="min-w-14 select-none text-left text-xs"
            >
              {dateTo ? (
                formatShortDate(dateTo)
              ) : (
                <span className="text-neutral-300 dark:text-neutral-600">
                  дд.мм.гг
                </span>
              )}
            </button>
            <input
              ref={dateToRef}
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(e) => setDateTo(e.target.value)}
              className="pointer-events-none absolute inset-0 opacity-0"
              tabIndex={-1}
            />
          </div>

          {isDateActive && (
            <button
              type="button"
              onClick={() => {
                setDateFrom("");
                setDateTo("");
              }}
              title="Сбросить"
              className="flex h-9 w-8 items-center justify-center border-l border-input text-neutral-400 transition-colors hover:text-neutral-700 dark:hover:text-neutral-200"
            >
              <X className="size-3" />
            </button>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Filter className="size-3.5" />
              Фильтрация
              {statusFilter !== "all" && (
                <span className="ml-0.5 flex size-4 items-center justify-center rounded-full bg-neutral-800 text-[10px] text-white dark:bg-neutral-300 dark:text-neutral-900">
                  1
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="start" className="w-44">
            <DropdownMenuLabel className="text-xs text-neutral-400">
              Статус
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {STATUS_OPTIONS.map(({ value, label }) => (
              <DropdownMenuItem
                key={value}
                onClick={() => setStatusFilter(value)}
                className="flex items-center justify-between"
              >
                {label}
                {statusFilter === value && (
                  <Check className="size-3.5 text-neutral-600" />
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-700">
        <Table>
          <TableHeader>
            <TableRow className="bg-neutral-50/80 dark:bg-neutral-800/80">
              <TableHead
                className={cn("cursor-pointer select-none")}
                onClick={() => toggleSort("title")}
              >
                Название <SortIcon field="title" />
              </TableHead>
              <TableHead
                className="cursor-pointer select-none"
                onClick={() => toggleSort("callTo")}
              >
                Контрагент <SortIcon field="callTo" />
              </TableHead>
              <TableHead>Менеджер</TableHead>
              <TableHead
                className="cursor-pointer select-none"
                onClick={() => toggleSort("startedAt")}
              >
                Дата <SortIcon field="startedAt" />
              </TableHead>
              <TableHead
                className="cursor-pointer select-none"
                onClick={() => toggleSort("durationSec")}
              >
                Длит. <SortIcon field="durationSec" />
              </TableHead>
              <TableHead>Статус</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {isPending ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <Mic className="size-8 text-neutral-300" />
                    <p className="text-sm text-neutral-500">
                      Звонков не найдено
                    </p>
                    {search && (
                      <p className="text-xs text-neutral-400">
                        Попробуйте изменить параметры поиска
                      </p>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              pageItems.map((record) => {
                const recordDate = getRecordDate(record);
                const agentName = getDisplayAgentName(record, userMap);
                const displayDuration = getDisplayDuration(record);

                return (
                  <TableRow
                    key={record.id}
                    className="cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                    onClick={() => setSelected(record)}
                  >
                    <TableCell className="max-w-48 truncate font-medium">
                      {getDisplayTitle(record)}
                    </TableCell>
                    <TableCell className="text-neutral-600 dark:text-neutral-400">
                      {record.callTo ?? "—"}
                    </TableCell>
                    <TableCell className="text-neutral-600 dark:text-neutral-400">
                      {agentName}
                    </TableCell>
                    <TableCell className="text-sm text-neutral-500">
                      {recordDate
                        ? new Date(recordDate).toLocaleDateString("ru-RU")
                        : "—"}
                    </TableCell>
                    <TableCell className="text-sm tabular-nums text-neutral-500">
                      {displayDuration != null
                        ? formatDuration(displayDuration)
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={record.status} />
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <p className="text-xs text-neutral-400">
          {filtered.length} из {records.length} записей
        </p>
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      </div>

      <CallDetailSheet
        record={selected}
        open={!!selected}
        onClose={() => setSelected(null)}
        agentName={
          selected ? getDisplayAgentName(selected, userMap) : undefined
        }
      />
    </div>
  );
}
