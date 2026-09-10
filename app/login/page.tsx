import Link from "next/link";
import { headers } from "next/headers";
import { Nav } from "@/components/nav";

// Plain server-rendered <form> posting straight to NextAuth's own
// /api/auth/callback/credentials endpoint (the same endpoint next-auth's
// built-in sign-in page posts to) instead of calling signIn() from client
// JS. The browser handles this submission natively — sets the session
// cookie and redirects on its own — so it works even if client-side event
// handlers on this page were ever failing to fire.
//
// The CSRF token has to come from middleware.ts (via the x-csrf-token
// request header), not a fetch done here: a Server Component can only read
// cookies, never set them, so a token fetched directly in this page would
// never get its matching cookie onto the browser and every submit would
// fail CSRF validation.
export default async function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string; error?: string; registered?: string; reset?: string; email?: string };
}) {
  const csrfToken = headers().get("x-csrf-token") ?? "";
  const callbackUrl = searchParams.next || "/dashboard";

  return (
    <>
      <Nav />
      <main className="mx-auto flex max-w-md flex-col px-4 py-20 sm:px-6">
        <h1 className="text-2xl font-bold text-gray-900">Log in</h1>
        {searchParams.registered && (
          <p className="mt-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
            Account created. Log in below to continue.
          </p>
        )}
        {searchParams.reset && (
          <p className="mt-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
            Password updated. Log in with your new password.
          </p>
        )}
        <form action="/api/auth/callback/credentials" method="POST" className="mt-8 space-y-4">
          <input type="hidden" name="csrfToken" value={csrfToken} />
          <input type="hidden" name="callbackUrl" value={callbackUrl} />
          <div>
            <label className="block text-sm text-gray-600">Email</label>
            <input
              type="email"
              required
              name="email"
              defaultValue={searchParams.email}
              className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none focus:border-[var(--brand-primary)]"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600">Password</label>
            <input
              type="password"
              required
              name="password"
              className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none focus:border-[var(--brand-primary)]"
            />
          </div>
          {searchParams.error && <p className="text-sm text-red-600">Invalid email or password.</p>}
          <button
            type="submit"
            className="w-full rounded-md bg-[var(--brand-primary)] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
          >
            Log in
          </button>
        </form>
        <div className="mt-4 flex justify-between text-sm text-gray-500">
          <Link href="/register" className="hover:text-gray-900">
            Create an account
          </Link>
          <Link href="/forgot-password" className="hover:text-gray-900">
            Forgot password?
          </Link>
        </div>
      </main>
    </>
  );
}
