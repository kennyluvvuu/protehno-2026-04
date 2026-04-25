import { forwardRef, type InputHTMLAttributes } from "react"
import { cn } from "~/lib/utils"

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    hasError?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
    ({ hasError, className, ...rest }, ref) => {
        return (
            <input
                ref={ref}
                className={cn(
                    "h-10 w-full rounded-lg border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground transition-colors",
                    hasError
                        ? "border-red-500"
                        : "border-input hover:border-neutral-300 dark:hover:border-neutral-600",
                    "focus:outline-none focus:border-[color:var(--color-brand-accent)]",
                    className,
                )}
                {...rest}
            />
        )
    },
)
Input.displayName = "Input"
