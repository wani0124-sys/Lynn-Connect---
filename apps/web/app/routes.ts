import { type RouteConfig, index, layout, route } from "@react-router/dev/routes"

export default [
  route("login", "routes/login.tsx"),
  route("signup", "routes/signup.tsx"),
  route("logout", "routes/logout.tsx"),
  route("change-password", "routes/change-password.tsx"),
  route("sites/:siteId/inspections/:inspectionId/print", "routes/inspection-print.tsx"),
  route("standards/attachments/:attachmentId/download", "routes/standards-attachment-download.tsx"),
  route("site-mails/attachments/:attachmentId/download", "routes/site-mails-attachment-download.tsx"),
  layout("routes/_app.tsx", { id: "app-layout" }, [
    index("routes/dashboard.tsx"),
    route("standards", "routes/standards.tsx"),
    route("standards/new", "routes/standards-new.tsx"),
    route("standards/:postId", "routes/standards-detail.tsx"),
    route("sites", "routes/sites.tsx"),
    route("site-mails", "routes/site-mails.tsx"),
    route("site-mails/new", "routes/site-mails-new.tsx"),
    route("site-mails/:postId", "routes/site-mails-detail.tsx"),
    route("menu/:slug", "routes/menu-placeholder.tsx"),
    route("documents", "routes/documents.tsx"),
    route("members", "routes/members.tsx"),
    route("settings", "routes/settings.tsx"),
  ]),
  route("forbidden", "routes/forbidden.tsx"),
  route("*", "routes/$.tsx"),
] satisfies RouteConfig
