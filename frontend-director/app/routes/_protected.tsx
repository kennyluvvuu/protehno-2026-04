import { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { LayoutHeader, Sidebar } from "~/components/layout";
import { queryClient } from "~/lib/query-client";
import { authApi } from "~/axios/auth";
import { useAuthStore } from "~/stores/useAuthStore";
import type { User } from "~/types/auth";
import type { Route } from "./+types/_protected";

const FALLBACK_USER: User = {
  id: 0,
  name: "director",
  fio: "Директор",
  email: "director@example.com",
  role: "director",
  mangoUserId: null,
};

export function shouldRevalidate() {
  return false;
}

export async function loader(_: Route.LoaderArgs) {
  return { user: FALLBACK_USER };
}

export default function ProtectedLayout({ loaderData }: Route.ComponentProps) {
  const navigate = useNavigate();
  const storeUser = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const resetUser = useAuthStore((state) => state.reset);

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  const user = storeUser ?? loaderData.user ?? FALLBACK_USER;

  useEffect(() => {
    let isActive = true;

    const checkAuth = async () => {
      try {
        const currentUser = await authApi.me();
        if (!isActive) return;

        if (currentUser.role !== "director") {
          resetUser();
          navigate("/login", { replace: true });
          return;
        }

        setUser(currentUser);
      } catch {
        if (!isActive) return;
        resetUser();
        navigate("/login", { replace: true });
        return;
      } finally {
        if (isActive) {
          setIsCheckingAuth(false);
        }
      }
    };

    void checkAuth();

    return () => {
      isActive = false;
    };
  }, [navigate, resetUser, setUser]);

  if (isCheckingAuth) {
    return (
      <QueryClientProvider client={queryClient}>
        <div className="flex min-h-dvh items-center justify-center bg-background p-6">
          <div className="text-center">
            <p className="text-sm text-neutral-500">Проверяем авторизацию…</p>
          </div>
        </div>
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex h-dvh bg-background">
        <Sidebar user={user} isCollapsed={isSidebarCollapsed} />
        <div className="flex min-h-0 h-dvh flex-1 flex-col overflow-hidden">
          <LayoutHeader
            isSidebarCollapsed={isSidebarCollapsed}
            onToggleSidebar={() => setIsSidebarCollapsed((prev) => !prev)}
          />
          <main className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-7xl px-4 py-6">
              <Outlet context={{ user }} />
            </div>
          </main>
        </div>
      </div>
    </QueryClientProvider>
  );
}
