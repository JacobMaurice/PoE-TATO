import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "poe-tato",
  description: "Path of Exile app. This product isn't affiliated with or endorsed by Grinding Gear Games in any way.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
