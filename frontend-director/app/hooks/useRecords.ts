import { useQuery } from "@tanstack/react-query"
import { recordsApi } from "~/axios/records"

export const RECORDS_KEY = ["records", "feed"]

export function useRecords() {
    return useQuery({
        queryKey: RECORDS_KEY,
        queryFn: () => recordsApi.getFeed(),
    })
}
