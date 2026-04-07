// app/page.tsx

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main style={{ fontFamily: "sans-serif", maxWidth: 480, margin: "80px auto", padding: "0 1rem" }}>
      <h1>PoE-TATO</h1>
      <p style={{ color: "#666", fontSize: 14 }}>
        This product isn&apos;t affiliated with or endorsed by Grinding Gear Games in any way.
      </p>

      {error && (
        <p style={{ color: "red", fontSize: 14 }}>
          Authentication error: {error}. Please try again.
        </p>
      )}

      <a
        href="/api/login"
        style={{
          display: "inline-block",
          marginTop: 24,
          padding: "10px 20px",
          background: "#af6025",
          color: "#fff",
          borderRadius: 6,
          textDecoration: "none",
          fontWeight: 500,
        }}
      >
        Log in with Path of Exile
      </a>
    </main>
  );
}