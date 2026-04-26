import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { authApi } from "~/axios/auth";
import { AuthShell } from "~/components/layout";
import { Button } from "~/components/ui/button";
import { Field } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { PasswordInput } from "~/components/ui/password-input";
import { getApiErrorMessage } from "~/lib/api-error";
import { loginSchema, type LoginSchema } from "~/schemas/auth";
import { useAuthStore } from "~/stores/useAuthStore";

export default function Login() {
  const setUser = useAuthStore((s) => s.setUser);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (user?.role === "director") {
      window.location.replace("/users");
    }
  }, [user]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginSchema>({
    mode: "onTouched",
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (data: LoginSchema): Promise<void> => {
    try {
      const nextUser = await authApi.login(data);

      if (nextUser.role !== "director") {
        await authApi.logout();
        toast.error("Неверный email или пароль");
        return;
      }

      setUser(nextUser);
      toast.success("Добро пожаловать");
      window.location.replace("/users");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Не удалось выполнить вход"));
    }
  };

  return (
    <AuthShell
      title="Вход в систему"
      subtitle="Введите данные директорского аккаунта"
    >
      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="flex flex-col gap-4"
      >
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

        <Field
          label="Пароль"
          htmlFor="password"
          error={errors.password?.message}
        >
          <PasswordInput
            id="password"
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
  );
}
