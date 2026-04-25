import { zodResolver } from "@hookform/resolvers/zod";
import {
  Link2,
  Loader2,
  RefreshCw,
  Search,
  Unlink2,
  UserPlus,
  Users,
  Phone,
  Building2,
  Shield,
  Download,
  PhoneCall,
} from "lucide-react";
import { useMemo, useState } from "react";
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
import { Skeleton } from "~/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { mangoApi, type MangoDirectoryCandidate } from "~/axios/mango";
import { usersApi } from "~/axios/users";
import { USERS_KEY } from "~/hooks/useUsers";
import { getApiErrorMessage } from "~/lib/api-error";
import type { User } from "~/types/auth";

const MANGO_CANDIDATES_KEY = ["mango", "users", "candidates"] as const;

const syncSchema = z.object({
  startDate: z.string().min(1, { message: "Укажите дату начала" }),
  endDate: z.string().min(1, { message: "Укажите дату окончания" }),
  limit: z
    .string()
    .optional()
    .refine((value) => !value || /^\d+$/.test(value), {
      message: "Только число",
    }),
  offset: z
    .string()
    .optional()
    .refine((value) => !value || /^\d+$/.test(value), {
      message: "Только число",
    }),
  pollIntervalMs: z
    .string()
    .optional()
    .refine((value) => !value || /^\d+$/.test(value), {
      message: "Только число",
    }),
  maxAttempts: z
    .string()
    .optional()
    .refine((value) => !value || /^\d+$/.test(value), {
      message: "Только число",
    }),
  downloadRecordings: z.boolean().optional().default(true),
});

const createLocalUserSchema = z.object({
  name: z.string().trim().min(2, { message: "Минимум 2 символа" }),
  fio: z.string().trim().optional(),
  email: z.string().trim().email({ message: "Некорректный email" }),
  password: z.string().min(6, { message: "Минимум 6 символов" }),
});

type SyncFormValues = z.infer<typeof syncSchema>;
type CreateLocalUserFormValues = z.infer<typeof createLocalUserSchema>;

function getDisplayName(user: Pick<User, "name" | "fio">): string {
  return user.fio?.trim() || user.name;
}

function getCandidateReasonLabel(reason: string): string {
  switch (reason) {
    case "mango_user_id_exact":
      return "точный Mango ID";
    case "extension_hint":
      return "совпадение по внутреннему номеру";
    case "login_hint":
      return "совпадение по логину";
    case "sip_hint":
      return "совпадение по SIP";
    case "record_history":
      return "история звонков";
    default:
      return reason;
  }
}

function formatNullable(value: string | number | null | undefined): string {
  if (value == null || value === "") return "—";
  return String(value);
}

function formatArray(
  values: Array<string | number> | null | undefined,
): string {
  if (!values || values.length === 0) return "—";
  return values.join(", ");
}

function CandidateInfo({
  candidate,
  linkedUser,
}: {
  candidate: MangoDirectoryCandidate;
  linkedUser: User | undefined;
}) {
  const bestMatch = candidate.candidates[0];

  if (linkedUser) {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Badge className="bg-green-600 text-white hover:bg-green-600">
            Привязан
          </Badge>
          <span className="text-sm font-medium">
            {getDisplayName(linkedUser)}
          </span>
        </div>
        <p className="text-xs text-neutral-500">{linkedUser.email}</p>
      </div>
    );
  }

  if (bestMatch) {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Badge variant="outline">Кандидат</Badge>
          <span className="text-sm font-medium">
            {getDisplayName(bestMatch.user)}
          </span>
          <span className="text-xs text-neutral-400">{bestMatch.score}%</span>
        </div>
        <p className="text-xs text-neutral-500">{bestMatch.user.email}</p>
        <p className="text-xs text-neutral-400">
          {bestMatch.reasons.map(getCandidateReasonLabel).join(", ")}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <Badge variant="outline">Не найден</Badge>
      <p className="text-xs text-neutral-500">
        Локальный пользователь не подобран автоматически
      </p>
    </div>
  );
}

function LinkUserDialog({
  open,
  candidate,
  users,
  onClose,
  onSubmit,
  isPending,
}: {
  open: boolean;
  candidate: MangoDirectoryCandidate | null;
  users: User[];
  onClose: () => void;
  onSubmit: (userId: number) => Promise<void>;
  isPending: boolean;
}) {
  const [search, setSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;

    return users.filter((user) => {
      const displayName = getDisplayName(user).toLowerCase();
      const email = user.email.toLowerCase();
      const mangoUserId =
        user.mangoUserId != null ? String(user.mangoUserId) : "";
      return (
        displayName.includes(q) ||
        email.includes(q) ||
        mangoUserId.includes(q) ||
        user.name.toLowerCase().includes(q) ||
        (user.fio ?? "").toLowerCase().includes(q)
      );
    });
  }, [search, users]);

  const handleClose = () => {
    setSearch("");
    setSelectedUserId(null);
    onClose();
  };

  const handleSubmit = async () => {
    if (selectedUserId == null) return;
    await onSubmit(selectedUserId);
    handleClose();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && handleClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Привязать локального пользователя</DialogTitle>
          <DialogDescription>
            {candidate ? (
              <>
                Mango ID: <strong>{candidate.mangoUserId}</strong> ·{" "}
                {candidate.name || "Без имени"}
              </>
            ) : (
              "Выберите пользователя для привязки"
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по имени, email или Mango ID…"
              className="pl-9"
            />
          </div>

          <div className="max-h-[360px] overflow-y-auto rounded-lg border border-neutral-200 dark:border-neutral-700">
            <div className="divide-y divide-neutral-200 dark:divide-neutral-700">
              {filteredUsers.length === 0 ? (
                <div className="p-6 text-center text-sm text-neutral-500">
                  Пользователи не найдены
                </div>
              ) : (
                filteredUsers.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => setSelectedUserId(user.id)}
                    className={`flex w-full items-start justify-between gap-4 px-4 py-3 text-left transition-colors ${
                      selectedUserId === user.id
                        ? "bg-neutral-100 dark:bg-neutral-800"
                        : "hover:bg-neutral-50 dark:hover:bg-neutral-900/50"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {getDisplayName(user)}
                      </p>
                      <p className="truncate text-xs text-neutral-500">
                        {user.email}
                      </p>
                    </div>
                    <div className="shrink-0 text-right text-xs text-neutral-400">
                      {user.mangoUserId != null
                        ? `Mango ID: ${user.mangoUserId}`
                        : "Без Mango ID"}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={handleClose}>
            Отмена
          </Button>
          <Button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={selectedUserId == null || isPending}
            className="gap-2"
          >
            {isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Link2 className="size-4" />
            )}
            Привязать
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
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
      password: "",
    },
    values: {
      name: candidate?.createLocalUserDraft.name ?? "",
      fio: candidate?.createLocalUserDraft.fio ?? "",
      email: candidate?.createLocalUserDraft.email ?? "",
      password: "",
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
              ? `Mango ID: ${candidate.mangoUserId}`
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

          <Field
            label="Пароль"
            htmlFor="mango-create-password"
            error={errors.password?.message}
          >
            <Input
              id="mango-create-password"
              type="password"
              placeholder="Минимум 6 символов"
              {...register("password")}
              hasError={!!errors.password}
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
              Создать и привязать
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function MangoPage() {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [selectedCandidate, setSelectedCandidate] =
    useState<MangoDirectoryCandidate | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
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

  const syncForm = useForm({
    resolver: zodResolver(syncSchema),
    defaultValues: {
      startDate: "",
      endDate: "",
      limit: "100",
      offset: "0",
      pollIntervalMs: "1500",
      maxAttempts: "20",
      downloadRecordings: true,
    },
  });

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
    mutationFn: (values: SyncFormValues) =>
      mangoApi.sync({
        startDate: values.startDate,
        endDate: values.endDate,
        limit: values.limit ? Number(values.limit) : undefined,
        offset: values.offset ? Number(values.offset) : undefined,
        pollIntervalMs: values.pollIntervalMs
          ? Number(values.pollIntervalMs)
          : undefined,
        maxAttempts: values.maxAttempts
          ? Number(values.maxAttempts)
          : undefined,
        downloadRecordings: values.downloadRecordings,
      }),
    onSuccess: () => {
      toast.success("Синхронизация Mango успешно запущена");
    },
    onError: (error) => {
      toast.error(
        getApiErrorMessage(error, "Не удалось выполнить синхронизацию Mango"),
      );
    },
  });

  const linkMutation = useMutation({
    mutationFn: ({
      mangoUserId,
      userId,
    }: {
      mangoUserId: number;
      userId: number | null;
    }) => mangoApi.linkUser(mangoUserId, { userId }),
    onSuccess: async (_, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: USERS_KEY }),
        queryClient.invalidateQueries({ queryKey: MANGO_CANDIDATES_KEY }),
      ]);

      toast.success(
        variables.userId == null
          ? "Привязка Mango пользователя снята"
          : "Пользователь успешно привязан к Mango",
      );
    },
    onError: (error) => {
      toast.error(
        getApiErrorMessage(error, "Не удалось изменить привязку Mango"),
      );
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
        password: values.password,
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
      toast.success("Локальный пользователь из Mango создан и привязан");
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

  const items = candidatesResponse?.items ?? [];

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;

    return items.filter((item) => {
      return (
        item.name.toLowerCase().includes(q) ||
        (item.email ?? "").toLowerCase().includes(q) ||
        String(item.mangoUserId).includes(q) ||
        (item.department ?? "").toLowerCase().includes(q) ||
        (item.position ?? "").toLowerCase().includes(q) ||
        (item.login ?? "").toLowerCase().includes(q) ||
        (item.extension ?? "").toLowerCase().includes(q) ||
        (item.mobile ?? "").toLowerCase().includes(q)
      );
    });
  }, [items, search]);

  const linkedCount = items.filter((item) => item.linkedUserId != null).length;
  const unlinkedCount = items.length - linkedCount;
  const suggestionCount = items.filter(
    (item) => item.candidates.length > 0,
  ).length;

  const handleOpenLink = (candidate: MangoDirectoryCandidate) => {
    setSelectedCandidate(candidate);
    setLinkOpen(true);
  };

  const handleOpenCreate = (candidate: MangoDirectoryCandidate) => {
    setSelectedCandidate(candidate);
    setCreateOpen(true);
  };

  const handleUnlink = async (candidate: MangoDirectoryCandidate) => {
    await linkMutation.mutateAsync({
      mangoUserId: candidate.mangoUserId,
      userId: null,
    });
  };

  return (
    <div>
      <PageHeader
        title="Mango Office"
        description="Управление пользователями Mango, привязкой и ручной синхронизацией"
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
              Refresh users
            </Button>
          </div>
        }
      />

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
              Есть кандидаты
            </span>
          </div>
          <p className="mt-3 text-2xl font-semibold">{suggestionCount}</p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-[1.5fr,1fr]">
        <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-700">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Пользователи Mango</h2>
              <p className="text-xs text-neutral-500">
                Сопоставление Mango Office с локальными менеджерами
              </p>
            </div>

            <div className="relative w-full max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Поиск по Mango пользователям…"
                className="pl-9"
              />
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-700">
            <Table>
              <TableHeader>
                <TableRow className="bg-neutral-50/80 dark:bg-neutral-900/80">
                  <TableHead>Mango</TableHead>
                  <TableHead>Локальный пользователь</TableHead>
                  <TableHead>Контакты</TableHead>
                  <TableHead>Данные</TableHead>
                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {candidatesPending ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Skeleton className="h-4 w-36" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-44" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-32" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-36" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="ml-auto h-8 w-32" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : filteredItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-12 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <Users className="size-8 text-neutral-300" />
                        <p className="text-sm text-neutral-500">
                          Ничего не найдено
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredItems.map((candidate) => {
                    const linkedUser = users.find(
                      (user) => user.id === candidate.linkedUserId,
                    );

                    return (
                      <TableRow
                        key={candidate.mangoUserId}
                        className="align-top"
                      >
                        <TableCell className="min-w-[220px]">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">
                                {candidate.name || "Без имени"}
                              </span>
                              <Badge variant="outline">
                                ID {candidate.mangoUserId}
                              </Badge>
                            </div>
                            <div className="space-y-1 text-xs text-neutral-500">
                              <p className="flex items-center gap-1.5">
                                <Building2 className="size-3.5" />
                                {formatNullable(candidate.department)}
                                {candidate.position
                                  ? ` · ${candidate.position}`
                                  : ""}
                              </p>
                              <p className="flex items-center gap-1.5">
                                <Shield className="size-3.5" />
                                accessRoleId:{" "}
                                {formatNullable(candidate.accessRoleId)}
                              </p>
                            </div>
                          </div>
                        </TableCell>

                        <TableCell className="min-w-[240px]">
                          <CandidateInfo
                            candidate={candidate}
                            linkedUser={linkedUser}
                          />
                        </TableCell>

                        <TableCell className="min-w-[220px]">
                          <div className="space-y-1 text-xs text-neutral-500">
                            <p className="flex items-center gap-1.5">
                              <Phone className="size-3.5" />
                              {formatNullable(candidate.mobile)}
                            </p>
                            <p className="flex items-center gap-1.5">
                              <PhoneCall className="size-3.5" />
                              ext: {formatNullable(candidate.extension)}
                            </p>
                            <p>login: {formatNullable(candidate.login)}</p>
                            <p>SIP: {formatArray(candidate.sips)}</p>
                          </div>
                        </TableCell>

                        <TableCell className="min-w-[260px]">
                          <div className="space-y-1 text-xs text-neutral-500">
                            <p>
                              Линия: {formatNullable(candidate.outgoingLine)}
                            </p>
                            <p>Группы: {formatArray(candidate.groups)}</p>
                            <p>
                              Телефония:{" "}
                              {candidate.telephonyNumbers.length > 0
                                ? `${candidate.telephonyNumbers.length} номер(ов)`
                                : "—"}
                            </p>
                            {candidate.linkedByMangoUserId && (
                              <Badge variant="outline" className="mt-1">
                                linkedByMangoUserId
                              </Badge>
                            )}
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="flex justify-end gap-2">
                            {linkedUser ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="gap-2"
                                onClick={() => void handleUnlink(candidate)}
                                disabled={linkMutation.isPending}
                              >
                                {linkMutation.isPending ? (
                                  <Loader2 className="size-4 animate-spin" />
                                ) : (
                                  <Unlink2 className="size-4" />
                                )}
                                Отвязать
                              </Button>
                            ) : (
                              <>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="gap-2"
                                  onClick={() => handleOpenLink(candidate)}
                                >
                                  <Link2 className="size-4" />
                                  Привязать
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  className="gap-2"
                                  onClick={() => handleOpenCreate(candidate)}
                                >
                                  <UserPlus className="size-4" />
                                  Создать
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-700">
          <div className="mb-4">
            <h2 className="text-sm font-semibold">
              Ручная синхронизация Mango
            </h2>
            <p className="text-xs text-neutral-500">
              Запуск загрузки звонков и аудио по указанному диапазону дат
            </p>
          </div>

          <form
            onSubmit={syncForm.handleSubmit(async (values) => {
              await syncMutation.mutateAsync(values);
            })}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                label="Дата начала"
                htmlFor="mango-sync-startDate"
                error={syncForm.formState.errors.startDate?.message}
              >
                <Input
                  id="mango-sync-startDate"
                  type="date"
                  {...syncForm.register("startDate")}
                  hasError={!!syncForm.formState.errors.startDate}
                />
              </Field>

              <Field
                label="Дата окончания"
                htmlFor="mango-sync-endDate"
                error={syncForm.formState.errors.endDate?.message}
              >
                <Input
                  id="mango-sync-endDate"
                  type="date"
                  {...syncForm.register("endDate")}
                  hasError={!!syncForm.formState.errors.endDate}
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                label="Limit"
                htmlFor="mango-sync-limit"
                error={syncForm.formState.errors.limit?.message}
              >
                <Input
                  id="mango-sync-limit"
                  inputMode="numeric"
                  {...syncForm.register("limit")}
                  hasError={!!syncForm.formState.errors.limit}
                />
              </Field>

              <Field
                label="Offset"
                htmlFor="mango-sync-offset"
                error={syncForm.formState.errors.offset?.message}
              >
                <Input
                  id="mango-sync-offset"
                  inputMode="numeric"
                  {...syncForm.register("offset")}
                  hasError={!!syncForm.formState.errors.offset}
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                label="pollIntervalMs"
                htmlFor="mango-sync-pollIntervalMs"
                error={syncForm.formState.errors.pollIntervalMs?.message}
              >
                <Input
                  id="mango-sync-pollIntervalMs"
                  inputMode="numeric"
                  {...syncForm.register("pollIntervalMs")}
                  hasError={!!syncForm.formState.errors.pollIntervalMs}
                />
              </Field>

              <Field
                label="maxAttempts"
                htmlFor="mango-sync-maxAttempts"
                error={syncForm.formState.errors.maxAttempts?.message}
              >
                <Input
                  id="mango-sync-maxAttempts"
                  inputMode="numeric"
                  {...syncForm.register("maxAttempts")}
                  hasError={!!syncForm.formState.errors.maxAttempts}
                />
              </Field>
            </div>

            <label className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
              <input
                type="checkbox"
                className="size-4 rounded border-neutral-300"
                {...syncForm.register("downloadRecordings")}
              />
              Скачивать записи звонков
            </label>

            <Button
              type="submit"
              disabled={syncMutation.isPending}
              className="w-full gap-2"
            >
              {syncMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" />
              )}
              Запустить синхронизацию
            </Button>
          </form>

          <div className="mt-6 rounded-lg border border-neutral-200 p-4 text-sm dark:border-neutral-700">
            <h3 className="mb-2 font-medium">
              Результат последней синхронизации
            </h3>

            {syncMutation.isIdle ? (
              <p className="text-neutral-500">
                Синхронизация ещё не запускалась
              </p>
            ) : syncMutation.isError ? (
              <p className="text-red-600">
                {getApiErrorMessage(
                  syncMutation.error,
                  "Не удалось выполнить синхронизацию",
                )}
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3 text-xs text-neutral-600 dark:text-neutral-300">
                <div>
                  <p className="text-neutral-400">Fetched</p>
                  <p className="mt-1 text-sm font-medium">
                    {formatNullable(
                      syncMutation.data?.fetched as number | null | undefined,
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-neutral-400">Created</p>
                  <p className="mt-1 text-sm font-medium">
                    {formatNullable(
                      syncMutation.data?.created as number | null | undefined,
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-neutral-400">Updated</p>
                  <p className="mt-1 text-sm font-medium">
                    {formatNullable(
                      syncMutation.data?.updated as number | null | undefined,
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-neutral-400">Downloaded</p>
                  <p className="mt-1 text-sm font-medium">
                    {formatNullable(
                      syncMutation.data?.downloaded as
                        | number
                        | null
                        | undefined,
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-neutral-400">Failed downloads</p>
                  <p className="mt-1 text-sm font-medium">
                    {formatNullable(
                      syncMutation.data?.failedDownloads as
                        | number
                        | null
                        | undefined,
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-neutral-400">Skipped no audio</p>
                  <p className="mt-1 text-sm font-medium">
                    {formatNullable(
                      syncMutation.data?.skippedNoAudio as
                        | number
                        | null
                        | undefined,
                    )}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <LinkUserDialog
        open={linkOpen}
        candidate={selectedCandidate}
        users={users}
        onClose={() => {
          setLinkOpen(false);
          setSelectedCandidate(null);
        }}
        onSubmit={async (userId) => {
          if (!selectedCandidate) return;
          await linkMutation.mutateAsync({
            mangoUserId: selectedCandidate.mangoUserId,
            userId,
          });
        }}
        isPending={linkMutation.isPending}
      />

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
