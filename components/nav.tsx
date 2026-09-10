"use client";

import { useState } from "react";
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
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 border-b border-white/50 bg-gradient-to-r from-slate-300/40 via-white/50 to-slate-300/40 shadow-[0_8px_32px_rgba(31,38,135,0.12)] backdrop-blur-2xl">
        <span
          className="pointer-events-none absolute left-3 top-1/2 hidden -translate-y-1/2 text-xs font-semibold leading-none tracking-[0.12em] 3xl:inline"
          style={{ color: "rgba(180, 140, 70, 0.95)" }}
        >
          Built by traders, made for traders
        </span>
        <nav className="relative mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-8 lg:px-12">
          <Link href="/" className="shrink-0 text-lg font-bold tracking-tight text-gray-900">
            {branding.name}
          </Link>
          <div className="hidden items-center gap-6 lg:flex">
            {links.map((l) =>
              l.href === "/pricing" ? (
                <Link
                  key={l.href}
                  href={l.href}
                  style={{ backgroundColor: "#1d3557" }}
                  className="rounded-full px-4 py-1.5 text-sm font-semibold text-white shadow-md shadow-black/20 hover:opacity-90"
                >
                  {l.label}
                </Link>
              ) : (
                <Link key={l.href} href={l.href} className="text-sm text-gray-700 hover:text-gray-900">
                  {l.label}
                </Link>
              )
            )}
          </div>
          <div className="hidden items-center gap-3 lg:flex">
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
                  style={{ backgroundColor: "#1d3557" }}
                  className="rounded-full px-3 py-1.5 text-sm text-white shadow-md shadow-black/20 hover:opacity-90"
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  style={{ backgroundColor: "#1d3557" }}
                  className="rounded-full px-3 py-1.5 text-sm font-medium text-white shadow-md shadow-black/20 hover:opacity-90"
                >
                  Log in
                </Link>
                <Link
                  href="/register"
                  style={{ backgroundColor: "#1d3557" }}
                  className="rounded-full px-3 py-1.5 text-sm font-medium text-white shadow-md shadow-black/20 hover:opacity-90"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>

          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/50 bg-white/30 text-gray-900 backdrop-blur-xl lg:hidden"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
              {menuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
              )}
            </svg>
          </button>
        </nav>

        {menuOpen && (
          <div className="border-t border-white/40 bg-white/60 px-4 py-4 backdrop-blur-2xl lg:hidden">
            <div className="mx-auto flex max-w-6xl flex-col gap-3">
              {links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setMenuOpen(false)}
                  className="text-sm font-medium text-gray-800 hover:text-gray-900"
                >
                  {l.label}
                </Link>
              ))}
              <div className="mt-2 flex flex-col gap-2 border-t border-white/40 pt-3">
                {session?.user ? (
                  <>
                    <Link
                      href={session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN" ? "/admin" : "/dashboard"}
                      onClick={() => setMenuOpen(false)}
                      className="text-sm text-gray-800 hover:text-gray-900"
                    >
                      Dashboard
                    </Link>
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        signOut({ callbackUrl: "/" });
                      }}
                      style={{ backgroundColor: "#1d3557" }}
                      className="rounded-full px-3 py-2 text-center text-sm text-white shadow-md shadow-black/20 hover:opacity-90"
                    >
                      Sign out
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      href="/login"
                      onClick={() => setMenuOpen(false)}
                      style={{ backgroundColor: "#1d3557" }}
                      className="rounded-full px-3 py-2 text-center text-sm font-medium text-white shadow-md shadow-black/20 hover:opacity-90"
                    >
                      Log in
                    </Link>
                    <Link
                      href="/register"
                      onClick={() => setMenuOpen(false)}
                      style={{ backgroundColor: "#1d3557" }}
                      className="rounded-full px-3 py-2 text-center text-sm font-medium text-white shadow-md shadow-black/20 hover:opacity-90"
                    >
                      Get Started
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </header>
      {/* Spacer so fixed header doesn't overlap page content */}
      <div className="h-[60px]" />
    </>
  );
}
