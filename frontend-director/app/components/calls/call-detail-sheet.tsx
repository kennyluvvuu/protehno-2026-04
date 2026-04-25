import { Play } from "lucide-react";
import { useNavigate } from "react-router";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { cn } from "~/lib/utils";
import type { CheckboxItem, Record } from "~/types/record";

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function CheckboxList({ items }: { items: CheckboxItem[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item, i) => (
        <li key={`${item.label}-${i}`} className="flex items-start gap-2.5">
          <div
            role="checkbox"
            aria-checked={item.checked}
            className={cn(
              "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border transition-colors",
              item.checked
                ? "border-neutral-500 bg-neutral-700 dark:border-neutral-400 dark:bg-neutral-500"
                : "border-neutral-300 bg-white dark:border-neutral-600 dark:bg-neutral-800",
            )}
          >
            {item.checked && (
              <svg
                viewBox="0 0 10 8"
                className="size-2.5 text-white"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path
                  d="M1 4l3 3 5-6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </div>
          <span
            className={cn(
              "text-sm leading-5",
              item.checked && "line-through text-neutral-400",
            )}
          >
            {item.label}
          </span>
        </li>
      ))}
    </ul>
  );
}

interface CallDetailSheetProps {
  record: Record | null;
  open: boolean;
  onClose: () => void;
  agentName?: string;
}

export function CallDetailSheet({
  record,
  open,
  onClose,
  agentName,
}: CallDetailSheetProps) {
  const navigate = useNavigate();

  if (!record) return null;

  const phone = record.callerNumber ?? record.calleeNumber ?? null;
  const date = record.startedAt
    ? new Date(record.startedAt).toLocaleDateString("ru-RU")
    : null;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-base">
            {record.title ?? `Звонок #${record.id}`}
          </SheetTitle>
          <p className="text-sm text-neutral-500">
            {[record.callTo, phone, date].filter(Boolean).join(" · ")}
          </p>
          {agentName && (
            <button
              type="button"
              onClick={() => record.userId != null && navigate(`/users/${record.userId}`)}
              className={cn(
                "flex items-center gap-2 pt-1 text-left",
                record.userId != null && "group cursor-pointer",
              )}
            >
              <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xs font-semibold text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                {agentName.charAt(0).toUpperCase()}
              </div>
              <span className={cn(
                "text-sm text-neutral-600 dark:text-neutral-400",
                record.userId != null && "group-hover:text-neutral-900 group-hover:underline dark:group-hover:text-neutral-100",
              )}>
                Менеджер: {agentName}
              </span>
            </button>
          )}
        </SheetHeader>

        <div className="mt-6 flex flex-col gap-5">
          {record.durationSec != null && (
            <div className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-700 dark:bg-neutral-800">
              <button
                type="button"
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-neutral-700 text-neutral-100"
              >
                <Play className="size-3.5 translate-x-0.5" />
              </button>
              <div className="flex flex-1 items-center gap-1.5">
                {Array.from({ length: 40 }).map((_, i) => (
                  <div
                    key={i}
                    className="w-0.5 rounded-full bg-neutral-300 dark:bg-neutral-600"
                    style={{ height: `${8 + ((i * 7 + i * i * 3) % 20)}px` }}
                  />
                ))}
              </div>
              <span className="text-xs text-neutral-400">
                {formatDuration(record.durationSec)}
              </span>
            </div>
          )}

          {record.durationSec != null && (
            <div className="flex flex-col gap-0.5 rounded-lg border border-neutral-100 p-3 dark:border-neutral-700">
              <p className="text-[10px] uppercase tracking-wide text-neutral-400">
                Длительность
              </p>
              <p className="text-sm font-medium">
                {formatDuration(record.durationSec)}
              </p>
            </div>
          )}

          {record.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {record.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-neutral-200 px-2.5 py-0.5 text-xs text-neutral-600 dark:border-neutral-700 dark:text-neutral-400"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {record.transcription && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-400">
                Диалог
              </p>
              <div className="rounded-lg border border-neutral-100 bg-neutral-50 p-3 text-sm text-neutral-700 whitespace-pre-wrap dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                {record.transcription}
              </div>
            </div>
          )}

          {record.summary && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-400">
                Суммирование
              </p>
              <div className="rounded-lg border border-neutral-100 bg-neutral-50 p-3 text-sm text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                {record.summary}
              </div>
            </div>
          )}

          {record.checkboxes?.promises &&
            record.checkboxes.promises.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-400">
                  Обещания
                </p>
                <CheckboxList items={record.checkboxes.promises} />
              </div>
            )}
          {record.checkboxes?.tasks && record.checkboxes.tasks.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-400">
                Задачи
              </p>
              <CheckboxList items={record.checkboxes.tasks} />
            </div>
          )}
          {record.checkboxes?.agreements &&
            record.checkboxes.agreements.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-400">
                  Договорённости
                </p>
                <CheckboxList items={record.checkboxes.agreements} />
              </div>
            )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
