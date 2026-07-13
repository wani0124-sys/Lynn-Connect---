import { type RouteConfig, index, layout, route } from "@react-router/dev/routes"

export default [
  route("login", "routes/login.tsx"),
  route("logout", "routes/logout.tsx"),
  layout("routes/_app.tsx", [
    index("routes/dashboard.tsx"),
    route("standards", "routes/standards.tsx"),
    route("standards/new", "routes/standards-new.tsx"),
    route("standards/:postId", "routes/standards-detail.tsx"),
    route("items", "routes/items.tsx"),
    route("items/:itemId", "routes/item-detail.tsx"),
    route("members", "routes/members.tsx"),
    route("settings", "routes/settings.tsx"),
  ]),
  route("forbidden", "routes/forbidden.tsx"),
  route("*", "routes/$.tsx"),
] satisfies RouteConfig
