import { redirect } from "next/navigation"

/**
 * There is no public landing page. Send visitors to the dashboard; its layout bounces them
 * on to /login if they are not signed in.
 */
export default function Page() {
  redirect("/dashboard")
}
