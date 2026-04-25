import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { usersApi, type CreateUserPayload } from "~/axios/users"

const USERS_KEY = ["users"]

export function useUsers() {
    return useQuery({
        queryKey: USERS_KEY,
        queryFn: () => usersApi.getAll(),
    })
}

export function useCreateUser() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (payload: CreateUserPayload) => usersApi.create(payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: USERS_KEY })
            toast.success("Менеджер добавлен")
        },
        onError: () => {
            toast.error("Не удалось добавить менеджера")
        },
    })
}
