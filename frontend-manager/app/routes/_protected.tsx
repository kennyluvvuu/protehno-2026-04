import { Outlet, redirect } from "react-router"
import type { Route } from "./+types/_protected"
import { authApi } from "~/axios/auth"
import { Sidebar } from "~/components/layout"

export async function loader({ request }: Route.LoaderArgs) {
    try {
        const user = await authApi.me(request.headers.get("cookie") ?? undefined)
        return { user }
    } catch {
        throw redirect("/login")
    }
}

export default function ProtectedLayout({ loaderData }: Route.ComponentProps) {
    return (
        <div className="flex min-h-dvh">
            <Sidebar user={loaderData.user} />
            <main className="flex-1 overflow-y-auto">
                <div className="mx-auto max-w-4xl px-8 py-10">
                    <Outlet />
                </div>
            </main>
        </div>
    )
}
