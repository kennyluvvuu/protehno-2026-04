import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { usersApi, type CreateUserPayload } from "~/axios/users";
import { getApiErrorMessage } from "~/lib/api-error";
import type { User } from "~/types/auth";

export const USERS_KEY = ["users"] as const;

export interface UpdateUserPayload {
  id: number;
  data: {
    name?: string;
    fio?: string | null;
    email?: string;
    mangoUserId?: number | null;
    role?: "director" | "manager";
  };
}

export interface DeleteUserPayload {
  id: number;
}

export interface SetOwnMangoUserIdPayload {
  mangoUserId: number | null;
}

export function useUsers() {
  return useQuery({
    queryKey: USERS_KEY,
    queryFn: () => usersApi.getAll(),
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateUserPayload) => usersApi.create(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: USERS_KEY });
      toast.success("Менеджер добавлен");
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Не удалось добавить менеджера"));
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: UpdateUserPayload) => usersApi.update(id, data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: USERS_KEY });
      toast.success("Пользователь обновлён");
    },
    onError: (error) => {
      toast.error(
        getApiErrorMessage(error, "Не удалось обновить пользователя"),
      );
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id }: DeleteUserPayload) => usersApi.remove(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: USERS_KEY });
      toast.success("Пользователь удалён");
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Не удалось удалить пользователя"));
    },
  });
}

export function useSetOwnMangoUserId() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ mangoUserId }: SetOwnMangoUserIdPayload) =>
      usersApi.setOwnMangoUserId(mangoUserId),
    onSuccess: async (user: User) => {
      await queryClient.invalidateQueries({ queryKey: USERS_KEY });
      toast.success(
        user.mangoUserId == null
          ? "Mango ID отвязан"
          : "Mango ID успешно сохранён",
      );
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Не удалось сохранить Mango ID"));
    },
  });
}
