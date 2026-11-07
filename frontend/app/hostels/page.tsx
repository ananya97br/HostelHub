import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";

import { AppShell, Notice, PageIntro, StatCard } from "@/components/AppShell";
import HostelManagement from "@/components/HostelManagement";
import { djangoFetch } from "@/lib/django";
import { listData, type Paginated } from "@/lib/list";
import type { AuthUser, Hostel, Staff } from "@/lib/types";

async function HostelsContent() {
  const [userResponse, response, staffResponse] = await Promise.all([
    djangoFetch<AuthUser>("/api/auth/me/"),
    djangoFetch<Hostel[] | Paginated<Hostel>>("/api/hostels/"),
    djangoFetch<Staff[] | Paginated<Staff>>("/api/staff/"),
  ]);
  if (userResponse.status === 401 || response.status === 401) redirect("/login");
  if (response.status === 403) return <Notice tone="warning">You do not have permission to view these hostels.</Notice>;
  if (!response.data) return <Notice tone="error">Unable to load hostels. Please try again shortly.</Notice>;

  const hostels = listData(response.data);
  const boys = hostels.filter((hostel) => hostel.gender_type === "Boys").length;
  const girls = hostels.filter((hostel) => hostel.gender_type === "Girls").length;
  const wardens = listData(staffResponse.data).filter((member) => member.role === "Warden");

  return (
    <>
      {userResponse.data?.role === "Admin" && <HostelManagement hostels={hostels} wardens={wardens} />}
      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        <StatCard label="Hostel blocks" value={hostels.length} />
        <StatCard label="Boys hostels" value={boys} />
        <StatCard label="Girls hostels" value={girls} />
      </section>
      <section className="mt-10">
        <div className="mb-5">
          <h2 className="text-xl font-semibold text-stone-950">Hostel blocks</h2>
          <p className="mt-1 text-sm text-stone-500">Use a block to inspect only its room records.</p>
        </div>
        {hostels.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center text-sm text-stone-500">No hostels found.</div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {hostels.map((hostel) => (
              <article key={hostel.hostel_id} className="rounded-2xl border border-stone-200 bg-white p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-stone-950">{hostel.hostel_name}</h3>
                    <p className="mt-1 text-sm text-stone-500">{hostel.hostel_address || "Address not specified"}</p>
                  </div>
                  <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-blue-950">{hostel.gender_type}</span>
                </div>
                <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-stone-200 pt-5">
                  <div><dt className="text-xs text-stone-500">Rooms</dt><dd className="mt-1 font-semibold text-stone-900">{hostel.total_rooms}</dd></div>
                  <div><dt className="text-xs text-stone-500">Warden</dt><dd className="mt-1 text-sm font-medium text-stone-900">{hostel.warden_name || (hostel.warden_id ? `Staff #${hostel.warden_id}` : "Not assigned")}</dd></div>
                </dl>
                <Link href={`/rooms?hostel_id=${hostel.hostel_id}`} className="mt-6 inline-flex rounded-xl border border-blue-900 px-4 py-2.5 text-sm font-semibold text-blue-950 transition hover:bg-amber-50">View rooms</Link>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

export default function HostelsPage() {
  return (
    <AppShell>
      <PageIntro eyebrow="Accommodation" title="Hostels" description="See the hostel blocks available to your role and move directly to each block's room inventory." />
      <Suspense fallback={<div className="mt-8 rounded-2xl border border-stone-200 bg-white p-8 text-sm text-stone-500">Loading hostel records…</div>}>
        <HostelsContent />
      </Suspense>
    </AppShell>
  );
}
