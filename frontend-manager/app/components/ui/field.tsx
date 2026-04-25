import type { ReactNode } from "react"
import { Label } from "./label"

interface FieldProps {
    label: string
    htmlFor: string
    error?: string
    children: ReactNode
}

export function Field({
    label,
    htmlFor,
    error,
    children,
}: FieldProps): React.ReactElement {
    return (
        <div className="flex flex-col gap-1.5">
            <Label htmlFor={htmlFor}>{label}</Label>
            {children}
            {error && (
                <span role="alert" className="text-xs text-red-500">
                    {error}
                </span>
            )}
        </div>
    )
}
