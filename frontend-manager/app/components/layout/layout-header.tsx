import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "~/components/ui/button"

interface LayoutHeaderProps {
    isSidebarCollapsed: boolean
    onToggleSidebar: () => void
}

export function LayoutHeader({ isSidebarCollapsed, onToggleSidebar }: LayoutHeaderProps): React.ReactElement {
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
            </div>
        </header>
    )
}
