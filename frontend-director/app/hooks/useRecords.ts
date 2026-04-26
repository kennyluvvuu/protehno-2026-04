import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { recordsApi } from "~/axios/records";
import { getApiErrorMessage } from "~/lib/api-error";
import type { Record } from "~/types/record";

export const RECORDS_KEY = ["records", "admin-feed"];

const ACTIVE_STATUSES = new Set(["uploaded", "queued", "processing"]);

function getRefetchInterval(data: Record[] | undefined): number {
  if (!data || data.length === 0) return 30_000;
  const hasActiveItems = data.some((record) => ACTIVE_STATUSES.has(record.status));
  return hasActiveItems ? 10_000 : 30_000;
}

export function useRecords() {
  return useQuery({
    queryKey: RECORDS_KEY,
    queryFn: () => recordsApi.getAdminFeed(),
    refetchInterval: (query) => getRefetchInterval(query.state.data as Record[] | undefined),
    refetchIntervalInBackground: false,
  });
}

export function useDeleteRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => recordsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RECORDS_KEY });
      toast.success("Запись удалена");
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, "Не удалось удалить запись"));
    },
  });
}
