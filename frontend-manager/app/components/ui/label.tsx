import type { LabelHTMLAttributes } from "react"
import { cn } from "~/lib/cn"

export function Label({
    className,
    ...rest
}: LabelHTMLAttributes<HTMLLabelElement>): React.ReactElement {
    return (
        <label
            className={cn(
                "text-sm font-medium text-neutral-800 dark:text-neutral-200",
                className,
            )}
            {...rest}
        />
    )
}
