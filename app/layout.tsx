import type { Metadata } from "next";
import "./globals.css";
import { GlobalErrorWatcher } from "@/components/global-error-watcher";
import { branding } from "@/lib/branding";

export const metadata: Metadata = {
  title: `${branding.name} — Funded Trader Challenges`,
  description: branding.tagline,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-gray-900 antialiased">
        {children}
        <GlobalErrorWatcher />
      </body>
    </html>
  );
}
