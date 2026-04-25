import { Outlet, redirect } from "react-router"
import type { Route } from "./+types/_protected"
import { api } from "~/lib/axios-client"
import type { UserData } from "~/types/auth"

export async function loader({ request }: Route.LoaderArgs) {
    try {
        const { data } = await api.get<UserData>("/auth/me", {
            headers: { cookie: request.headers.get("cookie") ?? "" },
        })
        return { user: data }
    } catch {
        throw redirect(`/login`)
    }
}

export default function ProtectedLayout() {
    return (
        <div className="min-h-dvh">
            <main className="container mx-auto">
                <Outlet />
            </main>
        </div>
    )
}
