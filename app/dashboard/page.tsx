// app/dashboard/page.tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getProfile, getPublicStashTabs } from "@/lib/poe-api";
import StashButton from "./StashButton";
import ItemSearch from "./ItemSearch";

export const dynamic = "force-dynamic";

const LEAGUE = "Mirage";

export default async function Dashboard() {
  const cookieStore = await cookies();
  const token = cookieStore.get("poe_access_token");
  if (!token) redirect("/");

  const [profile, stashData] = await Promise.all([
    getProfile(),
    getPublicStashTabs(),
  ]);

  const leagueItems = stashData.stashes.flatMap((s) =>
    (s.items as any[]).map((item) => ({
      ...item,
      accountName: s.accountName,
      stashName: s.stash,
    }))
  );

  console.log("stash tab count:", stashData.stashes.length);
  console.log("total items:", stashData.stashes.reduce((n, s) => n + (s.items as any[]).length, 0));

  return (
    <main style={{ fontFamily: "sans-serif", maxWidth: 760, margin: "80px auto", padding: "0 1rem" }}>
      <h1>Welcome, {profile.name}!</h1>

      <StashButton league={LEAGUE} />

      <ItemSearch items={leagueItems} league={LEAGUE} />

      <p style={{ fontSize: 13, color: "#444", marginTop: 40 }}>
        This product isn&apos;t affiliated with or endorsed by Grinding Gear Games in any way.
      </p>
    </main>
  );
}