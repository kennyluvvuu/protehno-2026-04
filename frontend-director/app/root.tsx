import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  redirect,
} from "react-router";
import { Toaster } from "sonner";

import type { Route } from "./+types/root";
import "./app.css";
import { authApi } from "./axios/auth";
import { useThemeSync } from "./hooks/useThemeSync";
import "./lib/axios-interceptors";

const themeScript = `(function(){try{var t=localStorage.getItem("theme");var d=t==="dark"||(!t&&window.matchMedia("(prefers-color-scheme: dark)").matches);if(d)document.documentElement.classList.add("dark");}catch(e){}})();`;

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
  },
];

export async function loader({ request }: Route.LoaderArgs) {
  try {
    const cookie = request.headers.get("cookie") ?? undefined;
    const user = await authApi.me(cookie);

    if (
      new URL(request.url).pathname === "/login" &&
      user.role === "director"
    ) {
      throw redirect("/");
    }

    return { user };
  } catch (error) {
    if (error instanceof Response) {
      throw error;
    }

    return { user: null };
  }
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <Toaster position="top-right" richColors />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  useThemeSync();
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Ошибка";
  let details = "Что-то пошло не так.";

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Ошибка";
    details =
      error.status === 404
        ? "Страница не найдена."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error instanceof Error) {
    details = error.message;
  }

  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">{message}</h1>
        <p className="mt-2 text-sm text-neutral-500">{details}</p>
      </div>
    </main>
  );
}
