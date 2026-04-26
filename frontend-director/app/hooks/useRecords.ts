import { useQuery } from "@tanstack/react-query";
import { recordsApi } from "~/axios/records";
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
