"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { branding } from "@/lib/branding";

const links = [
  { href: "/pricing", label: "Buy Challenge" },
  { href: "/how-it-works", label: "How It Works" },
  { href: "/faq", label: "FAQ" },
  { href: "/rules", label: "Trading Rules" },
];

export function Nav() {
  const { data: session } = useSession();

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 border-b border-white/50 bg-gradient-to-r from-slate-300/40 via-white/50 to-slate-300/40 shadow-[0_8px_32px_rgba(31,38,135,0.12)] backdrop-blur-2xl">
        <span
          className="pointer-events-none absolute left-2 top-1/2 hidden -translate-y-1/2 text-[9px] font-semibold uppercase leading-none tracking-[0.15em] sm:inline"
          style={{ color: "rgba(180, 140, 70, 0.95)" }}
        >
          Built by traders, made for traders
        </span>
        <nav className="relative mx-auto flex max-w-6xl items-center justify-between px-8 py-3 sm:px-12">
          <Link href="/" className="text-lg font-bold tracking-tight text-gray-900">
            {branding.name}
          </Link>
          <div className="hidden gap-6 md:flex">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="text-sm text-gray-700 hover:text-gray-900">
                {l.label}
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-3">
            {session?.user ? (
              <>
                <Link
                  href={session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN" ? "/admin" : "/dashboard"}
                  className="text-sm text-gray-800 hover:text-gray-900"
                >
                  Dashboard
                </Link>
                <button
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="rounded-full border border-white/50 bg-white/30 px-3 py-1.5 text-sm text-gray-900 backdrop-blur-xl hover:bg-white/50"
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className="text-sm text-gray-800 hover:text-gray-900">
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
