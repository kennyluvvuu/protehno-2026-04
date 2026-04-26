import { zodResolver } from "@hookform/resolvers/zod";
import {
  Download,
  Link2,
  Loader2,
  RefreshCw,
  Search,
  Unlink2,
  UserPlus,
  Users,
  Wand2,
} from "lucide-react";
import { useState } from "react";
import { Navigate } from "react-router";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader } from "~/components/layout";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Field } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { mangoApi, type MangoDirectoryCandidate } from "~/axios/mango";
import { usersApi } from "~/axios/users";
import { USERS_KEY } from "~/hooks/useUsers";
import { getApiErrorMessage } from "~/lib/api-error";
import { useAuthStore } from "~/stores/useAuthStore";

const MANGO_CANDIDATES_KEY = ["mango", "users", "candidates"] as const;

type MangoTab = "overview" | "sync";

const MANGO_TABS: Array<{
  value: MangoTab;
  label: string;
}> = [
  { value: "overview", label: "Импорт пользователей" },
  { value: "sync", label: "Синхронизация звонков" },
];

const createLocalUserSchema = z.object({
  name: z.string().trim().min(2, { message: "Минимум 2 символа" }),
  fio: z.string().trim().optional(),
  email: z.string().trim().email({ message: "Некорректный email" }),
});

type MangoSyncResult = {
  startDate?: string;
  endDate?: string;
  fetched?: number;
  created?: number;
  updated?: number;
  downloaded?: number;
  failedDownloads?: number;
  skippedNoAudio?: number;
};

type CreateLocalUserFormValues = z.infer<typeof createLocalUserSchema>;

function formatNullable(value: string | number | null | undefined): string {
  if (value == null || value === "") return "—";
  return String(value);
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function formatMangoDate(value: Date): string {
  return (
    [pad(value.getDate()), pad(value.getMonth() + 1), value.getFullYear()].join(
      ".",
    ) +
    ` ${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`
  );
}

function getDefaultSyncRange(): { startDate: string; endDate: string } {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);

  return {
    startDate: formatMangoDate(startOfMonth),
    endDate: formatMangoDate(now),
  };
}

function CreateLocalUserDialog({
  open,
  candidate,
  onClose,
  onSubmit,
  isPending,
}: {
  open: boolean;
  candidate: MangoDirectoryCandidate | null;
  onClose: () => void;
  onSubmit: (values: CreateLocalUserFormValues) => Promise<void>;
  isPending: boolean;
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateLocalUserFormValues>({
    resolver: zodResolver(createLocalUserSchema),
    defaultValues: {
      name: candidate?.createLocalUserDraft.name ?? "",
      fio: candidate?.createLocalUserDraft.fio ?? "",
      email: candidate?.createLocalUserDraft.email ?? "",
    },
    values: {
      name: candidate?.createLocalUserDraft.name ?? "",
      fio: candidate?.createLocalUserDraft.fio ?? "",
      email: candidate?.createLocalUserDraft.email ?? "",
    },
  });

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && handleClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Создать локального пользователя из Mango</DialogTitle>
          <DialogDescription>
            {candidate
              ? `Mango ID: ${candidate.mangoUserId}. Пользователь будет создан автоматически. Пароль по умолчанию: Mango User ID (${candidate.mangoUserId}).`
              : "Создание пользователя"}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit(async (values) => {
            await onSubmit(values);
            handleClose();
          })}
          className="space-y-4"
        >
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-600 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
            После создания локального пользователя вы сможете позже изменить
            пароль и дополнить недостающие данные в его карточке. Пароль по
            умолчанию: Mango User ID.
          </div>

          <Field
            label="Имя"
            htmlFor="mango-create-name"
            error={errors.name?.message}
          >
            <Input
              id="mango-create-name"
              {...register("name")}
              hasError={!!errors.name}
            />
          </Field>

          <Field
            label="ФИО"
            htmlFor="mango-create-fio"
            error={errors.fio?.message}
          >
            <Input
              id="mango-create-fio"
              {...register("fio")}
              hasError={!!errors.fio}
            />
          </Field>

          <Field
            label="Email"
            htmlFor="mango-create-email"
            error={errors.email?.message}
          >
            <Input
              id="mango-create-email"
              type="email"
              {...register("email")}
              hasError={!!errors.email}
            />
          </Field>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={handleClose}>
              Отмена
            </Button>
            <Button type="submit" disabled={isPending} className="gap-2">
              {isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <UserPlus className="size-4" />
              )}
              Создать и заполнить позже
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function MangoPage() {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((state) => state.user);

  if (currentUser?.role && currentUser.role !== "director") {
    return <Navigate to="/" replace />;
  }

  const [activeTab, setActiveTab] = useState<MangoTab>("overview");
  const [selectedCandidate, setSelectedCandidate] =
    useState<MangoDirectoryCandidate | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const {
    data: candidatesResponse,
    isPending: candidatesPending,
    refetch: refetchCandidates,
  } = useQuery({
    queryKey: MANGO_CANDIDATES_KEY,
    queryFn: () => mangoApi.getUsersCandidates(),
  });

  const { data: users = [] } = useQuery({
    queryKey: USERS_KEY,
    queryFn: () => usersApi.getAll(),
  });

  const [manualSyncResult, setManualSyncResult] =
    useState<MangoSyncResult | null>(null);
  const [manualSyncError, setManualSyncError] = useState<string | null>(null);

  const refreshUsersMutation = useMutation({
    mutationFn: () => mangoApi.refreshUsers(),
    onSuccess: async () => {
      await refetchCandidates();
      toast.success("Справочник пользователей Mango обновлён");
    },
    onError: (error) => {
      toast.error(
        getApiErrorMessage(error, "Не удалось обновить пользователей Mango"),
      );
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const { startDate, endDate } = getDefaultSyncRange();

      return mangoApi.sync({
        startDate,
        endDate,
        limit: 500,
        offset: 0,
        downloadRecordings: true,
      });
    },
    onSuccess: (result) => {
      setManualSyncError(null);
      setManualSyncResult(result);
      toast.success("Синхронизация Mango успешно завершена");
    },
    onError: (error) => {
      const message = getApiErrorMessage(
        error,
        "Не удалось выполнить синхронизацию Mango",
      );
      setManualSyncResult(null);
      setManualSyncError(message);
      toast.error(message);
    },
  });

  const createLocalUserMutation = useMutation({
    mutationFn: async ({
      candidate,
      values,
    }: {
      candidate: MangoDirectoryCandidate;
      values: CreateLocalUserFormValues;
    }) => {
      const draft = candidate.createLocalUserDraft;
      return usersApi.createFromMango({
        name: values.name.trim(),
        fio: values.fio?.trim() ? values.fio.trim() : null,
        email: values.email.trim(),
        role: "manager",
        mangoUserId: draft.mangoUserId,
        mangoLogin: draft.mangoLogin ?? null,
        mangoExtension: draft.mangoExtension ?? null,
        mangoPosition: draft.mangoPosition ?? null,
        mangoDepartment: draft.mangoDepartment ?? null,
        mangoMobile: draft.mangoMobile ?? null,
        mangoOutgoingLine: draft.mangoOutgoingLine ?? null,
        mangoAccessRoleId: draft.mangoAccessRoleId ?? null,
        mangoGroups: draft.mangoGroups ?? null,
        mangoSips: draft.mangoSips ?? null,
        mangoTelephonyNumbers: draft.mangoTelephonyNumbers ?? null,
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: USERS_KEY }),
        queryClient.invalidateQueries({ queryKey: MANGO_CANDIDATES_KEY }),
      ]);
      toast.success(
        "Локальный пользователь создан. Пароль и недостающие данные можно заполнить позже в карточке пользователя",
      );
    },
    onError: (error) => {
      toast.error(
        getApiErrorMessage(
          error,
          "Не удалось создать локального пользователя из Mango",
        ),
      );
    },
  });

  const bulkCreateLocalUsersMutation = useMutation({
    mutationFn: async (candidates: MangoDirectoryCandidate[]) => {
      const results: {
        created: MangoDirectoryCandidate[];
        skipped: MangoDirectoryCandidate[];
        failed: Array<{ candidate: MangoDirectoryCandidate; reason: string }>;
      } = {
        created: [],
        skipped: [],
        failed: [],
      };

      for (const candidate of candidates) {
        const draft = candidate.createLocalUserDraft;

        try {
          await usersApi.createFromMango({
            name: draft.name.trim(),
            fio: draft.fio?.trim() ? draft.fio.trim() : null,
            email: draft.email.trim(),
            role: "manager",
            mangoUserId: draft.mangoUserId,
            mangoLogin: draft.mangoLogin ?? null,
            mangoExtension: draft.mangoExtension ?? null,
            mangoPosition: draft.mangoPosition ?? null,
            mangoDepartment: draft.mangoDepartment ?? null,
            mangoMobile: draft.mangoMobile ?? null,
            mangoOutgoingLine: draft.mangoOutgoingLine ?? null,
            mangoAccessRoleId: draft.mangoAccessRoleId ?? null,
            mangoGroups: draft.mangoGroups ?? null,
            mangoSips: draft.mangoSips ?? null,
            mangoTelephonyNumbers: draft.mangoTelephonyNumbers ?? null,
          });

          results.created.push(candidate);
        } catch (error) {
          const message = getApiErrorMessage(
            error,
            "Не удалось создать локального пользователя из Mango",
          );
          const normalized = message.toLowerCase();

          if (
            normalized.includes("already in use") ||
            normalized.includes("уже используется") ||
            normalized.includes("уже существует")
          ) {
            results.skipped.push(candidate);
          } else {
            results.failed.push({ candidate, reason: message });
          }
        }
      }

      return results;
    },
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: USERS_KEY }),
        queryClient.invalidateQueries({ queryKey: MANGO_CANDIDATES_KEY }),
      ]);

      const summary = [
        `Создано: ${result.created.length}`,
        `Пропущено: ${result.skipped.length}`,
        `Ошибок: ${result.failed.length}`,
      ].join(" · ");

      if (result.failed.length > 0) {
        toast.error(summary);
        return;
      }

      toast.success(summary);
    },
    onError: (error) => {
      toast.error(
        getApiErrorMessage(
          error,
          "Не удалось автоматически создать локальных пользователей из Mango",
        ),
      );
    },
  });

  const items = candidatesResponse?.items ?? [];

  const linkedCount = items.filter((item) => item.linkedUserId != null).length;
  const unlinkedCount = items.length - linkedCount;
  const suggestionCount = items.filter(
    (item) => item.linkedUserId == null,
  ).length;
  const withoutCandidatesCount = items.length - suggestionCount;
  const autoCreatableItems = items.filter((item) => item.linkedUserId == null);

  const handleOpenCreate = (candidate: MangoDirectoryCandidate) => {
    setSelectedCandidate(candidate);
    setCreateOpen(true);
  };

  return (
    <div>
      <PageHeader
        title="Mango Office"
        description="Импорт пользователей из Mango и запуск синхронизации звонков"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => void refetchCandidates()}
              disabled={candidatesPending}
              className="gap-2"
            >
              {candidatesPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              Обновить список
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => void refreshUsersMutation.mutateAsync()}
              disabled={refreshUsersMutation.isPending}
              className="gap-2"
            >
              {refreshUsersMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Users className="size-4" />
              )}
              Обновить пользователей Mango
            </Button>

            <Button
              type="button"
              onClick={() =>
                void bulkCreateLocalUsersMutation.mutateAsync(
                  autoCreatableItems,
                )
              }
              disabled={
                bulkCreateLocalUsersMutation.isPending ||
                autoCreatableItems.length === 0
              }
              className="gap-2"
            >
              {bulkCreateLocalUsersMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Wand2 className="size-4" />
              )}
              Импортировать пользователей автоматически
            </Button>
          </div>
        }
      />

      <div className="mb-6 flex flex-wrap gap-2">
        {MANGO_TABS.map((tab) => (
          <Button
            key={tab.value}
            type="button"
            variant={activeTab === tab.value ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab(tab.value)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {activeTab === "overview" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
          <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-700">
            <div className="flex items-center gap-2 text-neutral-500">
              <Users className="size-4" />
              <span className="text-xs uppercase tracking-wide">
                Всего в Mango
              </span>
            </div>
            <p className="mt-3 text-2xl font-semibold">{items.length}</p>
          </div>

          <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-700">
            <div className="flex items-center gap-2 text-neutral-500">
              <Link2 className="size-4" />
              <span className="text-xs uppercase tracking-wide">Привязано</span>
            </div>
            <p className="mt-3 text-2xl font-semibold">{linkedCount}</p>
          </div>

          <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-700">
            <div className="flex items-center gap-2 text-neutral-500">
              <Unlink2 className="size-4" />
              <span className="text-xs uppercase tracking-wide">
                Не привязано
              </span>
            </div>
            <p className="mt-3 text-2xl font-semibold">{unlinkedCount}</p>
          </div>

          <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-700">
            <div className="flex items-center gap-2 text-neutral-500">
              <Search className="size-4" />
              <span className="text-xs uppercase tracking-wide">
                Готово к импорту
              </span>
            </div>
            <p className="mt-3 text-2xl font-semibold">{suggestionCount}</p>
          </div>
        </div>
      )}

      {activeTab === "overview" && (
        <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-[1.4fr,1fr]">
          <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-700">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">Импорт пользователей</h2>
                <p className="text-xs text-neutral-500">
                  Основной сценарий: обновить справочник Mango и автоматически
                  создать локальных пользователей
                </p>
              </div>
              <Badge variant="outline">enabled</Badge>
            </div>

            <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-100">
              <p className="font-medium">Пароль по умолчанию</p>
              <p className="mt-1">
                Для автоматически созданных пользователей пароль по умолчанию —
                это <strong>Mango User ID</strong>. Позже директор сможет
                изменить пароль в карточке пользователя.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-700">
                <p className="text-xs uppercase tracking-wide text-neutral-400">
                  Всего в Mango
                </p>
                <p className="mt-2 text-xl font-semibold">{items.length}</p>
              </div>
              <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-700">
                <p className="text-xs uppercase tracking-wide text-neutral-400">
                  Уже импортировано
                </p>
                <p className="mt-2 text-xl font-semibold">{linkedCount}</p>
              </div>
              <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-700">
                <p className="text-xs uppercase tracking-wide text-neutral-400">
                  Готово к импорту
                </p>
                <p className="mt-2 text-xl font-semibold">{unlinkedCount}</p>
              </div>
              <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-700">
                <p className="text-xs uppercase tracking-wide text-neutral-400">
                  Без кандидатов
                </p>
                <p className="mt-2 text-xl font-semibold">
                  {withoutCandidatesCount}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-700">
            <div className="mb-4">
              <h2 className="text-sm font-semibold">Быстрые действия</h2>
              <p className="text-xs text-neutral-500">
                Достаточно двух шагов для импорта пользователей
              </p>
            </div>

            <div className="mb-4 rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm dark:border-neutral-700 dark:bg-neutral-800">
              <p className="font-medium text-neutral-900 dark:text-neutral-100">
                Краткая схема импорта
              </p>
              <ul className="mt-2 space-y-1 text-neutral-600 dark:text-neutral-300">
                <li>1. Обновите справочник пользователей Mango</li>
                <li>
                  2. Импортируйте локальных пользователей автоматически
                  (повторный запуск пропускает уже созданных)
                </li>
                <li>
                  3. При необходимости смените пароль в карточке пользователя
                </li>
              </ul>
            </div>

            <div className="flex flex-col gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => void refreshUsersMutation.mutateAsync()}
                disabled={refreshUsersMutation.isPending}
                className="justify-start gap-2"
              >
                {refreshUsersMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Users className="size-4" />
                )}
                1. Обновить пользователей Mango
              </Button>

              <Button
                type="button"
                onClick={() =>
                  void bulkCreateLocalUsersMutation.mutateAsync(
                    autoCreatableItems,
                  )
                }
                disabled={
                  bulkCreateLocalUsersMutation.isPending ||
                  autoCreatableItems.length === 0
                }
                className="justify-start gap-2"
              >
                {bulkCreateLocalUsersMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Wand2 className="size-4" />
                )}
                2. Импортировать пользователей автоматически
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() => setActiveTab("sync")}
                className="justify-start gap-2"
              >
                <Download className="size-4" />
                Синхронизировать звонки
              </Button>
            </div>
          </div>
        </div>
      )}

      {activeTab === "sync" && (
        <div className="mt-6 rounded-xl border border-neutral-200 p-4 dark:border-neutral-700">
          <div className="mb-4">
            <h2 className="text-sm font-semibold">
              Ручная синхронизация Mango
            </h2>
            <p className="text-xs text-neutral-500">
              Загружает звонки с начала текущего месяца по текущее время
            </p>
          </div>

          <div className="space-y-4">
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-600 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
              Для демо используется безопасный диапазон:
              <br />
              <strong>от начала текущего месяца до текущего момента</strong>
            </div>

            <Button
              type="button"
              onClick={() => {
                setManualSyncError(null);
                void syncMutation.mutateAsync();
              }}
              disabled={syncMutation.isPending}
              className="w-full gap-2"
            >
              {syncMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" />
              )}
              {syncMutation.isPending
                ? "Синхронизация..."
                : "Притянуть звонки из Mango"}
            </Button>
          </div>

          <div className="mt-6 rounded-lg border border-neutral-200 p-4 text-sm dark:border-neutral-700">
            <h3 className="mb-2 font-medium">
              Результат последней синхронизации
            </h3>

            {manualSyncError ? (
              <p className="text-red-600">{manualSyncError}</p>
            ) : !manualSyncResult ? (
              <p className="text-neutral-500">
                Синхронизация ещё не запускалась
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3 text-xs text-neutral-600 dark:text-neutral-300">
                <div>
                  <p className="text-neutral-400">Получено звонков</p>
                  <p className="mt-1 text-sm font-medium">
                    {formatNullable(manualSyncResult.fetched)}
                  </p>
                </div>
                <div>
                  <p className="text-neutral-400">Создано записей</p>
                  <p className="mt-1 text-sm font-medium">
                    {formatNullable(manualSyncResult.created)}
                  </p>
                </div>
                <div>
                  <p className="text-neutral-400">Обновлено записей</p>
                  <p className="mt-1 text-sm font-medium">
                    {formatNullable(manualSyncResult.updated)}
                  </p>
                </div>
                <div>
                  <p className="text-neutral-400">Скачано записей</p>
                  <p className="mt-1 text-sm font-medium">
                    {formatNullable(manualSyncResult.downloaded)}
                  </p>
                </div>
                <div>
                  <p className="text-neutral-400">Ошибок скачивания</p>
                  <p className="mt-1 text-sm font-medium">
                    {formatNullable(manualSyncResult.failedDownloads)}
                  </p>
                </div>
                <div>
                  <p className="text-neutral-400">Без аудио / пропущено</p>
                  <p className="mt-1 text-sm font-medium">
                    {formatNullable(manualSyncResult.skippedNoAudio)}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <CreateLocalUserDialog
        open={createOpen}
        candidate={selectedCandidate}
        onClose={() => {
          setCreateOpen(false);
          setSelectedCandidate(null);
        }}
        onSubmit={async (values) => {
          if (!selectedCandidate) return;
          await createLocalUserMutation.mutateAsync({
            candidate: selectedCandidate,
            values,
          });
        }}
        isPending={createLocalUserMutation.isPending}
      />
    </div>
  );
}
