import type { ReactNode } from "react"

interface FieldProps {
    label: string
    htmlFor: string
    error?: string
    children: ReactNode
}

export function Field({ label, htmlFor, error, children }: FieldProps): React.ReactElement {
    return (
        <div className="flex flex-col gap-1.5">
            <label htmlFor={htmlFor} className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                {label}
            </label>
            {children}
            {error && (
                <span role="alert" className="text-xs text-red-500">
                    {error}
                </span>
            )}
        </div>
    )
}
