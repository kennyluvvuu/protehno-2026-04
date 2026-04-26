import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "~/lib/cn"

interface PaginationProps {
    page: number
    totalPages: number
    onPageChange: (page: number) => void
    className?: string
}

export function Pagination({ page, totalPages, onPageChange, className }: PaginationProps): React.ReactElement | null {
    if (totalPages <= 1) return null

    const pages: (number | "…")[] = []

    if (totalPages <= 7) {
        for (let i = 1; i <= totalPages; i++) pages.push(i)
    } else {
        pages.push(1)
        if (page > 3) pages.push("…")
        for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i)
        if (page < totalPages - 2) pages.push("…")
        pages.push(totalPages)
    }

    return (
        <div className={cn("flex items-center gap-1", className)}>
            <button
                type="button"
                onClick={() => onPageChange(page - 1)}
                disabled={page === 1}
                className="cursor-pointer flex size-8 items-center justify-center rounded-md border border-neutral-200 text-neutral-500 transition-colors hover:bg-neutral-50 disabled:pointer-events-none disabled:opacity-40 dark:border-neutral-700 dark:hover:bg-neutral-800"
            >
                <ChevronLeft className="size-3.5" />
            </button>

            {pages.map((p, i) =>
                p === "…" ? (
                    <span key={`ellipsis-${i}`} className="flex size-8 items-center justify-center text-xs text-neutral-400">
                        …
                    </span>
                ) : (
                    <button
                        key={p}
                        type="button"
                        onClick={() => onPageChange(p)}
                        className={cn(
                            "cursor-pointer flex size-8 items-center justify-center rounded-md border text-xs font-medium transition-colors",
                            p === page
                                ? "border-neutral-800 bg-neutral-800 text-white dark:border-neutral-200 dark:bg-neutral-200 dark:text-neutral-900"
                                : "border-neutral-200 text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800",
                        )}
                    >
                        {p}
                    </button>
                ),
            )}

            <button
                type="button"
                onClick={() => onPageChange(page + 1)}
                disabled={page === totalPages}
                className="cursor-pointer flex size-8 items-center justify-center rounded-md border border-neutral-200 text-neutral-500 transition-colors hover:bg-neutral-50 disabled:pointer-events-none disabled:opacity-40 dark:border-neutral-700 dark:hover:bg-neutral-800"
            >
                <ChevronRight className="size-3.5" />
            </button>
        </div>
    )
}
