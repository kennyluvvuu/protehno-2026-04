import { QueryClient } from "@tanstack/react-query"
import { getHttpStatus, isRateLimitStatus } from "~/lib/api-error"

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 1000 * 30,
            gcTime: 1000 * 60 * 5,
            retry: (failureCount, error) => {
                const status = getHttpStatus(error)
                if (isRateLimitStatus(status)) return false
                if (status != null && status >= 400 && status < 500) return false
                return failureCount < 2
            },
            refetchOnWindowFocus: false,
        },
    },
})
