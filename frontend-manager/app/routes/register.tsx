import { zodResolver } from "@hookform/resolvers/zod"
import { isAxiosError } from "axios"
import { useForm } from "react-hook-form"
import { Link, useNavigate, useRevalidator } from "react-router"
import { toast } from "sonner"
import { authApi } from "~/axios/auth"
import { AuthShell } from "~/components/layout"
import { Button } from "~/components/ui/button"
import { Field } from "~/components/ui/field"
import { Input } from "~/components/ui/input"
import { registerSchema, type RegisterSchema } from "~/schemas/auth"
import { useAuthStore } from "~/stores/useAuthStore"

export default function Register() {
    const navigate = useNavigate()
    const { revalidate } = useRevalidator()
    const setUser = useAuthStore((s) => s.setUser)

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<RegisterSchema>({
        mode: "onTouched",
        resolver: zodResolver(registerSchema),
        defaultValues: { name: "", email: "", password: "" },
    })

    const onSubmit = async (data: RegisterSchema): Promise<void> => {
        try {
            await authApi.register(data)
            const user = await authApi.login({
                email: data.email,
                password: data.password,
            })
            setUser(user)
            toast.success("Регистрация успешна")
            await revalidate()
            navigate("/", { replace: true })
        } catch (error) {
            const message = isAxiosError(error)
                ? (error.response?.data as { message?: string } | undefined)?.message
                : undefined
            toast.error(message ?? "Не удалось зарегистрироваться")
        }
    }

    return (
        <AuthShell
            title="Регистрация"
            subtitle="Создайте аккаунт за минуту"
            footer={
                <>
                    Уже есть аккаунт?{" "}
                    <Link
                        to="/login"
                        className="font-medium text-[color:var(--color-accent)] hover:underline"
                    >
                        Войти
                    </Link>
                </>
            }
        >
            <form
                onSubmit={handleSubmit(onSubmit)}
                noValidate
                className="flex flex-col gap-4"
            >
                <Field label="Имя" htmlFor="name" error={errors.name?.message}>
                    <Input
                        id="name"
                        type="text"
                        placeholder="Ваше имя"
                        autoComplete="name"
                        hasError={!!errors.name}
                        {...register("name")}
                    />
                </Field>

                <Field label="Email" htmlFor="email" error={errors.email?.message}>
                    <Input
                        id="email"
                        type="email"
                        placeholder="you@example.com"
                        autoComplete="email"
                        hasError={!!errors.email}
                        {...register("email")}
                    />
                </Field>

                <Field
                    label="Пароль"
                    htmlFor="password"
                    error={errors.password?.message}
                >
                    <Input
                        id="password"
                        type="password"
                        placeholder="••••••••"
                        autoComplete="new-password"
                        hasError={!!errors.password}
                        {...register("password")}
                    />
                </Field>

                <Button type="submit" isLoading={isSubmitting} className="mt-2 w-full">
                    {isSubmitting ? "Создаём…" : "Создать аккаунт"}
                </Button>
            </form>
        </AuthShell>
    )
}
