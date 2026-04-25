import { useMemo, useState } from "react"

const PAGE_SIZE = 10

export interface PaginationResult<T> {
    page: number
    totalPages: number
    pageItems: T[]
    setPage: (page: number) => void
    reset: () => void
}

export function usePagination<T>(items: T[]): PaginationResult<T> {
    const [page, setPage] = useState(1)

    const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE))

    const safePage = Math.min(page, totalPages)

    const pageItems = useMemo(
        () => items.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
        [items, safePage],
    )

    const reset = () => setPage(1)

    return { page: safePage, totalPages, pageItems, setPage, reset }
}
