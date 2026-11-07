import { redirect } from "next/navigation";
import { Suspense } from "react";

import { AppShell, Notice, PageIntro, StatusPill } from "@/components/AppShell";
import { djangoFetch } from "@/lib/django";
import type { Allocation } from "@/lib/complaints";
import { listData, type Paginated } from "@/lib/list";
import type { AuthUser } from "@/lib/types";

async function AllocationsContent() {
  const [userResponse, allocationsResponse] = await Promise.all([
    djangoFetch<AuthUser>("/api/auth/me/"),
    djangoFetch<Allocation[] | Paginated<Allocation>>("/api/allocations/"),
  ]);
  if (userResponse.status === 401 || allocationsResponse.status === 401) redirect("/login");
  if (!userResponse.data) return <Notice tone="warning">Your account is not linked to a HostelHub role.</Notice>;
  if (!allocationsResponse.data) return <Notice tone="error">Unable to load allocation records.</Notice>;
  const allocations = listData(allocationsResponse.data);

  return <section className="mt-8 overflow-hidden rounded-2xl border border-stone-200 bg-white"><div className="flex flex-wrap items-end justify-between gap-3 border-b border-stone-200 px-5 py-5"><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-900">Accommodation history</p><h2 className="mt-2 text-xl font-semibold text-stone-950">Room allocations</h2><p className="mt-1 text-sm text-stone-500">{userResponse.data.role === "Student" ? "Your current and previous room assignments." : "Current and historical room assignments within your access."}</p></div><span className="rounded-full bg-sky-50 px-3 py-1.5 text-xs font-semibold text-blue-900">{allocations.length} record{allocations.length === 1 ? "" : "s"}</span></div>{allocations.length === 0 ? <div className="px-6 py-14 text-center text-sm text-stone-500">No allocation records are available.</div> : <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500"><tr><th className="px-5 py-3.5 font-semibold">Student</th><th className="px-5 py-3.5 font-semibold">Room</th><th className="px-5 py-3.5 font-semibold">Academic year</th><th className="px-5 py-3.5 font-semibold">Allocated</th><th className="px-5 py-3.5 font-semibold">Status</th></tr></thead><tbody>{allocations.map((allocation) => <tr key={allocation.allocation_id} className="border-t border-stone-100"><td className="px-5 py-4 font-medium text-stone-800">{allocation.student_name}</td><td className="px-5 py-4 text-stone-600">Room {allocation.room_number}{allocation.hostel_name ? ` · ${allocation.hostel_name}` : ""}</td><td className="px-5 py-4 text-stone-600">{allocation.academic_year}</td><td className="px-5 py-4 text-stone-600">{allocation.allocation_date || "—"}</td><td className="px-5 py-4"><StatusPill value={allocation.status} /></td></tr>)}</tbody></table></div>}</section>;
}

export default function AllocationsPage() {
  return <AppShell><PageIntro eyebrow="Accommodation" title="Allocations" description="Review current room assignments and preserved allocation history." /><Suspense fallback={<div className="mt-8 rounded-2xl border border-stone-200 bg-white p-8 text-sm text-stone-500">Loading allocation records…</div>}><AllocationsContent /></Suspense></AppShell>;
}
