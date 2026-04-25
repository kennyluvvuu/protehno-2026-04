import { FileAudio, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { CallDetailSheet } from "~/components/calls/call-detail-sheet";
import { Badge } from "~/components/ui/badge";
import { Dialog, DialogContent, DialogTitle } from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { useRecords } from "~/hooks/useRecords";
import { useUsers } from "~/hooks/useUsers";
import { cn } from "~/lib/utils";
import type { Record } from "~/types/record";

interface SearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const FIELDS = [
  { key: "title" as const, label: "Название" },
  { key: "callTo" as const, label: "Контрагент" },
  { key: "transcription" as const, label: "Диалог" },
  { key: "summary" as const, label: "Суммирование" },
];

function matchRecord(record: Record, q: string): string[] {
  return FIELDS.filter(({ key }) => {
    const value = String(record[key] ?? "").toLowerCase();
    return value.includes(q);
  }).map(({ label }) => label);
}

function formatRecordDate(record: Record): string | null {
  const date = record.callStartedAt ?? record.startedAt ?? record.finishedAt;
  return date ? new Date(date).toLocaleDateString("ru-RU") : null;
}

function getAgentName(
  record: Record,
  userMap: Map<number, string>,
): string | undefined {
  if (record.userId == null) return undefined;
  return userMap.get(record.userId);
}

function getDisplayTitle(record: Record): string {
  return record.title ?? `Звонок #${record.id}`;
}

export function SearchModal({
  open,
  onOpenChange,
}: SearchModalProps): React.ReactElement {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Record | null>(null);

  const { data: records = [] } = useRecords();
  const { data: users = [] } = useUsers();

  const userMap = useMemo(
    () => new Map(users.map((user) => [user.id, user.fio ?? user.name])),
    [users],
  );

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }

    const timer = window.setTimeout(() => inputRef.current?.focus(), 10);
    return () => window.clearTimeout(timer);
  }, [open]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    return records
      .reduce<{ record: Record; matches: string[] }[]>((acc, record) => {
        const matches = matchRecord(record, q);
        if (matches.length > 0) {
          acc.push({ record, matches });
        }
        return acc;
      }, [])
      .slice(0, 8);
  }, [query, records]);

  const hasQuery = query.trim().length > 0;

  const handleResultClick = (record: Record): void => {
    onOpenChange(false);
    setSelected(record);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="h-[110vh] max-h-[600px] w-[min(620px,calc(100%-2rem))] max-w-none grid-rows-[auto_1fr] overflow-hidden p-0 [&>button:last-child]:hidden">
          <DialogTitle className="sr-only">Поиск</DialogTitle>

          <div className="border-b border-border p-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Поиск по звонкам…"
                className="h-10 pl-9 pr-10"
              />
              {hasQuery && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute right-2 top-1/2 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Очистить"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="overflow-y-auto p-3">
            {!hasQuery ? (
              <p className="py-20 text-center text-sm text-muted-foreground">
                Начните вводить текст
              </p>
            ) : results.length === 0 ? (
              <p className="py-20 text-center text-sm text-muted-foreground">
                Ничего не найдено
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {results.map(({ record, matches }) => (
                  <button
                    key={record.id}
                    type="button"
                    onClick={() => handleResultClick(record)}
                    className="flex w-full items-start gap-3 rounded-lg border border-border bg-card px-3 py-2 text-left transition-colors hover:bg-accent"
                  >
                    <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
                      <FileAudio className="size-4 text-muted-foreground" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {getDisplayTitle(record)}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[
                          record.callTo,
                          getAgentName(record, userMap),
                          formatRecordDate(record),
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {matches.slice(0, 3).map((label) => (
                          <Badge
                            key={label}
                            variant="outline"
                            className={cn("text-[10px]")}
                          >
                            {label}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <CallDetailSheet
        record={selected}
        open={!!selected}
        onClose={() => setSelected(null)}
        agentName={selected ? getAgentName(selected, userMap) : undefined}
      />
    </>
  );
}
