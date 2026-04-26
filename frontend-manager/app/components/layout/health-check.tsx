import { useQuery } from "@tanstack/react-query";
import { healthApi } from "~/axios/health";
import { cn } from "~/lib/utils";

export function HealthCheck() {
  const { data: health, isError: queryError } = useQuery({
    queryKey: ["health"],
    queryFn: healthApi.check,
    refetchInterval: 30_000,
    retry: false,
  });

  const isOk = health?.status === "ok" && !queryError;

  return (
    <div
      className="flex items-center justify-center size-8 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-help"
      title={isOk ? "Сервер работает" : "Сервер недоступен"}
    >
      <div
        className={cn(
          "size-2.5 rounded-full",
          isOk
            ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"
            : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]",
        )}
      />
    </div>
  );
}
