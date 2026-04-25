import { forwardRef, type InputHTMLAttributes } from "react"
import { cn } from "~/lib/cn"

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    hasError?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
    ({ hasError, className, ...rest }, ref) => {
        return (
            <input
                ref={ref}
                className={cn(
                    "h-10 w-full rounded-lg border bg-white px-3 text-sm text-neutral-900 placeholder:text-neutral-400 transition-colors",
                    "dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder:text-neutral-500",
                    hasError
                        ? "border-red-500"
                        : "border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700",
                    "focus:outline-none focus:border-[color:var(--color-accent)]",
                    className,
                )}
                {...rest}
            />
        )
    },
)
Input.displayName = "Input"
