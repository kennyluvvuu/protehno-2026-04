import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowUpDown, Loader2, Plus, Search, Trash2, UserPlus, Users } from "lucide-react"
import { useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "~/components/ui/alert-dialog"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "~/components/ui/dialog"
import { Field } from "~/components/ui/field"
import { Input } from "~/components/ui/input"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "~/components/ui/table"
import { useCreateUser, useDeleteUser, useUsers } from "~/hooks/useUsers"
import { createUserSchema, type CreateUserSchema } from "~/schemas/user"
import type { User } from "~/types/auth"
import { cn } from "~/lib/utils"
import { PageHeader } from "~/components/layout"

type SortField = "name" | "email"
type SortDir = "asc" | "desc"

function AddUserDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
    const { mutateAsync, isPending } = useCreateUser()

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm<CreateUserSchema>({
        resolver: zodResolver(createUserSchema),
        defaultValues: { name: "", email: "", password: "" },
    })

    const onSubmit = async (data: CreateUserSchema): Promise<void> => {
        try {
            await mutateAsync(data)
            reset()
            onClose()
        } catch {
            // toast shown in hook
        }
    }

    return (
        <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onClose() } }}>
            <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                    <DialogTitle>Добавить менеджера</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4 pt-2">
                    <Field label="Имя" htmlFor="name" error={errors.name?.message}>
                        <Input id="name" placeholder="Иванов Алексей" {...register("name")} hasError={!!errors.name} />
                    </Field>
                    <Field label="Email" htmlFor="email" error={errors.email?.message}>
                        <Input id="email" type="email" placeholder="manager@example.com" {...register("email")} hasError={!!errors.email} />
                    </Field>
                    <Field label="Пароль" htmlFor="password" error={errors.password?.message}>
                        <Input id="password" type="password" placeholder="Минимум 6 символов" {...register("password")} hasError={!!errors.password} />
                    </Field>
                    <div className="flex justify-end gap-2 pt-2">
                        <Button type="button" variant="ghost" onClick={() => { reset(); onClose() }}>
                            Отмена
                        </Button>
                        <Button type="submit" disabled={isPending}>
                            {isPending ? <Loader2 className="size-4 animate-spin" /> : <><UserPlus className="size-4" /> Добавить</>}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}

function DeleteConfirm({
    user,
    open,
    onClose,
}: {
    user: User | null
    open: boolean
    onClose: () => void
}) {
    const { mutateAsync, isPending } = useDeleteUser()

    const handleDelete = async (): Promise<void> => {
        if (!user) return
        try {
            await mutateAsync(user.id)
        } finally {
            onClose()
        }
    }

    return (
        <AlertDialog open={open} onOpenChange={(v) => !v && onClose()}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Удалить пользователя?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Пользователь <strong>{user?.name}</strong> ({user?.email}) будет удалён без возможности восстановления.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Отмена</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={handleDelete}
                        disabled={isPending}
                        className="bg-red-600 text-white hover:bg-red-700"
                    >
                        {isPending ? "Удаляем…" : "Удалить"}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}

export default function UsersPage() {
    const { data: users = [], isLoading } = useUsers()
    const [search, setSearch] = useState("")
    const [sort, setSort] = useState<{ field: SortField; dir: SortDir }>({ field: "name", dir: "asc" })
    const [addOpen, setAddOpen] = useState(false)
    const [deleteTarget, setDeleteTarget] = useState<User | null>(null)

    const filtered = useMemo(() => {
        const q = search.toLowerCase()
        let list = users.filter(
            (u) => !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
        )
        list = [...list].sort((a, b) => {
            const dir = sort.dir === "asc" ? 1 : -1
            if (sort.field === "name") return dir * a.name.localeCompare(b.name)
            return dir * a.email.localeCompare(b.email)
        })
        return list
    }, [users, search, sort])

    const toggleSort = (field: SortField) => {
        setSort((prev) =>
            prev.field === field
                ? { field, dir: prev.dir === "asc" ? "desc" : "asc" }
                : { field, dir: "asc" },
        )
    }

    const SortIcon = ({ field }: { field: SortField }) => (
        <ArrowUpDown
            className={cn(
                "ml-1 size-3 inline",
                sort.field === field ? "text-neutral-800 dark:text-neutral-200" : "text-neutral-300",
            )}
        />
    )

    return (
        <div>
            <PageHeader
                title="Пользователи"
                description="Управление менеджерами платформы"
                actions={
                    <Button onClick={() => setAddOpen(true)} size="sm" className="gap-1.5">
                        <Plus className="size-4" />
                        Добавить менеджера
                    </Button>
                }
            />

            {/* Search */}
            <div className="mb-4 relative max-w-sm">
                <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-neutral-400" />
                <Input
                    placeholder="Поиск по имени или email…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                />
            </div>

            {/* Table */}
            <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-neutral-50/80 dark:bg-neutral-900/80">
                            <TableHead className="cursor-pointer" onClick={() => toggleSort("name")}>
                                Имя <SortIcon field="name" />
                            </TableHead>
                            <TableHead className="cursor-pointer" onClick={() => toggleSort("email")}>
                                Email <SortIcon field="email" />
                            </TableHead>
                            <TableHead>Роль</TableHead>
                            <TableHead className="text-right">Действия</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={4} className="py-16 text-center">
                                    <Loader2 className="mx-auto size-6 animate-spin text-neutral-400" />
                                </TableCell>
                            </TableRow>
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
                            filtered.map((user) => (
                                <TableRow key={user.id} className="hover:bg-neutral-50/60 dark:hover:bg-neutral-900/40">
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-sm font-semibold text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                                                {user.name.charAt(0).toUpperCase()}
                                            </div>
                                            <span className="font-medium">{user.name}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-neutral-500">{user.email}</TableCell>
                                    <TableCell>
                                        <Badge variant="secondary" className="text-xs">
                                            Менеджер
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <button
                                            type="button"
                                            onClick={() => setDeleteTarget(user)}
                                            className="inline-flex size-8 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950 dark:hover:text-red-400"
                                            aria-label="Удалить пользователя"
                                        >
                                            <Trash2 className="size-3.5" />
                                        </button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <p className="mt-2 text-xs text-neutral-400">
                {filtered.length} из {users.length} пользователей
            </p>

            <AddUserDialog open={addOpen} onClose={() => setAddOpen(false)} />
            <DeleteConfirm
                user={deleteTarget}
                open={!!deleteTarget}
                onClose={() => setDeleteTarget(null)}
            />
        </div>
    )
}
