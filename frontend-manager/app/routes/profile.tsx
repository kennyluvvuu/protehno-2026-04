import { useRouteLoaderData } from "react-router"
import { PageHeader } from "~/components/layout"
import type { User } from "~/types/auth"

export default function Profile() {
    const data = useRouteLoaderData("routes/_protected") as
        | { user: User }
        | undefined
    const user = data?.user

    if (!user) return null

    const fields = [
        { label: "Имя", value: user.name },
        { label: "Email", value: user.email },
        { label: "ID", value: `#${user.id}` },
    ]

    return (
        <>
            <PageHeader
                title="Профиль"
                description="Информация об аккаунте"
            />

            <div className="flex items-center gap-4 pb-8">
                <div className="flex size-16 items-center justify-center rounded-full bg-[color:var(--color-accent-soft)] text-xl font-semibold text-[color:var(--color-accent)] dark:bg-neutral-900">
                    {user.name.charAt(0).toUpperCase()}
                </div>
                <div>
                    <p className="text-lg font-semibold">{user.name}</p>
                    <p className="text-sm text-neutral-500">{user.email}</p>
                </div>
            </div>

            <dl className="divide-y divide-neutral-200 rounded-xl border border-neutral-200 dark:divide-neutral-900 dark:border-neutral-900">
                {fields.map(({ label, value }) => (
                    <div
                        key={label}
                        className="grid grid-cols-[140px_1fr] gap-4 px-5 py-4"
                    >
                        <dt className="text-sm text-neutral-500">{label}</dt>
                        <dd className="text-sm font-medium">{value}</dd>
                    </div>
                ))}
            </dl>
        </>
    )
}
