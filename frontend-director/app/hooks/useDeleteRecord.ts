import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { RECORDS_KEY } from "~/hooks/useRecords";
import { getApiErrorMessage } from "~/lib/api-error";
import { api } from "~/lib/axios-client";
import { assertRequestCooldown } from "~/lib/request-guard";

interface DeleteRecordPayload {
  id: number;
}

interface DeleteRecordResponse {
  message: string;
}

async function deleteRecord(id: number): Promise<DeleteRecordResponse> {
  assertRequestCooldown(`records:delete:${id}`, 800);
  const { data } = await api.delete<DeleteRecordResponse>(`/records/${id}`);
  return data;
}

export function useDeleteRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id }: DeleteRecordPayload) => deleteRecord(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: RECORDS_KEY });
      toast.success("Запись удалена");
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Не удалось удалить запись"));
    },
  });
}
