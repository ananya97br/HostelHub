import Link from "next/link";
import { Suspense } from "react";

import { SiteHeader } from "@/components/AppShell";
import { checkBackend } from "@/lib/api";

async function BackendStatus() {
  const backend = await checkBackend();
  return (
    <div className="flex items-center gap-3 text-sm text-stone-600">
      <span className={`h-2.5 w-2.5 rounded-full ${backend.connected ? "bg-emerald-600" : "bg-red-600"}`} aria-hidden="true" />
      <span>
         Workspace {backend.connected ? "ready" : "temporarily unavailable"}
        {backend.message && <span className="ml-2 text-stone-400">{backend.message}</span>}
      </span>
    </div>
  );
}

const features = [
  ["Rooms at a glance", "See capacity, occupancy, rent, and available beds from the live hostel records."],
  ["Controlled workflows", "Allocate, vacate, and reassign rooms with server-side availability and role checks."],
  ["Traceable maintenance", "Keep complaint status, ownership, assignments, and resolution remarks in one place."],
];

export default function Home() {
  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <section className="grid gap-12 py-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:py-24">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-900">Hostel operations workspace</p>
            <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-tight tracking-tight text-stone-950 sm:text-6xl">
              A calmer way to run the residence.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-stone-600">
              HostelHub brings rooms, allocations, student records, and maintenance work into a practical daily workspace for hostel teams.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/login" className="rounded-xl bg-blue-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-900">
                Open workspace
              </Link>
              <Link href="/rooms" className="rounded-xl border border-stone-300 bg-white px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-400 hover:bg-stone-50">
                Browse room data
              </Link>
            </div>
          </div>

          <div className="rounded-3xl border border-stone-200 bg-white p-6 sm:p-8">
            <div className="flex items-center justify-between border-b border-stone-200 pb-5">
              <div>
                <p className="text-sm font-semibold text-stone-950">Today&apos;s workspace</p>
                <p className="mt-1 text-xs text-stone-500">Live data after sign in</p>
              </div>
               <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-blue-950">Secure workspace</span>
            </div>
            <div className="grid gap-3 pt-5 sm:grid-cols-2">
              <div className="rounded-2xl bg-stone-50 p-4">
                <p className="text-xs text-stone-500">Room operations</p>
                <p className="mt-2 font-semibold text-stone-900">Availability and allocations</p>
              </div>
              <div className="rounded-2xl bg-stone-50 p-4">
                <p className="text-xs text-stone-500">Service desk</p>
                <p className="mt-2 font-semibold text-stone-900">Complaints and follow-up</p>
              </div>
            </div>
            <div className="mt-5 border-t border-stone-200 pt-5">
               <Suspense fallback={<p className="text-sm text-stone-500">Checking workspace status…</p>}>
                <BackendStatus />
              </Suspense>
            </div>
          </div>
        </section>

        <section className="grid gap-4 border-t border-stone-200 py-12 md:grid-cols-3 lg:py-16">
          {features.map(([title, description]) => (
            <article key={title} className="rounded-2xl border border-stone-200 bg-white p-5">
              <h2 className="font-semibold text-stone-950">{title}</h2>
              <p className="mt-3 text-sm leading-6 text-stone-600">{description}</p>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}
