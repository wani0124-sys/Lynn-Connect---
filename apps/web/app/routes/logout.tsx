import { redirect, type ActionFunctionArgs } from "react-router"
import { logout } from "~/features/auth/model/session.server"

export async function action({ request }: ActionFunctionArgs) {
  return logout(request)
}

export function loader() {
  return redirect("/")
}
