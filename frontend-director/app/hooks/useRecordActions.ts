import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  recordsApi,
  type UploadRecordPayload,
  type UploadRecordResponse,
} from "~/axios/records";
import { getApiErrorMessage } from "~/lib/api-error";
import type { Record } from "~/types/record";

export const RECORDS_ADMIN_FEED_KEY = ["records", "admin-feed"] as const;

export function recordByIdKey(id: number | null | undefined) {
  return ["records", "by-id", id] as const;
}

export function recordByMangoEntryKey(entryId: string | null | undefined) {
  return ["records", "by-mango-entry", entryId] as const;
}

export function useRecordById(id: number | null | undefined) {
  return useQuery({
    queryKey: recordByIdKey(id),
    queryFn: () => recordsApi.getById(id as number),
    enabled: typeof id === "number" && Number.isFinite(id),
  });
}

export function useRecordByMangoEntry(entryId: string | null | undefined) {
  return useQuery({
    queryKey: recordByMangoEntryKey(entryId),
    queryFn: () => recordsApi.getByMangoEntry(entryId as string),
    enabled: typeof entryId === "string" && entryId.trim().length > 0,
  });
}

export function useUploadRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: UploadRecordPayload): Promise<UploadRecordResponse> =>
      recordsApi.upload(payload),
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: RECORDS_ADMIN_FEED_KEY }),
        queryClient.invalidateQueries({ queryKey: recordByIdKey(result.id) }),
      ]);

      toast.success("Запись загружена и поставлена в обработку");
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Не удалось загрузить запись"));
    },
  });
}

export async function pollRecordUntilFinished(
  id: number,
  options?: {
    intervalMs?: number;
    timeoutMs?: number;
  },
): Promise<Record> {
  const intervalMs = options?.intervalMs ?? 2500;
  const timeoutMs = options?.timeoutMs ?? 120000;
  const startedAt = Date.now();

  while (true) {
    const record = await recordsApi.getById(id);

    if (
      record.status === "done" ||
      record.status === "failed" ||
      record.status === "not_applicable"
    ) {
      return record;
    }

    if (Date.now() - startedAt >= timeoutMs) {
      throw new Error("Record polling timed out");
    }

    await new Promise((resolve) => window.setTimeout(resolve, intervalMs));
  }
}
