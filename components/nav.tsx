import Link from "next/link";
import { headers } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { branding } from "@/lib/branding";

const links = [
  { href: "/pricing", label: "Buy Challenge" },
  { href: "/how-it-works", label: "How It Works" },
  { href: "/faq", label: "FAQ" },
  { href: "/rules", label: "Trading Rules" },
];

// Server component: session comes from getServerSession (no useSession/
// client fetch), the mobile menu opens via a hidden checkbox + CSS (the
// "checkbox hack" — :checked driving a sibling's visibility with zero JS),
// and "Sign out" is a native <form> posting to NextAuth's own
// /api/auth/callback/signout (the CSRF token comes from middleware.ts,
// same reasoning as the /login form). Nothing here depends on client JS.
export async function Nav() {
  const session = await getServerSession(authOptions);
  const csrfToken = headers().get("x-csrf-token") ?? "";
  const dashboardHref = session?.user && (session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN") ? "/admin" : "/dashboard";

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 border-b border-white/50 bg-gradient-to-r from-slate-300/40 via-white/50 to-slate-300/40 shadow-[0_8px_32px_rgba(31,38,135,0.12)] backdrop-blur-2xl">
        {/* Checkbox hack: this checkbox is the single source of truth for
            whether the mobile menu is open. It must be a DOM sibling of the
            mobile panel below (both direct children of <header>) for the
            `peer-checked:` CSS selector to reach it — the toggle <label>
            can live anywhere and still control it via htmlFor. */}
        <input type="checkbox" id="mobile-nav-toggle" className="peer hidden" />

        <span
          className="pointer-events-none absolute left-3 top-1/2 hidden -translate-y-1/2 whitespace-nowrap text-xs font-semibold leading-none tracking-[0.12em] min-[1700px]:block"
          style={{ color: "rgba(180, 140, 70, 0.95)" }}
        >
          Made by traders, Created for traders
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
                  style={{ backgroundColor: "#2563eb" }}
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
                <SignOutForm csrfToken={csrfToken} />
                <Link href={dashboardHref} className="text-sm text-gray-800 hover:text-gray-900">
                  Dashboard
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  style={{
                    background: "linear-gradient(135deg, rgba(226,229,233,0.9), rgba(180,184,190,0.7) 50%, rgba(226,229,233,0.9))",
                    border: "1px solid rgba(255,255,255,0.6)",
                  }}
                  className="rounded-full px-3 py-1.5 text-sm font-medium text-gray-900 shadow-md shadow-black/10 backdrop-blur-xl hover:opacity-90"
                >
                  Log in
                </Link>
                <Link
                  href="/register"
                  style={{ backgroundColor: "#2563eb" }}
                  className="rounded-full px-3 py-1.5 text-sm font-medium text-white shadow-md shadow-black/20 hover:opacity-90"
                >
                  Get Funded
                </Link>
              </>
            )}
          </div>

          <label
            htmlFor="mobile-nav-toggle"
            aria-label="Toggle menu"
            className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-white/50 bg-white/30 text-gray-900 backdrop-blur-xl lg:hidden"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
            </svg>
          </label>
        </nav>

        {/* Direct sibling of the checkbox above — peer-checked:block shows
            this with zero JS. */}
        <div className="hidden border-t border-white/40 bg-white/60 px-4 py-4 backdrop-blur-2xl peer-checked:block lg:hidden">
          <div className="mx-auto flex max-w-6xl flex-col gap-3">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="text-sm font-medium text-gray-800 hover:text-gray-900">
                {l.label}
              </Link>
            ))}
            <div className="mt-2 flex flex-col gap-2 border-t border-white/40 pt-3">
              {session?.user ? (
                <>
                  <SignOutForm csrfToken={csrfToken} block />
                  <Link href={dashboardHref} className="text-sm text-gray-800 hover:text-gray-900">
                    Dashboard
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    style={{
                      background: "linear-gradient(135deg, rgba(226,229,233,0.9), rgba(180,184,190,0.7) 50%, rgba(226,229,233,0.9))",
                      border: "1px solid rgba(255,255,255,0.6)",
                    }}
                    className="rounded-full px-3 py-2 text-center text-sm font-medium text-gray-900 shadow-md shadow-black/10 backdrop-blur-xl hover:opacity-90"
                  >
                    Log in
                  </Link>
                  <Link
                    href="/register"
                    style={{ backgroundColor: "#2563eb" }}
                    className="rounded-full px-3 py-2 text-center text-sm font-medium text-white shadow-md shadow-black/20 hover:opacity-90"
                  >
                    Get Funded
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </header>
      {/* Spacer so fixed header doesn't overlap page content */}
      <div className="h-[60px]" />
    </>
  );
}

function SignOutForm({ csrfToken, block }: { csrfToken: string; block?: boolean }) {
  return (
    <form action="/api/auth/callback/signout" method="POST" className={block ? "w-full" : undefined}>
      <input type="hidden" name="csrfToken" value={csrfToken} />
      <input type="hidden" name="callbackUrl" value="/" />
      <button
        type="submit"
        className={
          block
            ? "w-full rounded-full border border-gray-300 px-3 py-2 text-center text-sm text-gray-700 hover:bg-gray-50"
            : "rounded-full border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
        }
      >
        Account
      </button>
    </form>
  );
}
