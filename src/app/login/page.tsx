"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("admin@example.com");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await signIn("credentials", { email, password, redirect: false });
    setBusy(false);
    if (res?.error) {
      setError("That email and password combination doesn't match. Check the seeded demo accounts in the README.");
      return;
    }
    router.push(params.get("callbackUrl") ?? "/");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="w-full max-w-sm space-y-4">
      <div>
        <label htmlFor="email" className="label">Email</label>
        <input id="email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
      </div>
      <div>
        <label htmlFor="password" className="label">Password</label>
        <input id="password" type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
      </div>
      {error && <p className="text-sm text-deal-red">{error}</p>}
      <button type="submit" className="btn-primary w-full justify-center" disabled={busy}>
        {busy ? "Signing in…" : "Sign in"}
      </button>
      <p className="text-xs text-ink-faint">
        Demo accounts: admin@example.com, member@example.com, viewer@example.com — password <span className="mono">Password123!</span>
      </p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-screen grid lg:grid-cols-[5fr_7fr]">
      <section className="hidden lg:flex flex-col justify-between bg-ink text-paper p-10">
        <div className="eyebrow text-paper/60">Internal acquisitions platform</div>
        <div>
          <h1 className="font-serif text-5xl font-semibold leading-tight">DealScout</h1>
          <p className="mt-3 max-w-md text-paper/70 text-sm leading-relaxed">
            A ledger for high-cash-flow rentals: rent-to-price screening, transparent deal scoring,
            HUD Fair Market Rent benchmarks, and a nine-stage acquisition pipeline.
          </p>
        </div>
        <div className="mono text-xs text-paper/50">
          RATIO · DSCR · NOI · CAP · CoC · SAFMR
        </div>
      </section>
      <section className="flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <h1 className="font-serif text-3xl font-semibold">DealScout</h1>
          </div>
          <h2 className="font-serif text-2xl font-semibold mb-1">Sign in</h2>
          <p className="text-sm text-ink-faint mb-6">Use your team credentials.</p>
          <Suspense><LoginForm /></Suspense>
        </div>
      </section>
    </main>
  );
}
