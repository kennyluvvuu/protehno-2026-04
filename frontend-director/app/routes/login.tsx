import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { useNavigate, useRevalidator } from "react-router"
import { toast } from "sonner"
import { authApi } from "~/axios/auth"
import { AuthShell } from "~/components/layout"
import { Button } from "~/components/ui/button"
import { Field } from "~/components/ui/field"
import { Input } from "~/components/ui/input"
import { loginSchema, type LoginSchema } from "~/schemas/auth"
import { useAuthStore } from "~/stores/useAuthStore"

export default function Login() {
    const navigate = useNavigate()
    const { revalidate } = useRevalidator()
    const setUser = useAuthStore((s) => s.setUser)

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<LoginSchema>({
        mode: "onTouched",
        resolver: zodResolver(loginSchema),
        defaultValues: { email: "", password: "" },
    })

    const onSubmit = async (data: LoginSchema): Promise<void> => {
        try {
            const user = await authApi.login(data)
            setUser(user)
            toast.success("Добро пожаловать")
            await revalidate()
            navigate("/", { replace: true })
        } catch {
            toast.error("Неверный email или пароль")
        }
    }

    return (
        <AuthShell
            title="Вход в систему"
            subtitle="Введите данные директорского аккаунта"
        >
            <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
                <Field label="Email" htmlFor="email" error={errors.email?.message}>
                    <Input
                        id="email"
                        type="email"
                        placeholder="director@example.com"
                        autoComplete="email"
                        hasError={!!errors.email}
                        {...register("email")}
                    />
                </Field>

                <Field label="Пароль" htmlFor="password" error={errors.password?.message}>
                    <Input
                        id="password"
                        type="password"
                        placeholder="••••••••"
                        autoComplete="current-password"
                        hasError={!!errors.password}
                        {...register("password")}
                    />
                </Field>

                <Button type="submit" disabled={isSubmitting} className="mt-2 w-full">
                    {isSubmitting ? "Входим…" : "Войти"}
                </Button>
            </form>
        </AuthShell>
    )
}
