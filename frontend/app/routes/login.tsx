import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { useNavigate, useSearchParams } from "react-router"
import { toast } from "sonner"
import { authApi } from "~/axios/auth"
import { loginSchema, type LoginSchema } from "~/schemas/auth"

export default function Login() {
    const navigate = useNavigate()
    const [params] = useSearchParams()

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<LoginSchema>({
        mode: "onTouched",
        resolver: zodResolver(loginSchema),
        defaultValues: { name: "", password: "" },
    })

    const onSubmit = async (data: LoginSchema): Promise<void> => {
        try {
            await authApi.authentication(data)
            toast.success("Добро пожаловать")
            navigate("/", { replace: true })
        } catch {
            toast.error("Неверные данные")
        }
    }

    return (
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <h1>Вход</h1>

            <input
                {...register("name")}
                type="text"
                placeholder="Имя"
                aria-invalid={!!errors.name}
            />
            {errors.name && <span role="alert">{errors.name.message}</span>}

            <input
                {...register("password")}
                type="password"
                placeholder="Пароль"
                aria-invalid={!!errors.password}
            />
            {errors.password && <span role="alert">{errors.password.message}</span>}

            <button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Входим…" : "Войти"}
            </button>
        </form>
    )
}
