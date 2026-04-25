import { CheckCircle2, XCircle } from "lucide-react";
import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  healthStatus?: "ok" | "error";
}

export function PageHeader({
  title,
  description,
  actions,
  healthStatus,
}: PageHeaderProps): React.ReactElement {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-neutral-500">{description}</p>
        )}
      </div>
      {(healthStatus || actions) && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {healthStatus === "ok" && (
            <div className="inline-flex items-center gap-1.5 rounded-md border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 dark:border-green-700 dark:bg-green-950/35 dark:text-green-300">
              <CheckCircle2 className="size-3" />
              Сервер работает
            </div>
          )}
          {healthStatus === "error" && (
            <div className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 dark:border-red-700 dark:bg-red-950/35 dark:text-red-300">
              <XCircle className="size-3" />
              Сервер недоступен
            </div>
          )}
          {actions}
        </div>
      )}
    </header>
  );
}
