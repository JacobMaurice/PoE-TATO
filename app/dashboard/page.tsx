// app/dashboard/page.tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getProfile, getPublicStashTabs } from "@/lib/poe-api";
import StashButton from "./StashButton";

const LEAGUE = "Mirage"; // hard-coded as mirage league for now

export default async function Dashboard() {
  const cookieStore = await cookies();
  const token = cookieStore.get("poe_access_token");
  if (!token) redirect("/");

  const [profile, stashData] = await Promise.all([
    getProfile(),
    getPublicStashTabs(), // no nextChangeId = latest snapshot
  ]);

  const leagueItems = stashData.stashes
    .filter((s) => s.league === LEAGUE && s.public)
    .flatMap((s) =>
      (s.items as any[]).map((item) => ({
        ...item,
        accountName: s.accountName,
        stashName: s.stash,
      }))
    )
    .slice(0, 20);

  return (
    <main style={{ fontFamily: "sans-serif", maxWidth: 640, margin: "80px auto", padding: "0 1rem" }}>
      <h1>Welcome, {profile.name}!</h1>
      <p style={{ color: "#666", fontSize: 14 }}>
        Your access token is stored securely in an httpOnly cookie.
      </p>

      <StashButton league={LEAGUE} />

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 16, marginBottom: 4 }}>Recently Listed — {LEAGUE}</h2>
        <p style={{ fontSize: 12, color: "#999", marginBottom: 12 }}>
          Next change ID: {stashData.next_change_id}
        </p>
        {leagueItems.length === 0 ? (
          <p style={{ color: "#666", fontSize: 14 }}>No public items found for this league in the latest snapshot.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 8 }}>
            {leagueItems.map((item, i) => (
              <li
                key={i}
                style={{
                  background: "#1a1a1a",
                  border: "1px solid #333",
                  borderRadius: 6,
                  padding: "8px 12px",
                  fontSize: 13,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <strong>{item.name || item.typeLine}</strong>
                  {item.note && (
                    <span style={{ color: "#aaa", marginLeft: 8 }}>{item.note}</span>
                  )}
                </div>
                <span style={{ color: "#666", fontSize: 12 }}>{item.accountName}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p style={{ fontSize: 13, color: "#999", marginTop: 32 }}>
        This product isn&apos;t affiliated with or endorsed by Grinding Gear Games in any way.
      </p>
    </main>
  );
}