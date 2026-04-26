import { Download, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import AudioPlayer from "react-h5-audio-player";
import "react-h5-audio-player/lib/styles.css";
import { useNavigate } from "react-router";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "~/components/ui/sheet";
import { recordsApi } from "~/axios/records";
import { Button } from "~/components/ui/button";
import { useDeleteRecord } from "~/hooks/useRecords";
import { cn } from "~/lib/utils";
import type { CheckboxItem, DirectionKind, Record } from "~/types/record";

function formatDuration(sec: number): string {
  const safeSec = Number.isFinite(sec) && sec >= 0 ? Math.floor(sec) : 0;
  const m = Math.floor(safeSec / 60);
  const s = safeSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatRecordDate(record: Record): string | null {
  const value = record.callStartedAt ?? record.startedAt ?? record.finishedAt;
  return value ? new Date(value).toLocaleDateString("ru-RU") : null;
}

function getDirectionLabel(directionKind?: DirectionKind | null): string {
  if (directionKind === "inbound") return "Входящий";
  if (directionKind === "outbound") return "Исходящий";
  return "Неизвестно";
}

function getDisplayPhone(record: Record): string | null {
  if (record.directionKind === "inbound") {
    return record.callerNumber ?? record.calleeNumber ?? null;
  }

  if (record.directionKind === "outbound") {
    return record.calleeNumber ?? record.callerNumber ?? null;
  }

  return record.callerNumber ?? record.calleeNumber ?? null;
}

function getDisplayCounterparty(record: Record): string | null {
  return record.callTo ?? getDisplayPhone(record);
}

function ReadonlyChecklist({
  title,
  items,
}: {
  title: string;
  items: CheckboxItem[];
}) {
  if (items.length === 0) return null;

  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-400">
        {title}
      </p>
      <ul className="flex flex-col gap-2">
        {items.map((item, index) => (
          <li
            key={`${title}-${item.label}-${index}`}
            className="flex items-start gap-2.5"
          >
            <div
              aria-hidden="true"
              className={cn(
                "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border",
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
  const navigate = useNavigate();
  const playerRef = useRef<AudioPlayer | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const deleteMutation = useDeleteRecord();
  const recordId = record?.id ?? null;
  const phone = record ? getDisplayPhone(record) : null;
  const counterparty = record ? getDisplayCounterparty(record) : null;
  const directionLabel = record
    ? getDirectionLabel(record.directionKind ?? null)
    : null;
  const date = record ? formatRecordDate(record) : null;
  const durationValue = record
    ? (record.durationSec ?? record.talkDurationSec ?? null)
    : null;
  const canPlayAudio = Boolean(record?.fileUri && record?.hasAudio !== false);
  const audioMeta = useMemo(
    () => (recordId != null ? recordsApi.getAudioMeta(recordId) : null),
    [recordId],
  );

  useEffect(() => {
    if (open) return;

    const audio = playerRef.current?.audio?.current;
    if (!audio) return;

    audio.pause();
    audio.currentTime = 0;
  }, [open, recordId]);

  if (!record) return null;

  return (
    <>
    <Sheet open={open} onOpenChange={(value) => !value && onClose()}>
      <SheetContent className="flex h-dvh w-full max-w-3xl flex-col overflow-hidden p-0 sm:max-w-3xl">
        <SheetHeader className="shrink-0 border-b border-neutral-200 px-6 py-5 dark:border-neutral-700">
          <div className="flex items-start justify-between gap-3 pr-8">
            <SheetTitle className="text-base">
              {record.title ?? `Звонок #${record.id}`}
            </SheetTitle>
            <div className="flex shrink-0 items-center gap-2">
              {canPlayAudio && audioMeta?.downloadUrl && (
                <Button variant="outline" size="sm" asChild className="gap-2">
                  <a href={audioMeta.downloadUrl} download>
                    <Download className="size-4" />
                    Скачать
                  </a>
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setConfirmDeleteOpen(true)}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="size-4" />
                Удалить
              </Button>
            </div>
          </div>
          <SheetDescription className="text-sm text-neutral-500">
            {[counterparty, phone, directionLabel, date]
              .filter(Boolean)
              .join(" · ")}
          </SheetDescription>

          {agentName && (
            <button
              type="button"
              onClick={() =>
                record.userId != null && navigate(`/users/${record.userId}`)
              }
              className={cn(
                "flex items-center gap-2 pt-1 text-left",
                record.userId != null && "group cursor-pointer",
              )}
            >
              <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xs font-semibold text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                {agentName.charAt(0).toUpperCase()}
              </div>
              <span
                className={cn(
                  "text-sm text-neutral-600 dark:text-neutral-400",
                  record.userId != null &&
                    "group-hover:text-neutral-900 group-hover:underline dark:group-hover:text-neutral-100",
                )}
              >
                Менеджер: {agentName}
              </span>
            </button>
          )}
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="flex flex-col gap-5">
            {canPlayAudio && (
              <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-700 dark:bg-neutral-800">
                <div className="[&_.rhap_container]:bg-transparent [&_.rhap_container]:p-0 [&_.rhap_container]:shadow-none [&_.rhap_current-time]:text-sm [&_.rhap_download-progress]:bg-neutral-200 dark:[&_.rhap_download-progress]:bg-neutral-600 [&_.rhap_main-controls-button]:text-neutral-700 dark:[&_.rhap_main-controls-button]:text-neutral-200 [&_.rhap_main-controls-button_svg]:fill-current [&_.rhap_play-pause-button]:text-neutral-700 dark:[&_.rhap_play-pause-button]:text-neutral-200 [&_.rhap_play-pause-button_svg]:fill-current [&_.rhap_progress-bar]:bg-neutral-200 dark:[&_.rhap_progress-bar]:bg-neutral-600 [&_.rhap_progress-filled]:bg-primary [&_.rhap_progress-indicator]:bg-primary [&_.rhap_time]:text-sm [&_.rhap_time]:text-neutral-500 dark:[&_.rhap_time]:text-neutral-400 [&_.rhap_volume-button]:text-neutral-700 dark:[&_.rhap_volume-button]:text-neutral-200 [&_.rhap_volume-button_svg]:fill-current [&_.rhap_volume-indicator]:bg-primary [&_.rhap_volume-bar]:bg-neutral-200 dark:[&_.rhap_volume-bar]:bg-neutral-600">
                  <AudioPlayer
                    ref={playerRef}
                    src={audioMeta?.url}
                    preload="metadata"
                    showJumpControls={false}
                    customAdditionalControls={[]}
                    customVolumeControls={[]}
                    layout="stacked-reverse"
                  />
                </div>
              </div>
            )}

            {durationValue != null && (
              <div className="flex flex-col gap-0.5 rounded-lg border border-neutral-100 p-3 dark:border-neutral-700">
                <p className="text-[10px] uppercase tracking-wide text-neutral-400">
                  Длительность
                </p>
                <p className="text-sm font-medium">
                  {formatDuration(durationValue)}
                </p>
              </div>
            )}

            {record.source === "mango" && (
              <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-600 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                <p className="font-medium">Источник: Mango</p>
                <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                  Направление: {directionLabel}
                </p>
                {counterparty && (
                  <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                    Контрагент: {counterparty}
                  </p>
                )}
                {phone && (
                  <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                    Номер: {phone}
                  </p>
                )}
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

    <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Удалить запись?</AlertDialogTitle>
          <AlertDialogDescription>
            Это действие необратимо. Запись и её аудиофайл будут удалены навсегда.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Отмена</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => {
              deleteMutation.mutate(record.id, {
                onSuccess: () => {
                  setConfirmDeleteOpen(false);
                  onClose();
                },
              });
            }}
          >
            Удалить
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
