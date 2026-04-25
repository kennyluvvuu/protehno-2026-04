import { useState } from "react"
import { Outlet, redirect } from "react-router"
import { LayoutHeader, Sidebar } from "~/components/layout"
import { QueryClientProvider } from "@tanstack/react-query"
import { queryClient } from "~/lib/query-client"
import type { User } from "~/types/auth"
import { authApi } from "~/axios/auth"
import type { Route } from "./+types/_protected"

export async function loader({ request }: Route.LoaderArgs) {
    try {
        const cookie = request.headers.get("cookie") ?? undefined
        const user = await authApi.me(cookie)
        if (!user.role.includes("manager")) throw new Error("forbidden")
        return { user }
    } catch {
        throw redirect("/login")
    }
}

export default function ProtectedLayout({ loaderData }: Route.ComponentProps) {
    const { user } = loaderData
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

    return (
        <QueryClientProvider client={queryClient}>
            <div className="flex h-dvh bg-background">
                <Sidebar user={user as User} isCollapsed={isSidebarCollapsed} />
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
    )
}
