"use client";

import { useState } from "react";
import { Nav } from "@/components/nav";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setSent(true);
  }

  return (
    <>
      <Nav />
      <main className="mx-auto flex max-w-md flex-col px-4 py-20 sm:px-6">
        <h1 className="text-2xl font-bold">Reset your password</h1>
        {sent ? (
          <p className="mt-6 text-white/70">
            If an account exists for that email, a reset link has been sent (check the server console in dev mode).
          </p>
        ) : (
          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <div>
              <label className="block text-sm text-white/60">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-md border border-white/15 bg-transparent px-3 py-2 outline-none focus:border-[var(--brand-primary)]"
              />
            </div>
            <button className="w-full rounded-md bg-[var(--brand-primary)] px-4 py-2.5 text-sm font-semibold hover:opacity-90">
              Send reset link
            </button>
          </form>
        )}
      </main>
    </>
  );
}
