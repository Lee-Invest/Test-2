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
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/90 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" className="text-lg font-bold tracking-tight text-gray-900">
          {branding.name}
        </Link>
        <div className="hidden gap-6 md:flex">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="text-sm text-gray-600 hover:text-gray-900">
              {l.label}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-3">
          {session?.user ? (
            <>
              <Link
                href={session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN" ? "/admin" : "/dashboard"}
                className="text-sm text-gray-700 hover:text-gray-900"
              >
                Dashboard
              </Link>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="rounded-md bg-gray-100 px-3 py-1.5 text-sm text-gray-900 hover:bg-gray-200"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="text-sm text-gray-700 hover:text-gray-900">
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
