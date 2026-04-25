import { type RouteConfig, index, layout, route } from "@react-router/dev/routes"

export default [
    route("login", "routes/login.tsx"),
    route("register", "routes/register.tsx"),

    layout("routes/_protected.tsx", [
        index("routes/home.tsx"),
        route("profile", "routes/profile.tsx"),
        route("settings", "routes/settings.tsx"),
    ]),
] satisfies RouteConfig
