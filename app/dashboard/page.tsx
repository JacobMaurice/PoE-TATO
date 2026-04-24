import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/poe-api";
import StashButton from "./StashButton";

export default async function Dashboard() {
  const cookieStore = await cookies();
  const token = cookieStore.get("poe_access_token");
  if (!token) redirect("/");

  const profile = await getProfile();

  return (
    <main style={{ fontFamily: "sans-serif", maxWidth: 480, margin: "80px auto", padding: "0 1rem" }}>
      <h1>Welcome, {profile.name}!</h1>
      <p style={{ color: "#666", fontSize: 14 }}>
        Your access token is stored securely in an httpOnly cookie.
      </p>

      <StashButton league="Mirage" /> {/*Hard-coded to Mirage for now*/}

      <p style={{ fontSize: 13, color: "#999", marginTop: 32 }}>
        This product isn&apos;t affiliated with or endorsed by Grinding Gear Games in any way.
      </p>
    </main>
  );
}