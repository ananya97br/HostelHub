"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import type { DormRole } from "@/lib/types";

const navigation: Array<{ href: string; label: string; adminOnly?: boolean; roles?: DormRole[]; studentLabel?: string; maintenanceLabel?: string }> = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/rooms", label: "Rooms", studentLabel: "My room" },
  { href: "/allocations", label: "Allocations", roles: ["Admin", "Warden", "Student"], studentLabel: "My allocation" },
  { href: "/hostels", label: "Hostels" },
  { href: "/students", label: "Students", roles: ["Admin", "Warden", "Student"], studentLabel: "My record" },
  { href: "/complaints", label: "Complaints", studentLabel: "My complaints", maintenanceLabel: "Assigned work" },
  { href: "/accounts", label: "Accounts", adminOnly: true },
  { href: "/reports", label: "Reports", roles: ["Admin", "Warden"] },
  { href: "/audit", label: "Activity history", roles: ["Admin", "Warden"] },
  { href: "/profile", label: "Profile" },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteHeader({ authenticated = false }: { authenticated?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const [role, setRole] = useState<DormRole | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!authenticated) return;

    let mounted = true;
    async function loadRole() {
      try {
        const response = await fetch("/api/auth/me", { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as { role?: DormRole | null };
        if (mounted) setRole(data.role ?? null);
      } catch {
        // The page-level server fetch remains the source of truth if this
        // convenience request is unavailable.
      }
    }
    void loadRole();
    return () => {
      mounted = false;
    };
  }, [authenticated]);

  async function handleLogout() {
    setLoggingOut(true);
    setError("");
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        setError("Logout failed");
        return;
      }
      router.push("/login");
      router.refresh();
    } catch {
      setError("Logout failed");
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <header className="border-b border-stone-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex min-h-16 max-w-7xl items-center gap-6 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex shrink-0 items-center gap-3" aria-label="HostelHub home">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-950 text-sm font-bold text-white">
            H
          </span>
          <span className="text-lg font-semibold tracking-tight text-stone-900">HostelHub</span>
        </Link>

        {authenticated ? (
          <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto" aria-label="Primary navigation">
            {navigation.filter((item) => (!item.adminOnly || role === "Admin") && (!item.roles || !role || item.roles.includes(role))).map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition ${
                    active
                      ? "bg-amber-50 text-blue-950"
                      : "text-stone-600 hover:bg-stone-100 hover:text-stone-900"
                  }`}
                >
                  {role === "Student" && item.studentLabel ? item.studentLabel : role === "Maintenance" && item.maintenanceLabel ? item.maintenanceLabel : item.label}
                </Link>
              );
            })}
          </nav>
        ) : (
          <nav className="ml-auto flex items-center gap-2" aria-label="Public navigation">
            <Link href="/rooms" className="hidden rounded-lg px-3 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100 sm:inline-flex">
              Browse rooms
            </Link>
            <Link href="/login" className="rounded-lg bg-blue-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-900">
              Sign in
            </Link>
          </nav>
        )}

        {authenticated && (
          <div className="flex shrink-0 items-center gap-2">
            {error && <span className="hidden text-xs text-red-700 md:inline">{error}</span>}
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="rounded-lg border border-stone-300 px-3 py-2 text-sm font-medium text-stone-700 transition hover:border-stone-400 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loggingOut ? "Signing out" : "Sign out"}
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
      <SiteHeader authenticated />
      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">{children}</main>
    </div>
  );
}

export function PageIntro({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <section className="flex flex-col justify-between gap-5 border-b border-stone-200 pb-8 sm:flex-row sm:items-end">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-900">{eyebrow}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-950 sm:text-4xl">{title}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-600 sm:text-base">{description}</p>
      </div>
      {action}
    </section>
  );
}

export function StatCard({
  label,
  value,
  detail,
  accent = false,
}: {
  label: string;
  value: number | string;
  detail?: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5">
      <p className="text-sm font-medium text-stone-500">{label}</p>
      <p className={`mt-3 text-3xl font-semibold tracking-tight ${accent ? "text-amber-700" : "text-stone-950"}`}>{value}</p>
      {detail && <p className="mt-2 text-xs text-stone-500">{detail}</p>}
    </div>
  );
}

export function Notice({
  tone,
  children,
}: {
  tone: "error" | "warning" | "info" | "success";
  children: React.ReactNode;
}) {
  const styles = {
    error: "border-red-200 bg-red-50 text-red-800",
    warning: "border-amber-200 bg-amber-50 text-amber-800",
    info: "border-stone-200 bg-white text-stone-600",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  };
  return <div className={`rounded-xl border px-4 py-3 text-sm ${styles[tone]}`}>{children}</div>;
}

export function StatusPill({ value }: { value: string }) {
  const styles: Record<string, string> = {
    Open: "bg-amber-50 text-amber-800",
    "In-Progress": "bg-sky-50 text-sky-800",
    Completed: "bg-blue-50 text-blue-800",
    Resolved: "bg-emerald-50 text-emerald-800",
    Rejected: "bg-red-50 text-red-800",
    Available: "bg-emerald-50 text-emerald-800",
    Full: "bg-stone-100 text-stone-700",
  };
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${styles[value] ?? "bg-stone-100 text-stone-700"}`}>{value}</span>;
}
