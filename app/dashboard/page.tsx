// app/dashboard/page.tsx
import { after } from "next/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getProfile, getPublicStashTabs, getPublicStashTabsFetcher } from "@/lib/poe-api";
import { accumulateStashes } from "@/lib/stash-cache";
import StashButton from "./StashButton";
import ItemSearch from "./ItemSearch";

const LEAGUE = "Mirage"; // hard-coded as mirage league for now

export default async function Dashboard() {
  const cookieStore = await cookies();
  const token = cookieStore.get("poe_access_token");
  if (!token) redirect("/");

  const [profile, stashData] = await Promise.all([
    getProfile(),
    getPublicStashTabs(),
  ]);

  const leagueItems = stashData.stashes
    .filter((s) => s.league === LEAGUE && s.public)
    .flatMap((s) =>
      (s.items as any[]).map((item) => ({
        ...item,
        accountName: s.accountName,
        stashName: s.stash,
      }))
    );

  // After the response is sent, silently walk the next 10 river pages.
  // The distributed lock in accumulateStashes ensures only one run proceeds
  // even if multiple users hit the dashboard concurrently.
  after(async () => {
    await accumulateStashes(getPublicStashTabsFetcher());
  });

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