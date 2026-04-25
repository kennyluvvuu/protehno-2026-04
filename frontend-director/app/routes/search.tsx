import { FileAudio, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeader } from "~/components/layout";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { useRecords } from "~/hooks/useRecords";
import { useUsers } from "~/hooks/useUsers";
import { cn } from "~/lib/utils";
import type { Record } from "~/types/record";

type SearchField =
  | "callTo"
  | "name"
  | "transcription"
  | "summary"
  | "agentName";

type SearchResultRecord = Record & {
  agentName: string;
};

const SEARCH_FIELDS: { value: SearchField; label: string }[] = [
  { value: "callTo", label: "По контрагенту" },
  { value: "name", label: "По названию" },
  { value: "agentName", label: "По агенту" },
  { value: "transcription", label: "По тексту диалога" },
  { value: "summary", label: "По суммированию" },
];

function getDisplayName(record: Record): string {
  return record.title ?? `Звонок #${record.id}`;
}

function getAgentName(record: Record, userMap: Map<number, string>): string {
  if (record.userId == null) return "Не назначен";
  return userMap.get(record.userId) ?? "Неизвестный менеджер";
}

function getSearchValue(
  record: SearchResultRecord,
  field: SearchField,
): string {
  if (field === "name") return getDisplayName(record);
  if (field === "agentName") return record.agentName;
  return String(record[field] ?? "");
}

function getStatusMeta(status: Record["status"]) {
  if (status === "done") {
    return {
      label: "Успешно",
      color:
        "border-green-200 bg-green-50 text-green-700 dark:border-green-700 dark:bg-green-950/35 dark:text-green-300",
    };
  }

  if (status === "failed") {
    return {
      label: "Ошибка",
      color:
        "border-red-200 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-950/35 dark:text-red-300",
    };
  }

  if (status === "not_applicable") {
    return {
      label: "Нет аудио",
      color:
        "border-neutral-200 bg-neutral-50 text-neutral-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-400",
    };
  }

  return {
    label: "Обработка",
    color:
      "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-700 dark:bg-orange-950/35 dark:text-orange-300",
  };
}

function formatDate(value: string | null): string {
  if (!value) return "Без даты";
  return new Date(value).toLocaleDateString("ru-RU");
}

function highlight(text: string, query: string): React.ReactElement {
  if (!query) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;

  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded bg-yellow-100 px-0.5 text-yellow-900 dark:bg-yellow-900/50 dark:text-yellow-100">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

function ResultCard({
  record,
  query,
  field,
}: {
  record: SearchResultRecord;
  query: string;
  field: SearchField;
}) {
  const statusMeta = getStatusMeta(record.status);
  const displayName = getDisplayName(record);
  const fieldValue = getSearchValue(record, field);

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-800">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-neutral-100 dark:bg-neutral-800">
            <FileAudio className="size-4 text-neutral-500" />
          </div>

          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {highlight(displayName, field === "name" ? query : "")}
            </p>
            <p className="mt-0.5 text-xs text-neutral-500">
              {highlight(record.callTo ?? "—", field === "callTo" ? query : "")}{" "}
              · {record.agentName} ·{" "}
              {formatDate(record.callStartedAt ?? record.startedAt)}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span className="text-xs font-medium text-neutral-500">
            {record.qualityScore != null ? `${record.qualityScore}%` : "—"}
          </span>
          <Badge variant="outline" className={cn("text-xs", statusMeta.color)}>
            {statusMeta.label}
          </Badge>
        </div>
      </div>

      {(field === "transcription" || field === "summary") && fieldValue && (
        <div className="mt-3 line-clamp-2 rounded-lg bg-neutral-50 p-3 text-xs text-neutral-600 dark:bg-neutral-700/50 dark:text-neutral-300">
          {highlight(fieldValue, query)}
        </div>
      )}

      {field === "agentName" && (
        <p className="mt-2 text-xs text-neutral-400">
          Агент: {highlight(record.agentName, query)}
        </p>
      )}
    </div>
  );
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [field, setField] = useState<SearchField>("callTo");

  const { data: records = [] } = useRecords();
  const { data: users = [] } = useUsers();

  const userMap = useMemo(
    () => new Map(users.map((user) => [user.id, user.fio ?? user.name])),
    [users],
  );

  const results = useMemo<SearchResultRecord[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    return records
      .map((record) => ({
        ...record,
        agentName: getAgentName(record, userMap),
      }))
      .filter((record) =>
        getSearchValue(record, field).toLowerCase().includes(q),
      );
  }, [field, query, records, userMap]);

  const hasQuery = query.trim().length > 0;

  return (
    <div>
      <PageHeader
        title="Глобальный поиск"
        description="Поиск по всей базе звонков"
      />

      <div className="mb-6 flex max-w-2xl gap-2">
        <Select value={field} onValueChange={(v) => setField(v as SearchField)}>
          <SelectTrigger className="w-52 shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SEARCH_FIELDS.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-neutral-400" />
          <Input
            placeholder="Введите запрос…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
            autoFocus
          />
        </div>
      </div>

      {!hasQuery ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Search className="size-10 text-neutral-200 dark:text-neutral-700" />
          <p className="mt-4 text-sm font-medium text-neutral-500">
            Начните вводить запрос
          </p>
          <p className="mt-1 text-xs text-neutral-400">
            Выберите поле и введите текст для поиска по записям
          </p>
        </div>
      ) : results.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Search className="size-10 text-neutral-200 dark:text-neutral-700" />
          <p className="mt-4 text-sm font-medium text-neutral-500">
            Ничего не найдено
          </p>
          <p className="mt-1 text-xs text-neutral-400">
            По запросу «{query}» результатов нет. Попробуйте другое поле или
            запрос.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="mb-1 text-xs text-neutral-400">
            Найдено результатов:{" "}
            <strong className="text-neutral-700 dark:text-neutral-300">
              {results.length}
            </strong>
          </p>

          {results.map((record) => (
            <ResultCard
              key={record.id}
              record={record}
              query={query}
              field={field}
            />
          ))}
        </div>
      )}
    </div>
  );
}
