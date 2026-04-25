import type { ReactNode } from "react"

interface PageHeaderProps {
    title: string
    description?: string
    actions?: ReactNode
}

export function PageHeader({
    title,
    description,
    actions,
}: PageHeaderProps): React.ReactElement {
    return (
        <header className="mb-8 flex items-end justify-between gap-4">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
                {description && (
                    <p className="mt-1 text-sm text-neutral-500">{description}</p>
                )}
            </div>
            {actions}
        </header>
    )
}
