// app/page.tsx

export default function Home({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  return (
    <main style={{ fontFamily: "sans-serif", maxWidth: 480, margin: "80px auto", padding: "0 1rem" }}>
      <h1>poe-tato</h1>
      <p style={{ color: "#666", fontSize: 14 }}>
        This product isn&apos;t affiliated with or endorsed by Grinding Gear Games in any way.
      </p>

      {searchParams.error && (
        <p style={{ color: "red", fontSize: 14 }}>
          Authentication error: {searchParams.error}. Please try again.
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
