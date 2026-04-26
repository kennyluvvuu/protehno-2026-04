import { type RouteConfig, index, layout, route } from "@react-router/dev/routes"

export default [
    route("login", "routes/login.tsx"),

    layout("routes/_protected.tsx", [
        index("routes/home.tsx"),
        route("calls", "routes/calls.tsx"),
        route("tasks", "routes/tasks.tsx"),
        route("upload", "routes/upload.tsx"),
        route("settings", "routes/settings.tsx"),
    ]),
] satisfies RouteConfig
