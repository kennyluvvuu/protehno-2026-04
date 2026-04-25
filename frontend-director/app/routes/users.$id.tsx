import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft,
  FileAudio,
  KeyRound,
  Loader2,
  Mail,
  Phone,
  Save,
  Star,
  Trash2,
  UserCog,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Pagination } from "~/components/ui/pagination";
import { usePagination } from "~/hooks/usePagination";
import { useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router";
import { z } from "zod";
import { CallDetailSheet } from "~/components/calls/call-detail-sheet";
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
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { usersApi } from "~/axios/users";
import { useRecords } from "~/hooks/useRecords";
import { useDeleteUser, useUpdateUser, useUsers } from "~/hooks/useUsers";
import { getApiErrorMessage } from "~/lib/api-error";
import { cn } from "~/lib/utils";
import type { User } from "~/types/auth";
import type { Record, RecordStatus } from "~/types/record";

const editUserSchema = z.object({
  name: z.string().trim().min(2, { message: "Минимум 2 символа" }),
  fio: z.string().trim().optional(),
  email: z.string().trim().email({ message: "Некорректный email" }),
  mangoUserId: z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || /^\d+$/.test(value), {
      message: "Введите числовой Mango ID",
    }),
  role: z.enum(["director", "manager"]),
});

const resetPasswordSchema = z.object({
  password: z.string().min(6, { message: "Минимум 6 символов" }),
});

type EditUserFormValues = z.infer<typeof editUserSchema>;
type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

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
  const minutes = Math.floor(sec / 60);
  const seconds = sec % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
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

function getDisplayDuration(record: Record): number | null {
  return record.durationSec ?? record.talkDurationSec ?? null;
}

function formatQuality(value: number | null | undefined): string {
  return value == null ? "—" : `${Math.round(value)}%`;
}

function formatMangoUserId(value: number | null): string {
  return value == null ? "Mango ID не привязан" : `Mango ID: ${value}`;
}

function toFormValues(user: User): EditUserFormValues {
  return {
    name: user.name,
    fio: user.fio ?? "",
    email: user.email,
    mangoUserId: user.mangoUserId != null ? String(user.mangoUserId) : "",
    role: user.role,
  };
}

export default function UserDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<Record | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [resetPasswordOpen, setResetPasswordOpen] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [resetPasswordError, setResetPasswordError] = useState<string | null>(
    null,
  );

  const { data: users = [], isLoading: usersLoading } = useUsers();
  const { data: records = [], isLoading: recordsLoading } = useRecords();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();

  const userId = id ? Number.parseInt(id, 10) : null;
  const user = users.find((item) => item.id === userId);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<EditUserFormValues>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      name: "",
      fio: "",
      email: "",
      mangoUserId: "",
      role: "manager",
    },
  });

  const {
    register: registerResetPassword,
    handleSubmit: handleResetPasswordSubmit,
    reset: resetResetPasswordForm,
    formState: {
      errors: resetPasswordErrors,
      isSubmitting: isResetPasswordSubmitting,
    },
  } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: "",
    },
  });

  useEffect(() => {
    if (user) {
      reset(toFormValues(user));
    }
  }, [user, reset]);

  const userRecords = useMemo(
    () => records.filter((record) => record.userId === userId),
    [records, userId],
  );

  const {
    page: recordsPage,
    totalPages: recordsTotalPages,
    pageItems: recordsPageItems,
    setPage: setRecordsPage,
  } = usePagination(userRecords);

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
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3 mb-2">
          <Skeleton className="size-9 rounded-md" />
          <Skeleton className="size-11 rounded-full" />
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-28" />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-48 rounded-xl lg:col-span-2" />
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (!user || userId == null) {
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

  const onSubmit = async (values: EditUserFormValues): Promise<void> => {
    await updateUser.mutateAsync({
      id: user.id,
      data: {
        name: values.name.trim(),
        fio: values.fio?.trim() ? values.fio.trim() : null,
        email: values.email.trim(),
        mangoUserId: values.mangoUserId?.trim()
          ? Number(values.mangoUserId.trim())
          : null,
        role: values.role,
      },
    });
  };

  const handleDelete = async (): Promise<void> => {
    await deleteUser.mutateAsync({ id: user.id });
    setDeleteOpen(false);
    navigate("/users", { replace: true });
  };

  const onResetPassword = async (
    values: ResetPasswordFormValues,
  ): Promise<void> => {
    try {
      setResetPasswordError(null);
      setIsResettingPassword(true);
      await usersApi.resetPassword(user.id, values.password);
      resetResetPasswordForm();
      setResetPasswordOpen(false);
    } catch (error) {
      setResetPasswordError(
        getApiErrorMessage(error, "Не удалось обновить пароль"),
      );
    } finally {
      setIsResettingPassword(false);
    }
  };

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

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <UserCog className="size-4" />
              Управление пользователем
            </CardTitle>
          </CardHeader>

          <CardContent>
            <form
              onSubmit={handleSubmit(onSubmit)}
              noValidate
              className="flex flex-col gap-4"
            >
              <Field label="Логин" htmlFor="name" error={errors.name?.message}>
                <Input
                  id="name"
                  placeholder="manager01"
                  hasError={!!errors.name}
                  {...register("name")}
                />
              </Field>

              <Field label="ФИО" htmlFor="fio" error={errors.fio?.message}>
                <Input
                  id="fio"
                  placeholder="Иванов Иван Иванович"
                  hasError={!!errors.fio}
                  {...register("fio")}
                />
              </Field>

              <Field
                label="Email"
                htmlFor="email"
                error={errors.email?.message}
              >
                <Input
                  id="email"
                  type="email"
                  placeholder="manager@example.com"
                  hasError={!!errors.email}
                  {...register("email")}
                />
              </Field>

              <Field
                label="Mango User ID"
                htmlFor="mangoUserId"
                error={errors.mangoUserId?.message}
              >
                <Input
                  id="mangoUserId"
                  inputMode="numeric"
                  placeholder="12345"
                  hasError={!!errors.mangoUserId}
                  {...register("mangoUserId")}
                />
              </Field>

              <Field label="Роль" htmlFor="role" error={errors.role?.message}>
                <select
                  id="role"
                  className={cn(
                    "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  )}
                  {...register("role")}
                >
                  <option value="manager">Менеджер</option>
                  <option value="director">Директор</option>
                </select>
              </Field>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setResetPasswordError(null);
                      resetResetPasswordForm();
                      setResetPasswordOpen(true);
                    }}
                  >
                    <KeyRound className="size-4" />
                    Сменить пароль
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => reset(toFormValues(user))}
                    disabled={!isDirty || isSubmitting || updateUser.isPending}
                  >
                    Сбросить
                  </Button>
                </div>

                <Button
                  type="submit"
                  disabled={!isDirty || isSubmitting || updateUser.isPending}
                  className="gap-2"
                >
                  {updateUser.isPending || isSubmitting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Save className="size-4" />
                  )}
                  Сохранить
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-red-700 dark:text-red-400">
              Опасная зона
            </CardTitle>
          </CardHeader>

          <CardContent>
            <Button
              type="button"
              variant="outline"
              className="gap-2 border-red-200 bg-white text-red-700 hover:border-red-300 hover:bg-red-100 hover:text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400 dark:hover:border-red-700 dark:hover:bg-red-950/60 dark:hover:text-red-300"
              onClick={() => setDeleteOpen(true)}
              disabled={deleteUser.isPending}
            >
              {deleteUser.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              Удалить менеджера
            </Button>
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
              {recordsLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Skeleton className="h-4 w-36" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-16" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-12" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-10" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-20 rounded-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : userRecords.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-14 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <FileAudio className="size-8 text-neutral-300" />
                      <p className="text-sm text-neutral-500">Нет звонков</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                recordsPageItems.map((record) => {
                  const displayDuration = getDisplayDuration(record);

                  return (
                    <TableRow
                      key={record.id}
                      className="cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                      onClick={() => setSelected(record)}
                    >
                      <TableCell className="max-w-48 truncate font-medium">
                        {record.title ?? `Звонок #${record.id}`}
                      </TableCell>
                      <TableCell className="text-neutral-500">
                        {record.callTo ??
                          (record.directionKind === "inbound"
                            ? (record.callerNumber ??
                              record.calleeNumber ??
                              "—")
                            : record.directionKind === "outbound"
                              ? (record.calleeNumber ??
                                record.callerNumber ??
                                "—")
                              : (record.callerNumber ??
                                record.calleeNumber ??
                                "—"))}
                      </TableCell>
                      <TableCell className="text-sm text-neutral-500">
                        {formatRecordDate(record)}
                      </TableCell>
                      <TableCell className="text-sm tabular-nums text-neutral-500">
                        {displayDuration != null
                          ? formatDuration(displayDuration)
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
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <p className="text-xs text-neutral-400">
            {userRecords.length} записей
          </p>
          <Pagination
            page={recordsPage}
            totalPages={recordsTotalPages}
            onPageChange={setRecordsPage}
          />
        </div>
      </div>

      <CallDetailSheet
        record={selected}
        open={!!selected}
        onClose={() => setSelected(null)}
        agentName={displayName}
      />

      <Dialog
        open={resetPasswordOpen}
        onOpenChange={(open) => {
          setResetPasswordOpen(open);
          if (!open) {
            setResetPasswordError(null);
            resetResetPasswordForm();
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Смена пароля</DialogTitle>
            <DialogDescription>
              Задайте новый пароль для пользователя {displayName}.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={handleResetPasswordSubmit(onResetPassword)}
            className="space-y-4"
          >
            <Field
              label="Новый пароль"
              htmlFor="reset-password"
              error={resetPasswordErrors.password?.message}
            >
              <Input
                id="reset-password"
                type="password"
                placeholder="Минимум 6 символов"
                hasError={!!resetPasswordErrors.password}
                {...registerResetPassword("password")}
              />
            </Field>

            {resetPasswordError && (
              <p className="text-sm text-red-600">{resetPasswordError}</p>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setResetPasswordOpen(false);
                  setResetPasswordError(null);
                  resetResetPasswordForm();
                }}
                disabled={isResettingPassword || isResetPasswordSubmitting}
              >
                Отмена
              </Button>
              <Button
                type="submit"
                disabled={isResettingPassword || isResetPasswordSubmitting}
                className="gap-2"
              >
                {isResettingPassword || isResetPasswordSubmitting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <KeyRound className="size-4" />
                )}
                Сохранить новый пароль
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить пользователя?</AlertDialogTitle>
            <AlertDialogDescription>
              Пользователь будет удалён. Его записи сохранятся, но потеряют
              владельца. Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteUser.isPending}>
              Отмена
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteUser.isPending}
              className="bg-red-700/90 hover:bg-red-700 focus:ring-red-700"
            >
              {deleteUser.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
