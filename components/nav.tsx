"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { branding } from "@/lib/branding";

const links = [
  { href: "/pricing", label: "Challenges" },
  { href: "/how-it-works", label: "How It Works" },
  { href: "/faq", label: "FAQ" },
  { href: "/rules", label: "Trading Rules" },
];

export function Nav() {
  const { data: session } = useSession();

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0b0b14]/90 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" className="text-lg font-bold tracking-tight text-white">
          {branding.name}
        </Link>
        <div className="hidden gap-6 md:flex">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="text-sm text-white/70 hover:text-white">
              {l.label}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-3">
          {session?.user ? (
            <>
              <Link
                href={session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN" ? "/admin" : "/dashboard"}
                className="text-sm text-white/80 hover:text-white"
              >
                Dashboard
              </Link>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="rounded-md bg-white/10 px-3 py-1.5 text-sm text-white hover:bg-white/20"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="text-sm text-white/80 hover:text-white">
                Log in
              </Link>
              <Link
                href="/register"
                className="rounded-md bg-[var(--brand-primary)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
              >
                Get Started
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
