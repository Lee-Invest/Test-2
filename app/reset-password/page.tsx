"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Nav } from "@/components/nav";

function ResetForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Reset failed.");
      return;
    }
    setDone(true);
    setTimeout(() => router.push("/login"), 1500);
  }

  return (
    <main className="mx-auto flex max-w-md flex-col px-4 py-20 sm:px-6">
      <h1 className="text-2xl font-bold">Set a new password</h1>
      {done ? (
        <p className="mt-6 text-white/70">Password updated. Redirecting to login…</p>
      ) : (
        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <input
            type="password"
            required
            minLength={8}
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-md border border-white/15 bg-transparent px-3 py-2 outline-none focus:border-[var(--brand-primary)]"
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button className="w-full rounded-md bg-[var(--brand-primary)] px-4 py-2.5 text-sm font-semibold hover:opacity-90">
            Update password
          </button>
        </form>
      )}
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <>
      <Nav />
      <Suspense>
        <ResetForm />
      </Suspense>
    </>
  );
}
