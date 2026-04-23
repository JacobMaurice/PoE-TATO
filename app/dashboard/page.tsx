// app/dashboard/page.tsx

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getProfile} from "@/lib/poe-api";

export default async function Dashboard() {
  const cookieStore = await cookies();
  const token = cookieStore.get("poe_access_token");
  if (!token) redirect("/");

  // These run server-side — the token never touches the browser
  const [profile] = await Promise.all([
    getProfile()
  ]);

  return (
    <main style={{ fontFamily: "sans-serif", maxWidth: 480, margin: "80px auto", padding: "0 1rem" }}>
      <h1>Welcome, {profile.name}!</h1>
      <p style={{ fontSize: 13, color: "#999" }}>
        This product isn&apos;t affiliated with or endorsed by Grinding Gear Games in any way.
      </p>
    </main>
  );
}