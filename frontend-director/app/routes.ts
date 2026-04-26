import {
  type RouteConfig,
  index,
  layout,
  route,
} from "@react-router/dev/routes";

export default [
  route("login", "routes/login.tsx"),

  layout("routes/_protected.tsx", [
    index("routes/home.tsx"),
    route("calls", "routes/calls.tsx"),
    route("users", "routes/users.tsx"),
    route("users/:id", "routes/users.$id.tsx"),
route("settings", "routes/settings.tsx"),
  ]),
] satisfies RouteConfig;
