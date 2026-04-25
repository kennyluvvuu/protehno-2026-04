import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import type { Record } from "~/types/record";

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatRecordDate(record: Record): string | null {
  const value = record.callStartedAt ?? record.startedAt ?? record.finishedAt;
  return value ? new Date(value).toLocaleDateString("ru-RU") : null;
}

function ReadonlyChecklist({
  title,
  items,
}: {
  title: string;
  items: Array<{ label: string; checked: boolean }>;
}) {
  if (items.length === 0) return null;

  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-400">
        {title}
      </p>
      <ul className="flex flex-col gap-2">
        {items.map((item, index) => (
          <li key={`${title}-${index}`} className="flex items-start gap-2.5">
            <div
              aria-hidden="true"
              className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border ${
                item.checked
                  ? "border-neutral-500 bg-neutral-700 dark:border-neutral-400 dark:bg-neutral-500"
                  : "border-neutral-300 bg-white dark:border-neutral-600 dark:bg-neutral-800"
              }`}
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
              className={`text-sm leading-5 ${
                item.checked ? "text-neutral-400 line-through" : ""
              }`}
            >
              {item.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
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
  if (!record) return null;

  const phone = record.callerNumber ?? record.calleeNumber ?? null;
  const date = formatRecordDate(record);
  const duration = record.durationSec ?? record.talkDurationSec ?? null;

  return (
    <Sheet open={open} onOpenChange={(value) => !value && onClose()}>
      <SheetContent className="flex h-dvh w-full max-w-xl flex-col overflow-hidden p-0 sm:max-w-xl">
        <SheetHeader className="shrink-0 border-b border-neutral-200 px-6 py-5 dark:border-neutral-700">
          <SheetTitle className="pr-8 text-base">
            {record.title ?? `Звонок #${record.id}`}
          </SheetTitle>
          <SheetDescription className="text-sm text-neutral-500">
            {[record.callTo, phone, date].filter(Boolean).join(" · ")}
          </SheetDescription>

          {agentName && (
            <div className="flex items-center gap-2 pt-1">
              <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xs font-semibold text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                {agentName.charAt(0).toUpperCase()}
              </div>
              <span className="text-sm text-neutral-600 dark:text-neutral-400">
                Менеджер: {agentName}
              </span>
            </div>
          )}
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="flex flex-col gap-5">
            {duration != null && (
              <div className="flex flex-col gap-0.5 rounded-lg border border-neutral-100 p-3 dark:border-neutral-700">
                <p className="text-[10px] uppercase tracking-wide text-neutral-400">
                  Длительность
                </p>
                <p className="text-sm font-medium">
                  {formatDuration(duration)}
                </p>
              </div>
            )}

            {record.source === "mango" && (
              <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-600 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                <p className="font-medium">Источник: Mango</p>
                {record.ingestionStatus && (
                  <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                    Статус получения аудио: {record.ingestionStatus}
                  </p>
                )}
                {record.ingestionError && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                    {record.ingestionError}
                  </p>
                )}
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
                <div className="rounded-lg border border-neutral-100 bg-neutral-50 p-3 text-sm whitespace-pre-wrap text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
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

            <ReadonlyChecklist
              title="Обещания"
              items={record.checkboxes?.promises ?? []}
            />
            <ReadonlyChecklist
              title="Задачи"
              items={record.checkboxes?.tasks ?? []}
            />
            <ReadonlyChecklist
              title="Договорённости"
              items={record.checkboxes?.agreements ?? []}
            />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
