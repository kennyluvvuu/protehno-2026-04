import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useState } from "react";
import { NotificationsBell } from "~/components/layout/notifications";
import { SearchModal } from "~/components/layout/search-modal";
import { Button } from "~/components/ui/button";
import { HealthCheck } from "~/components/layout/health-check";

interface LayoutHeaderProps {
  isSidebarCollapsed: boolean;
  onToggleSidebar: () => void;
}

export function LayoutHeader({
  isSidebarCollapsed,
  onToggleSidebar,
}: LayoutHeaderProps): React.ReactElement {
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex h-14 items-center justify-between pl-1 pr-6">
        <div className="flex flex-1 items-center">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onToggleSidebar}
            aria-label={
              isSidebarCollapsed
                ? "Развернуть боковую панель"
                : "Свернуть боковую панель"
            }
          >
            {isSidebarCollapsed ? (
              <ChevronRight className="size-4" />
            ) : (
              <ChevronLeft className="size-4" />
            )}
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsSearchOpen(true)}
            className="cursor-pointer flex h-9 w-80 max-w-[50vw] items-center gap-2 rounded-lg border border-input bg-background px-3 text-sm text-muted-foreground transition-colors hover:border-neutral-300 dark:hover:border-neutral-600"
            aria-label="Открыть поиск"
          >
            <Search className="size-3.5" />
            <span className="truncate">Поиск по звонкам и пользователям</span>
          </button>

          <NotificationsBell />
        </div>

        <div className="flex flex-1 items-center justify-end">
          <HealthCheck />
        </div>
      </div>

      <SearchModal open={isSearchOpen} onOpenChange={setIsSearchOpen} />
    </header>
  );
}
