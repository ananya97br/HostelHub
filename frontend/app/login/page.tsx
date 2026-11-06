"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Login failed.");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Unable to connect to the server.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-stone-50 px-4 py-8 text-stone-900 sm:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl items-center justify-center">
        <div className="w-full max-w-2xl overflow-hidden rounded-3xl border border-amber-200 bg-sky-50">
          <div className="p-6 sm:p-10">
            <Link href="/" className="flex items-center gap-3 text-lg font-semibold text-blue-950">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-950 text-sm text-white">H</span>
              HostelHub
            </Link>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-stone-950">Sign in</h1>
            <p className="mt-2 text-sm text-stone-600">Use the credentials provisioned by your HostelHub administrator.</p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <div>
                <label htmlFor="username" className="mb-2 block text-sm font-medium text-stone-700">Username</label>
                <input id="username" type="text" value={username} onChange={(e) => setUsername(e.target.value)} required autoComplete="username" placeholder="Your username" className="w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-blue-900 focus:ring-4 focus:ring-blue-100" />
              </div>
              <div>
                <label htmlFor="password" className="mb-2 block text-sm font-medium text-stone-700">Password</label>
                <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" placeholder="Your password" className="w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-blue-900 focus:ring-4 focus:ring-blue-100" />
              </div>
              {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
              <button type="submit" disabled={loading} className="w-full rounded-xl bg-blue-950 px-4 py-3 font-semibold text-white transition hover:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-60">
                {loading ? "Signing in…" : "Continue"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
