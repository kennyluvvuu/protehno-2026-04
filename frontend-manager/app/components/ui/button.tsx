import { forwardRef, type ButtonHTMLAttributes } from "react"
import { cn } from "~/lib/cn"

type Variant = "primary" | "ghost" | "outline"
type Size = "sm" | "md"

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: Variant
    size?: Size
    isLoading?: boolean
}

const base =
    "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors duration-150 disabled:opacity-50 disabled:pointer-events-none select-none"

const variants: Record<Variant, string> = {
    primary:
        "bg-[color:var(--color-accent)] text-white hover:bg-[color:var(--color-accent-hover)]",
    ghost:
        "text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800",
    outline:
        "border border-neutral-200 text-neutral-900 hover:bg-neutral-50 dark:border-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-900",
}

const sizes: Record<Size, string> = {
    sm: "h-9 px-3 text-sm",
    md: "h-10 px-4 text-sm",
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    (
        {
            variant = "primary",
            size = "md",
            isLoading,
            disabled,
            className,
            children,
            type = "button",
            ...rest
        },
        ref,
    ) => {
        return (
            <button
                ref={ref}
                type={type}
                disabled={disabled || isLoading}
                className={cn(base, variants[variant], sizes[size], className)}
                {...rest}
            >
                {isLoading ? "…" : children}
            </button>
        )
    },
)
Button.displayName = "Button"
