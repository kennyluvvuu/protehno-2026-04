import Fuse from "fuse.js";
import { useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CalendarDays,
  Check,
  ChevronDown,
  Download,
  Filter,
  FileSpreadsheet,
  Loader2,
  Mic,
  Search,
  X,
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CallDetailSheet } from "~/components/calls/call-detail-sheet";
import { PageHeader } from "~/components/layout";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import { Button } from "~/components/ui/button";
import { mangoApi } from "~/axios/mango";
import { getApiErrorMessage } from "~/lib/api-error";
import { exportRecords } from "~/lib/export-records";
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

function pad(v: number): string {
  return String(v).padStart(2, "0");
}

function formatMangoDate(d: Date): string {
  return (
    [pad(d.getDate()), pad(d.getMonth() + 1), d.getFullYear()].join(".") +
    ` ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

const MIGRATION_YEARS_BACK = 2;
const MIGRATION_LIMIT = 500;
const MIGRATION_OFFSET = 0;
const MIGRATION_MAX_PAGES = 200;

function getMigrationStartDate(): string {
  const start = new Date();
  start.setFullYear(start.getFullYear() - MIGRATION_YEARS_BACK);
  return formatMangoDate(start);
}
import type {
  DirectionKind,
  Record,
  RecordStatus,
  SortDir,
  SortField,
} from "~/types/record";

function isMissedCall(record: Record): boolean {
  return (
    record.isMissed === true ||
    record.ingestionStatus === "no_audio" ||
    record.status === "not_applicable" ||
    (record.talkDurationSec != null && record.talkDurationSec === 0)
  );
}

function DirectionBadge({
  directionKind,
}: {
  directionKind?: DirectionKind | null;
}) {
  if (directionKind === "inbound") {
    return (
      <Badge
        variant="outline"
        className="gap-1 border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-950/30 dark:text-blue-300"
      >
        <ArrowDown className="size-3" />
        Входящий
      </Badge>
    );
  }
  if (directionKind === "outbound") {
    return (
      <Badge
        variant="outline"
        className="gap-1 border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-700 dark:bg-violet-950/30 dark:text-violet-300"
      >
        <ArrowUp className="size-3" />
        Исходящий
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="border-neutral-200 text-neutral-400 dark:border-neutral-700"
    >
      —
    </Badge>
  );
}

function CallStatusBadge({ record }: { record: Record }) {
  if (record.status === "failed") {
    return (
      <Badge
        variant="outline"
        className="border-red-200 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-950/35 dark:text-red-300"
      >
        Ошибка
      </Badge>
    );
  }
  if (isMissedCall(record)) {
    return (
      <Badge
        variant="outline"
        className="border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-700 dark:bg-orange-950/35 dark:text-orange-300"
      >
        Пропущенный
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="border-green-200 bg-green-50 text-green-700 dark:border-green-700 dark:bg-green-950/35 dark:text-green-300"
    >
      Принятый
    </Badge>
  );
}

type CallKindFilter = "all" | "accepted" | "missed" | "failed";
type DirectionFilter = "all" | "inbound" | "outbound";
type ProcessingFilter = RecordStatus | "all";

const CALL_KIND_OPTIONS: { value: CallKindFilter; label: string }[] = [
  { value: "all", label: "Все звонки" },
  { value: "accepted", label: "Принятые" },
  { value: "missed", label: "Пропущенные" },
  { value: "failed", label: "Ошибка" },
];

const DIRECTION_OPTIONS: { value: DirectionFilter; label: string }[] = [
  { value: "all", label: "Все направления" },
  { value: "inbound", label: "Входящие" },
  { value: "outbound", label: "Исходящие" },
];

const PROCESSING_OPTIONS: { value: ProcessingFilter; label: string }[] = [
  { value: "all", label: "Все статусы" },
  { value: "uploaded", label: "Загружено" },
  { value: "queued", label: "В очереди" },
  { value: "processing", label: "В обработке" },
  { value: "done", label: "Выполнено" },
  { value: "failed", label: "Ошибка" },
];

type SearchableRecord = Record & {
  agentName: string;
  searchText: string;
};

const FUSE_KEYS: { name: keyof SearchableRecord; weight: number }[] = [
  { name: "title", weight: 0.28 },
  { name: "callTo", weight: 0.2 },
  { name: "agentName", weight: 0.16 },
  { name: "summary", weight: 0.12 },
  { name: "transcription", weight: 0.1 },
  { name: "callerNumber", weight: 0.05 },
  { name: "calleeNumber", weight: 0.05 },
  { name: "directionKind", weight: 0.02 },
  { name: "source", weight: 0.02 },
];

function formatDuration(sec: number): string {
  const minutes = Math.floor(sec / 60);
  const seconds = sec % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function getDirectionLabel(directionKind?: DirectionKind | null): string {
  if (directionKind === "inbound") return "Входящий";
  if (directionKind === "outbound") return "Исходящий";
  return "Неизвестно";
}

function getDisplayCounterparty(record: Record): string {
  if (record.callTo) return record.callTo;

  if (record.directionKind === "inbound") {
    return record.callerNumber ?? record.calleeNumber ?? "—";
  }

  if (record.directionKind === "outbound") {
    return record.calleeNumber ?? record.callerNumber ?? "—";
  }

  return record.callerNumber ?? record.calleeNumber ?? "—";
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
  const directionKind = record.directionKind ?? record.direction ?? "unknown";
  const normalizedDirectionKind =
    directionKind === "inbound" ||
    directionKind === "outbound" ||
    directionKind === "unknown"
      ? directionKind
      : "unknown";

  return [
    getDisplayTitle(record),
    getDisplayCounterparty(record),
    record.summary,
    record.transcription,
    record.callerNumber,
    record.calleeNumber,
    normalizedDirectionKind,
    getDirectionLabel(normalizedDirectionKind),
    record.source,
    record.tags.join(" "),
    agentName,
  ]
    .filter(Boolean)
    .join(" ");
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
  const queryClient = useQueryClient();
  const { data: records = [], isPending } = useRecords();
  const { data: users = [] } = useUsers();

  const syncMutation = useMutation({
    mutationFn: async () => {
      const startDate = getMigrationStartDate();
      const endDate = formatMangoDate(new Date());
      return mangoApi.sync({
        startDate,
        endDate,
        limit: MIGRATION_LIMIT,
        offset: MIGRATION_OFFSET,
        maxPages: MIGRATION_MAX_PAGES,
        downloadRecordings: true,
      });
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["records"] });
      const parts = [
        result.fetched != null && `Получено: ${result.fetched}`,
        result.created != null && `Создано: ${result.created}`,
        result.downloaded != null && `Скачано: ${result.downloaded}`,
      ]
        .filter(Boolean)
        .join(" · ");
      toast.success(parts || "Синхронизация завершена");
    },
    onError: (error) => {
      toast.error(
        getApiErrorMessage(error, "Не удалось выполнить синхронизацию Mango"),
      );
    },
  });

  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("startedAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [callKindFilter, setCallKindFilter] = useState<CallKindFilter>("all");
  const [directionFilter, setDirectionFilter] =
    useState<DirectionFilter>("all");
  const [processingFilter, setProcessingFilter] =
    useState<ProcessingFilter>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selected, setSelected] = useState<Record | null>(null);

  const dateFromRef = useRef<HTMLInputElement>(null);
  const dateToRef = useRef<HTMLInputElement>(null);

  const userMap = useMemo(
    () => new Map(users.map((user) => [user.id, user.fio ?? user.name])),
    [users],
  );

  const searchableRecords = useMemo<SearchableRecord[]>(
    () =>
      records.map((record) => {
        const agentName = getDisplayAgentName(record, userMap);
        return {
          ...record,
          agentName,
          searchText: buildSearchText(record, agentName),
        };
      }),
    [records, userMap],
  );

  const fuse = useMemo(
    () =>
      new Fuse(searchableRecords, {
        keys: FUSE_KEYS,
        threshold: 0.38,
        minMatchCharLength: 2,
        ignoreLocation: true,
      }),
    [searchableRecords],
  );

  const filtered = useMemo(() => {
    const query = search.trim();

    let list = searchableRecords.filter((record) => {
      const matchDate = matchesDate(getRecordDate(record), dateFrom, dateTo);

      const matchDirection =
        directionFilter === "all" || record.directionKind === directionFilter;

      const matchKind =
        callKindFilter === "all" ||
        (callKindFilter === "failed" && record.status === "failed") ||
        (callKindFilter === "missed" &&
          record.status !== "failed" &&
          isMissedCall(record)) ||
        (callKindFilter === "accepted" &&
          record.status !== "failed" &&
          !isMissedCall(record));

      const matchProcessing =
        processingFilter === "all" || record.status === processingFilter;

      return matchDate && matchDirection && matchKind && matchProcessing;
    });

    if (query.length >= 2) {
      const matchedIds = new Set(
        fuse.search(query).map((result) => result.item.id),
      );
      list = list.filter((record) => matchedIds.has(record.id));
    }

    list = [...list].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;

      if (sortField === "title") {
        return dir * getDisplayTitle(a).localeCompare(getDisplayTitle(b), "ru");
      }

      if (sortField === "callTo") {
        return (
          dir *
          getDisplayCounterparty(a).localeCompare(
            getDisplayCounterparty(b),
            "ru",
          )
        );
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
    searchableRecords,
    search,
    sortField,
    sortDir,
    callKindFilter,
    directionFilter,
    processingFilter,
    dateFrom,
    dateTo,
    fuse,
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
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  disabled={filtered.length === 0}
                >
                  <FileSpreadsheet className="size-4" />
                  Экспорт
                  <ChevronDown className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-44">
                <DropdownMenuItem
                  onClick={() =>
                    void exportRecords("csv", {
                      records: filtered,
                      fileName: "director-calls-export",
                      sheetName: "Calls",
                    })
                  }
                >
                  CSV
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    void exportRecords("xlsx", {
                      records: filtered,
                      fileName: "director-calls-export",
                      sheetName: "Calls",
                    })
                  }
                >
                  XLSX
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void syncMutation.mutateAsync()}
              disabled={syncMutation.isPending}
              className="gap-1.5"
            >
              {syncMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" />
              )}
              Притянуть звонки из Mango
            </Button>
          </div>
        }
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
              Фильтры
              {(callKindFilter !== "all" ||
                directionFilter !== "all" ||
                processingFilter !== "all") && (
                <span className="ml-0.5 flex size-4 items-center justify-center rounded-full bg-neutral-800 text-[10px] text-white dark:bg-neutral-300 dark:text-neutral-900">
                  {
                    [
                      callKindFilter !== "all",
                      directionFilter !== "all",
                      processingFilter !== "all",
                    ].filter(Boolean).length
                  }
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuLabel className="text-xs text-neutral-400">
              Звонок
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {CALL_KIND_OPTIONS.map(({ value, label }) => (
              <DropdownMenuItem
                key={value}
                onClick={() => setCallKindFilter(value)}
                className="flex items-center justify-between"
              >
                {label}
                {callKindFilter === value && (
                  <Check className="size-3.5 text-neutral-600" />
                )}
              </DropdownMenuItem>
            ))}

            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-neutral-400">
              Направление
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {DIRECTION_OPTIONS.map(({ value, label }) => (
              <DropdownMenuItem
                key={value}
                onClick={() => setDirectionFilter(value)}
                className="flex items-center justify-between"
              >
                {label}
                {directionFilter === value && (
                  <Check className="size-3.5 text-neutral-600" />
                )}
              </DropdownMenuItem>
            ))}

            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-neutral-400">
              Обработка
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {PROCESSING_OPTIONS.map(({ value, label }) => (
              <DropdownMenuItem
                key={value}
                onClick={() => setProcessingFilter(value)}
                className="flex items-center justify-between"
              >
                {label}
                {processingFilter === value && (
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
              <TableHead>Направление</TableHead>
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
              <TableHead>Звонок</TableHead>
              <TableHead>Статус</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {isPending ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Skeleton className="h-4 w-40" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-28" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-16" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-14" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-16 text-center">
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
                      {getDisplayCounterparty(record)}
                    </TableCell>
                    <TableCell className="text-neutral-600 dark:text-neutral-400">
                      {agentName}
                    </TableCell>
                    <TableCell>
                      <DirectionBadge
                        directionKind={record.directionKind ?? null}
                      />
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
                      <CallStatusBadge record={record} />
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
        <Pagination
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
        />
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
