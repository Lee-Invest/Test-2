import Link from "next/link";
import { Nav } from "@/components/nav";

// Plain server-rendered <form> posting natively to /api/register (no
// client-side onSubmit / fetch involved at all). Whatever was preventing
// client JS handlers from doing anything on this page, a native form POST
// is handled by the browser itself and cannot be silently swallowed.
export default function RegisterPage({
  searchParams,
}: {
  searchParams: { error?: string; email?: string; name?: string };
}) {
  return (
    <>
      <Nav />
      <main className="mx-auto flex max-w-md flex-col px-4 py-20 sm:px-6">
        <h1 className="text-2xl font-bold text-gray-900">Create your account</h1>
        <form action="/api/register" method="POST" className="mt-8 space-y-4">
          <div>
            <label className="block text-sm text-gray-600">Name</label>
            <input
              required
              name="name"
              defaultValue={searchParams.name}
              className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none focus:border-[var(--brand-primary)]"
            />
          </div>
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
            <label className="block text-sm text-gray-600">Password (min 8 characters)</label>
            <input
              type="password"
              required
              minLength={8}
              name="password"
              className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none focus:border-[var(--brand-primary)]"
            />
          </div>
          {searchParams.error && <p className="text-sm text-red-600">{searchParams.error}</p>}
          <button
            type="submit"
            className="w-full rounded-md bg-[var(--brand-primary)] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
          >
            Create account
          </button>
        </form>
        <p className="mt-4 text-sm text-gray-500">
          Already have an account? <Link href="/login" className="hover:text-gray-900">Log in</Link>
        </p>
      </main>
    </>
  );
}
