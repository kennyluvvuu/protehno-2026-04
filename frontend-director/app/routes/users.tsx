import Fuse from "fuse.js";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowUpDown,
  Info,
  Loader2,
  Plus,
  Search,
  UserPlus,
  Users,
  Wand2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useOutletContext } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader } from "~/components/layout";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
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
import { PasswordInput } from "~/components/ui/password-input";
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
import { useCreateUser, useUsers, USERS_KEY } from "~/hooks/useUsers";
import { createUserSchema } from "~/schemas/user";
import { cn } from "~/lib/utils";
import type { User } from "~/types/auth";
import { mangoApi, type MangoDirectoryCandidate } from "~/axios/mango";
import { usersApi } from "~/axios/users";
import { getApiErrorMessage } from "~/lib/api-error";

const MANGO_CANDIDATES_KEY = ["mango", "users", "candidates"] as const;

const createLocalUserSchema = z.object({
  name: z.string().trim().min(2, { message: "Минимум 2 символа" }),
  fio: z.string().trim().optional(),
  email: z.string().trim().email({ message: "Некорректный email" }),
});

type CreateLocalUserFormValues = z.infer<typeof createLocalUserSchema>;

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
          <DialogTitle>Создать пользователя из Mango</DialogTitle>
          <DialogDescription>
            {candidate
              ? `Mango ID: ${candidate.mangoUserId}. Пароль по умолчанию: ${candidate.mangoUserId}.`
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
          <Field label="Имя" htmlFor="mc-name" error={errors.name?.message}>
            <Input id="mc-name" {...register("name")} hasError={!!errors.name} />
          </Field>
          <Field label="ФИО" htmlFor="mc-fio" error={errors.fio?.message}>
            <Input id="mc-fio" {...register("fio")} hasError={!!errors.fio} />
          </Field>
          <Field label="Email" htmlFor="mc-email" error={errors.email?.message}>
            <Input id="mc-email" type="email" {...register("email")} hasError={!!errors.email} />
          </Field>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={handleClose}>
              Отмена
            </Button>
            <Button type="submit" disabled={isPending} className="gap-2">
              {isPending ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
              Создать
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type SortField = "name" | "email";
type SortDir = "asc" | "desc";

const USER_SEARCH_KEYS: Array<{ name: keyof UserSearchItem; weight: number }> =
  [
    { name: "displayName", weight: 0.35 },
    { name: "searchFio", weight: 0.2 },
    { name: "name", weight: 0.15 },
    { name: "email", weight: 0.2 },
    { name: "searchMangoUserId", weight: 0.1 },
  ];

const createManagerSchema = createUserSchema.extend({
  fio: z.string().trim().optional(),
  mangoUserId: z.string().trim().optional(),
});

type CreateManagerFormValues = {
  name: string;
  email: string;
  password: string;
  fio?: string;
  mangoUserId?: string;
};

type UserSearchItem = User & {
  displayName: string;
  searchFio: string;
  searchMangoUserId: string;
};

function getDisplayName(user: Pick<User, "name" | "fio">): string {
  return user.fio?.trim() || user.name;
}

function getInitial(user: Pick<User, "name" | "fio">): string {
  return getDisplayName(user).charAt(0).toUpperCase();
}

function AddUserDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { mutateAsync, isPending } = useCreateUser();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateManagerFormValues>({
    resolver: zodResolver(createManagerSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      fio: "",
      mangoUserId: "",
    },
  });

  const onSubmit = async (data: CreateManagerFormValues): Promise<void> => {
    try {
      const fio = (data.fio ?? "").trim();
      const mangoRaw = (data.mangoUserId ?? "").trim();

      await mutateAsync({
        name: data.name,
        email: data.email,
        password: data.password,
        role: "manager",
        fio: fio ? fio : null,
        mangoUserId: mangoRaw ? Number(mangoRaw) : null,
      });

      reset();
      onClose();
    } catch {
      // toast handled in hook
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          reset();
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Добавить менеджера</DialogTitle>
        </DialogHeader>

        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="flex flex-col gap-4 pt-2"
        >
          <Field label="Имя" htmlFor="name" error={errors.name?.message}>
            <Input
              id="name"
              placeholder="manager01"
              {...register("name")}
              hasError={!!errors.name}
            />
          </Field>

          <Field label="ФИО" htmlFor="fio">
            <Input
              id="fio"
              placeholder="Иванов Алексей Петрович"
              {...register("fio")}
            />
          </Field>

          <Field label="Email" htmlFor="email" error={errors.email?.message}>
            <Input
              id="email"
              type="email"
              placeholder="manager@example.com"
              {...register("email")}
              hasError={!!errors.email}
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
              {...register("mangoUserId", {
                validate: (value) =>
                  !(value ?? "").trim() ||
                  /^\d+$/.test((value ?? "").trim()) ||
                  "Введите числовой Mango ID",
              })}
              hasError={!!errors.mangoUserId}
            />
          </Field>

          <Field
            label="Пароль"
            htmlFor="password"
            error={errors.password?.message}
          >
            <PasswordInput
              id="password"
              placeholder="Минимум 6 символов"
              {...register("password")}
              hasError={!!errors.password}
            />
          </Field>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                reset();
                onClose();
              }}
            >
              Отмена
            </Button>

            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <>
                  <UserPlus className="size-4" /> Добавить
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function UsersPage() {
  const { user: currentUser } = useOutletContext<{ user: User }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: allUsers = [], isPending } = useUsers();
  const users = allUsers.filter((user) => user.id !== currentUser.id);

  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ field: SortField; dir: SortDir }>({
    field: "name",
    dir: "asc",
  });
  const [addOpen, setAddOpen] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<MangoDirectoryCandidate | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const { refetch: refetchCandidates } = useQuery({
    queryKey: MANGO_CANDIDATES_KEY,
    queryFn: () => mangoApi.getUsersCandidates(),
    enabled: false,
  });

  const createLocalUserMutation = useMutation({
    mutationFn: async ({ candidate, values }: { candidate: MangoDirectoryCandidate; values: CreateLocalUserFormValues }) => {
      const draft = candidate.createLocalUserDraft;
      return usersApi.createFromMango({
        name: values.name.trim(),
        fio: values.fio?.trim() || null,
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
      toast.success("Пользователь создан. Пароль по умолчанию: Mango User ID");
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Не удалось создать пользователя из Mango"));
    },
  });

  const bulkImportMutation = useMutation({
    mutationFn: async () => {
      const response = await mangoApi.getUsersCandidates();
      const candidates = (response?.items ?? []).filter((c) => c.linkedUserId == null);
      let created = 0, skipped = 0, failed = 0;

      for (const candidate of candidates) {
        const draft = candidate.createLocalUserDraft;
        try {
          await usersApi.createFromMango({
            name: draft.name.trim(),
            fio: draft.fio?.trim() || null,
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
          created++;
        } catch (error) {
          const msg = getApiErrorMessage(error, "").toLowerCase();
          if (msg.includes("already in use") || msg.includes("уже используется") || msg.includes("уже существует")) {
            skipped++;
          } else {
            failed++;
          }
        }
      }

      return { created, skipped, failed };
    },
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: USERS_KEY }),
        queryClient.invalidateQueries({ queryKey: MANGO_CANDIDATES_KEY }),
      ]);
      const summary = `Создано: ${result.created} · Пропущено: ${result.skipped} · Ошибок: ${result.failed}`;
      result.failed > 0 ? toast.error(summary) : toast.success(summary);
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Не удалось импортировать пользователей из Mango"));
    },
  });

  const searchItems = useMemo<UserSearchItem[]>(
    () =>
      users.map((user) => ({
        ...user,
        displayName: getDisplayName(user),
        searchFio: user.fio ?? "",
        searchMangoUserId:
          user.mangoUserId != null ? String(user.mangoUserId) : "",
      })),
    [users],
  );

  const fuse = useMemo(
    () =>
      new Fuse(searchItems, {
        keys: USER_SEARCH_KEYS,
        threshold: 0.4,
        ignoreLocation: true,
        minMatchCharLength: 2,
      }),
    [searchItems],
  );

  const filtered = useMemo(() => {
    const query = search.trim();

    let list =
      query.length < 2
        ? searchItems
        : fuse.search(query).map((result) => result.item);

    list = [...list].sort((a, b) => {
      const dir = sort.dir === "asc" ? 1 : -1;

      if (sort.field === "name") {
        return dir * getDisplayName(a).localeCompare(getDisplayName(b), "ru");
      }

      return dir * a.email.localeCompare(b.email, "ru");
    });

    return list;
  }, [fuse, search, searchItems, sort]);

  const { page, totalPages, pageItems, setPage } = usePagination(filtered);

  const toggleSort = (field: SortField) => {
    setSort((prev) =>
      prev.field === field
        ? { field, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { field, dir: "asc" },
    );
  };

  const SortIcon = ({ field }: { field: SortField }) => (
    <ArrowUpDown
      className={cn(
        "ml-1 inline size-3",
        sort.field === field
          ? "text-neutral-800 dark:text-neutral-200"
          : "text-neutral-300",
      )}
    />
  );

  return (
    <div>
      <PageHeader
        title="Пользователи"
        description="Управление менеджерами платформы"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1">
              <div className="group relative">
                <Info className="size-4 cursor-default text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300" />
                <div className="pointer-events-none absolute left-0 top-6 z-50 w-64 rounded-lg border border-neutral-200 bg-white p-3 text-xs text-neutral-600 opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                  У импортированных пользователей пароль по умолчанию равен его Mango ID. Его нужно обязательно изменить.
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void bulkImportMutation.mutateAsync()}
                disabled={bulkImportMutation.isPending}
                className="gap-1.5"
              >
                {bulkImportMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Wand2 className="size-4" />
                )}
                Импортировать из Mango
              </Button>
            </div>
            <Button
              onClick={() => setAddOpen(true)}
              size="sm"
              className="gap-1.5"
            >
              <Plus className="size-4" />
              Добавить менеджера
            </Button>
          </div>
        }
      />

      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-neutral-400" />
        <Input
          placeholder="Поиск по имени, ФИО, email или Mango ID…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-700">
        <Table>
          <TableHeader>
            <TableRow className="bg-neutral-50/80 dark:bg-neutral-900/80">
              <TableHead
                className="cursor-pointer"
                onClick={() => toggleSort("name")}
              >
                Имя <SortIcon field="name" />
              </TableHead>
              <TableHead
                className="cursor-pointer"
                onClick={() => toggleSort("email")}
              >
                Email <SortIcon field="email" />
              </TableHead>
              <TableHead>Mango ID</TableHead>
              <TableHead>Роль</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {isPending ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Skeleton className="size-8 rounded-full shrink-0" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-40" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-16" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <Users className="size-8 text-neutral-300" />
                    <p className="text-sm text-neutral-500">
                      {search ? "Пользователи не найдены" : "Нет пользователей"}
                    </p>
                    {!search && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-1"
                        onClick={() => setAddOpen(true)}
                      >
                        <Plus className="size-3.5" />
                        Добавить первого менеджера
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              pageItems.map((user) => {
                const displayName = getDisplayName(user);

                return (
                  <TableRow
                    key={user.id}
                    className="cursor-pointer hover:bg-neutral-50/60 dark:hover:bg-neutral-900/40"
                    onClick={() => navigate(`/users/${user.id}`)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-sm font-semibold text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                          {getInitial(user)}
                        </div>
                        <div className="min-w-0">
                          <span className="block truncate font-medium">
                            {displayName}
                          </span>
                          {user.fio && user.fio !== user.name && (
                            <span className="block truncate text-xs text-neutral-400">
                              Логин: {user.name}
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>

                    <TableCell className="text-neutral-500">
                      {user.email}
                    </TableCell>

                    <TableCell className="text-neutral-500">
                      {user.mangoUserId ?? "—"}
                    </TableCell>

                    <TableCell>
                      <Badge variant="secondary" className="text-xs">
                        {user.role === "director" ? "Директор" : "Менеджер"}
                      </Badge>
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
          {filtered.length} из {users.length} пользователей
        </p>
        <Pagination
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      </div>

      <AddUserDialog open={addOpen} onClose={() => setAddOpen(false)} />

      <CreateLocalUserDialog
        open={createOpen}
        candidate={selectedCandidate}
        onClose={() => {
          setCreateOpen(false);
          setSelectedCandidate(null);
        }}
        onSubmit={async (values) => {
          if (!selectedCandidate) return;
          await createLocalUserMutation.mutateAsync({ candidate: selectedCandidate, values });
        }}
        isPending={createLocalUserMutation.isPending}
      />
    </div>
  );
}
