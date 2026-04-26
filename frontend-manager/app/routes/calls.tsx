import Fuse from "fuse.js";
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
import { Badge } from "~/components/ui/badge";
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
import { Skeleton } from "~/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { PageHeader } from "~/components/layout";
import { CallDetailSheet } from "~/components/calls/call-detail-sheet";
import { useQuery } from "@tanstack/react-query";
import { usePagination } from "~/hooks/usePagination";
import { useRecords } from "~/hooks/useRecords";
import { cn } from "~/lib/cn";
import { healthApi } from "~/axios/health";
import type {
  DirectionKind,
  Record,
  RecordStatus,
  SortDir,
  SortField,
} from "~/types/record";

type CallKindFilter = "all" | "accepted" | "missed" | "failed";
type DirectionFilter = "all" | "inbound" | "outbound";

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

type SearchableRecord = Record & {
  searchTitle: string;
  searchCallTo: string;
  searchSummary: string;
  searchTranscription: string;
  searchCallerNumber: string;
  searchCalleeNumber: string;
  searchSource: string;
  searchDirection: string;
  searchTags: string;
};

const FUSE_KEYS: { name: keyof SearchableRecord; weight: number }[] = [
  { name: "searchTitle", weight: 0.35 },
  { name: "searchCallTo", weight: 0.3 },
  { name: "searchSummary", weight: 0.12 },
  { name: "searchTranscription", weight: 0.1 },
  { name: "searchCallerNumber", weight: 0.05 },
  { name: "searchCalleeNumber", weight: 0.04 },
  { name: "searchTags", weight: 0.02 },
  { name: "searchSource", weight: 0.01 },
  { name: "searchDirection", weight: 0.01 },
];

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function getDirectionLabel(directionKind?: DirectionKind | null): string {
  if (directionKind === "inbound") return "Входящий";
  if (directionKind === "outbound") return "Исходящий";
  return "Неизвестно";
}

function getDirectionSearchText(record: Record): string {
  const kind = record.directionKind ?? record.direction ?? "unknown";
  const label = getDirectionLabel(
    kind === "inbound" || kind === "outbound" || kind === "unknown"
      ? kind
      : "unknown",
  );

  return [kind, label, label.toLowerCase(), "входящий", "исходящий"].join(" ");
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

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y.slice(2)}`;
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

function isMissedCall(record: Record): boolean {
  return (
    record.isMissed === true ||
    record.ingestionStatus === "no_audio" ||
    record.status === "not_applicable" ||
    (record.talkDurationSec != null && record.talkDurationSec === 0)
  );
}

function DirectionBadge({ directionKind }: { directionKind?: DirectionKind | null }) {
  if (directionKind === "inbound") {
    return (
      <Badge variant="outline" className="gap-1 border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-950/30 dark:text-blue-300">
        <ArrowDown className="size-3" />
        Входящий
      </Badge>
    );
  }
  if (directionKind === "outbound") {
    return (
      <Badge variant="outline" className="gap-1 border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-700 dark:bg-violet-950/30 dark:text-violet-300">
        <ArrowUp className="size-3" />
        Исходящий
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-neutral-200 text-neutral-400 dark:border-neutral-700">
      —
    </Badge>
  );
}

function CallStatusBadge({ record }: { record: Record }) {
  if (record.status === "failed") {
    return (
      <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-950/35 dark:text-red-300">
        Ошибка
      </Badge>
    );
  }
  if (isMissedCall(record)) {
    return (
      <Badge variant="outline" className="border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-700 dark:bg-orange-950/35 dark:text-orange-300">
        Пропущенный
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700 dark:border-green-700 dark:bg-green-950/35 dark:text-green-300">
      Принятый
    </Badge>
  );
}

function StatusBadge({ status }: { status: RecordStatus }) {
  if (status === "done")
    return (
      <Badge
        variant="outline"
        className="border-green-200 bg-green-50 text-green-700 dark:border-green-700 dark:bg-green-950/35 dark:text-green-300"
      >
        Выполнено
      </Badge>
    );
  if (status === "failed")
    return (
      <Badge
        variant="outline"
        className="border-red-200 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-950/35 dark:text-red-300"
      >
        Ошибка
      </Badge>
    );
  if (status === "not_applicable")
    return (
      <Badge
        variant="outline"
        className="border-neutral-200 bg-neutral-50 text-neutral-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-400"
      >
        Нет аудио
      </Badge>
    );
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
  const { data: health } = useQuery({
    queryKey: ["health"],
    queryFn: healthApi.check,
    refetchInterval: 30_000,
  });
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("startedAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [callKindFilter, setCallKindFilter] = useState<CallKindFilter>("all");
  const [directionFilter, setDirectionFilter] = useState<DirectionFilter>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selected, setSelected] = useState<Record | null>(null);
  const dateFromRef = useRef<HTMLInputElement>(null);
  const dateToRef = useRef<HTMLInputElement>(null);

  const searchableRecords = useMemo<SearchableRecord[]>(() => {
    return records.map((record) => ({
      ...record,
      searchTitle: record.title ?? "",
      searchCallTo: getDisplayCounterparty(record),
      searchSummary: record.summary ?? "",
      searchTranscription: record.transcription ?? "",
      searchCallerNumber: record.callerNumber ?? "",
      searchCalleeNumber: record.calleeNumber ?? "",
      searchSource: record.source ?? "",
      searchDirection: getDirectionSearchText(record),
      searchTags: record.tags.join(" "),
    }));
  }, [records]);

  const fuse = useMemo(
    () =>
      new Fuse(searchableRecords, {
        keys: FUSE_KEYS,
        threshold: 0.38,
        ignoreLocation: true,
        minMatchCharLength: 2,
      }),
    [searchableRecords],
  );

  const filtered = useMemo(() => {
    const query = search.trim();

    let list = searchableRecords.filter((r) => {
      const matchDate = matchesDate(r.startedAt, dateFrom, dateTo);

      const matchDirection =
        directionFilter === "all" || r.directionKind === directionFilter;

      const matchKind =
        callKindFilter === "all" ||
        (callKindFilter === "failed" && r.status === "failed") ||
        (callKindFilter === "missed" && r.status !== "failed" && isMissedCall(r)) ||
        (callKindFilter === "accepted" && r.status !== "failed" && !isMissedCall(r));

      return matchDate && matchDirection && matchKind;
    });

    if (query.length >= 2) {
      const matchedIds = new Set(
        fuse.search(query).map((result) => result.item.id),
      );
      list = list.filter((record) => matchedIds.has(record.id));
    }

    list = [...list].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortField === "title")
        return dir * (a.title ?? "").localeCompare(b.title ?? "");
      if (sortField === "callTo")
        return (
          dir *
          getDisplayCounterparty(a).localeCompare(getDisplayCounterparty(b))
        );
      if (sortField === "durationSec")
        return dir * ((a.durationSec ?? 0) - (b.durationSec ?? 0));
      return dir * (a.startedAt ?? "").localeCompare(b.startedAt ?? "");
    });
    return list;
  }, [
    searchableRecords,
    search,
    sortField,
    sortDir,
    callKindFilter,
    directionFilter,
    dateFrom,
    dateTo,
    fuse,
  ]);

  const { page, totalPages, pageItems, setPage } = usePagination(filtered);

  const isDateActive = dateFrom !== "" || dateTo !== "";

  const toggleSort = (field: SortField): void => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }): React.ReactElement => {
    if (sortField !== field)
      return <ArrowUpDown className="ml-1 inline size-3 text-neutral-300" />;
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
        healthStatus={health?.status}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-neutral-400" />
          <Input
            placeholder="Неточный поиск по названию, контрагенту, диалогу и номерам…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex items-center rounded-md border border-input bg-background overflow-hidden">
          <div className="relative flex items-center gap-1.5 border-r border-input px-3 h-9">
            <CalendarDays className="size-3.5 shrink-0 text-neutral-400" />
            <span className="text-xs text-neutral-400">От</span>
            <button
              type="button"
              onClick={() => dateFromRef.current?.showPicker?.()}
              className="text-xs min-w-14 text-left select-none"
            >
              {dateFrom ? (
                fmtDate(dateFrom)
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
              className="absolute inset-0 opacity-0 pointer-events-none"
              tabIndex={-1}
            />
          </div>
          <div className="relative flex items-center gap-1.5 px-3 h-9">
            <span className="text-xs text-neutral-400">До</span>
            <button
              type="button"
              onClick={() => dateToRef.current?.showPicker?.()}
              className="text-xs min-w-14 text-left select-none"
            >
              {dateTo ? (
                fmtDate(dateTo)
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
              className="absolute inset-0 opacity-0 pointer-events-none"
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
              className="flex items-center justify-center h-9 w-8 border-l border-input text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors"
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
              {(callKindFilter !== "all" || directionFilter !== "all") && (
                <span className="ml-0.5 flex size-4 items-center justify-center rounded-full bg-neutral-800 text-[10px] text-white dark:bg-neutral-300 dark:text-neutral-900">
                  {[callKindFilter !== "all", directionFilter !== "all"].filter(Boolean).length}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuLabel className="text-xs text-neutral-400">Звонок</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {CALL_KIND_OPTIONS.map(({ value, label }) => (
              <DropdownMenuItem
                key={value}
                onClick={() => setCallKindFilter(value)}
                className="flex items-center justify-between"
              >
                {label}
                {callKindFilter === value && <Check className="size-3.5 text-neutral-600" />}
              </DropdownMenuItem>
            ))}

            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-neutral-400">Направление</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {DIRECTION_OPTIONS.map(({ value, label }) => (
              <DropdownMenuItem
                key={value}
                onClick={() => setDirectionFilter(value)}
                className="flex items-center justify-between"
              >
                {label}
                {directionFilter === value && <Check className="size-3.5 text-neutral-600" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 overflow-hidden">
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
                  <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-14" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-16 text-center">
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
              pageItems.map((r) => (
                <TableRow
                  key={r.id}
                  className="cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                  onClick={() => setSelected(r)}
                >
                  <TableCell className="font-medium max-w-48 truncate">
                    {r.title ?? `Звонок #${r.id}`}
                  </TableCell>
                  <TableCell className="text-neutral-600 dark:text-neutral-400">
                    {getDisplayCounterparty(r)}
                  </TableCell>
                  <TableCell>
                    <DirectionBadge directionKind={r.directionKind ?? null} />
                  </TableCell>
                  <TableCell className="text-neutral-500 text-sm">
                    {r.startedAt
                      ? new Date(r.startedAt).toLocaleDateString("ru-RU")
                      : "—"}
                  </TableCell>
                  <TableCell className="text-neutral-500 text-sm tabular-nums">
                    {r.durationSec != null
                      ? formatDuration(r.durationSec)
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <CallStatusBadge record={r} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={r.status} />
                  </TableCell>
                </TableRow>
              ))
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
      />
    </div>
  );
}
