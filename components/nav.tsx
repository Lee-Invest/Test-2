"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { branding } from "@/lib/branding";
import { SkylineAccent } from "@/components/skyline-accent";

const links = [
  { href: "/pricing", label: "Challenges" },
  { href: "/how-it-works", label: "How It Works" },
  { href: "/faq", label: "FAQ" },
  { href: "/rules", label: "Trading Rules" },
];

export function Nav() {
  const { data: session } = useSession();

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 overflow-hidden border-b border-white/50 bg-gradient-to-r from-slate-300/40 via-white/50 to-slate-300/40 shadow-[0_8px_32px_rgba(31,38,135,0.12)] backdrop-blur-2xl">
        <SkylineAccent />
        <SkylineAccent flip />
        <nav className="relative mx-auto flex max-w-6xl items-center justify-between px-8 py-3 sm:px-12">
          <Link href="/" className="text-lg font-bold tracking-tight text-white">
            {branding.name}
          </Link>
          <div className="hidden gap-6 md:flex">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="text-sm text-gray-200 hover:text-white">
                {l.label}
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-3">
            {session?.user ? (
              <>
                <Link
                  href={session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN" ? "/admin" : "/dashboard"}
                  className="text-sm text-gray-100 hover:text-white"
                >
                  Dashboard
                </Link>
                <button
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="rounded-full border border-white/50 bg-white/10 px-3 py-1.5 text-sm text-white backdrop-blur-xl hover:bg-black/30"
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className="text-sm text-gray-100 hover:text-white">
                  Log in
                </Link>
                <Link
                  href="/register"
                  className="rounded-full bg-[var(--brand-primary)]/90 px-3 py-1.5 text-sm font-medium text-white backdrop-blur-xl hover:opacity-90"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>
        </nav>
      </header>
      {/* Spacer so fixed header doesn't overlap page content */}
      <div className="h-[60px]" />
    </>
  );
}
