// app/dashboard/page.tsx
// Shown after a successful OAuth login.

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function Dashboard() {
  const cookieStore = await cookies();
  const token = cookieStore.get("poe_access_token");

  // If there's no token, send the user back to login
  if (!token) redirect("/");

  return (
    <main style={{ fontFamily: "sans-serif", maxWidth: 480, margin: "80px auto", padding: "0 1rem" }}>
      <h1>You&apos;re logged in!</h1>
      <p style={{ color: "#666", fontSize: 14 }}>
        Your access token is stored securely in an httpOnly cookie. You can now
        make authenticated requests to the Path of Exile API from your server routes.
      </p>
      <p style={{ fontSize: 13, color: "#999" }}>
        This product isn&apos;t affiliated with or endorsed by Grinding Gear Games in any way.
      </p>
    </main>
  );
}
