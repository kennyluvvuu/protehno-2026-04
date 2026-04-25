import { CheckCircle2, ChevronLeft, ChevronRight, Search, XCircle } from "lucide-react"
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { healthApi } from "~/axios/health"
import { NotificationsBell } from "~/components/layout/notifications"
import { SearchModal } from "~/components/layout/search-modal"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"

interface LayoutHeaderProps {
    isSidebarCollapsed: boolean
    onToggleSidebar: () => void
}

export function LayoutHeader({ isSidebarCollapsed, onToggleSidebar }: LayoutHeaderProps): React.ReactElement {
    const [isSearchOpen, setIsSearchOpen] = useState(false)
    const { data: health } = useQuery({
        queryKey: ["health"],
        queryFn: healthApi.check,
        refetchInterval: 30_000,
    })

    return (
        <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
            <div className="flex h-14 items-center pl-1 pr-6">
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={onToggleSidebar}
                    aria-label={isSidebarCollapsed ? "Развернуть боковую панель" : "Свернуть боковую панель"}
                >
                    {isSidebarCollapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
                </Button>

                <div className="ml-auto flex items-center gap-2">
                    {health?.status === "ok" ? (
                        <Badge variant="outline" className="gap-1.5 border-green-200 bg-green-50 text-green-700 dark:border-green-700 dark:bg-green-950/35 dark:text-green-300">
                            <CheckCircle2 className="size-3" />Сервер работает
                        </Badge>
                    ) : (
                        <Badge variant="outline" className="gap-1.5 border-red-200 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-950/35 dark:text-red-300">
                            <XCircle className="size-3" />Сервер недоступен
                        </Badge>
                    )}

                    <NotificationsBell />

                    <button
                        type="button"
                        onClick={() => setIsSearchOpen(true)}
                        className="flex h-9 w-80 max-w-[50vw] items-center gap-2 rounded-lg border border-input bg-background px-3 text-sm text-muted-foreground transition-colors hover:border-neutral-300 dark:hover:border-neutral-600"
                        aria-label="Открыть поиск"
                    >
                        <Search className="size-3.5" />
                        <span className="truncate">Поиск по звонкам и пользователям</span>
                    </button>
                </div>
            </div>

            <SearchModal open={isSearchOpen} onOpenChange={setIsSearchOpen} />
        </header>
    )
}
