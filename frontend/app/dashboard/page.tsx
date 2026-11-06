import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import AllocationManager from "@/components/AllocationManager";
import { AppShell, Notice, PageIntro, StatCard, StatusPill } from "@/components/AppShell";
import { djangoFetch } from "@/lib/django";
import { listData, type Paginated } from "@/lib/list";
import type { AuthUser, DashboardSummary, Room } from "@/lib/types";

async function DashboardContent() {
  const [meResponse, summaryResponse, roomsResponse] = await Promise.all([
    djangoFetch<AuthUser>("/api/auth/me/"),
    djangoFetch<DashboardSummary>("/api/dashboard/summary/"),
    djangoFetch<Room[] | Paginated<Room>>("/api/rooms/"),
  ]);

  if ([meResponse, summaryResponse, roomsResponse].some((response) => response.status === 401)) redirect("/login");
  if (meResponse.status === 403) return <Notice tone="warning">Your account is not linked to a HostelHub role. Ask an administrator to provision it.</Notice>;
  if (!summaryResponse.data || !meResponse.data) return <Notice tone="error">Unable to load dashboard data. Please try again shortly.</Notice>;

  const rooms = listData(roomsResponse.data);
  const summary = summaryResponse.data;
  const role = meResponse.data.role;

  const isStudent = role === "Student";
  const dashboardCards: Array<[string, number, string]> = isStudent
    ? [
        ["My complaints", summary.total_complaints, "Submitted by you"],
        ["Open", summary.open_complaints, "Awaiting action"],
        ["In progress", summary.in_progress_complaints, "Being worked on"],
        ["Resolved", summary.resolved_complaints, "Completed requests"],
      ]
    : role === "Maintenance"
      ? [
          ["Assigned work", summary.total_complaints, "Complaints assigned to you"],
          ["Open", summary.open_complaints, "Waiting to be started"],
          ["In progress", summary.in_progress_complaints, "Currently being worked on"],
          ["Completed", summary.completed_complaints, "Ready for hostel verification"],
        ]
      : role === "Admin"
        ? [
            ["Students", summary.total_students, "Registered student records"],
            ["Hostel blocks", summary.hostels, `${summary.total_rooms} rooms in the system`],
            ["Capacity", summary.total_capacity, `${summary.occupied_beds} beds occupied`],
            ["Open complaints", summary.open_complaints, `${summary.urgent_complaints} urgent`],
          ]
    : [
        ["Rooms", summary.total_rooms, `${summary.hostels} hostel blocks`],
        ["Total capacity", summary.total_capacity, `${summary.occupied_beds} beds occupied`],
        ["Available beds", summary.available_beds, `${summary.available_rooms} rooms accepting allocations`],
        ["Open complaints", summary.open_complaints, `${summary.urgent_complaints} urgent`],
      ];

  return (
    <>
      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {dashboardCards.map(([label, value, detail], index) => <StatCard key={label} label={label} value={value} detail={detail} accent={isStudent ? index === 0 : index === 2} />)}
      </section>

      {isStudent && <section className="mt-8 rounded-2xl border border-stone-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-900">My accommodation</p><h2 className="mt-2 text-xl font-semibold text-stone-950">{summary.current_allocation ? `${summary.current_allocation.hostel_name} · Room ${summary.current_allocation.room_number}` : "No active room assignment"}</h2><p className="mt-1 text-sm text-stone-500">{summary.student_name ? `${summary.student_name} · ${summary.student_department || "Student"}` : "Your current accommodation details"}</p></div>
          {summary.current_allocation && <StatusPill value={summary.current_allocation.status} />}
        </div>
        {summary.current_allocation ? <dl className="mt-6 grid gap-4 border-t border-stone-200 pt-5 sm:grid-cols-3"><div><dt className="text-xs text-stone-500">Room type</dt><dd className="mt-1 font-medium text-stone-800">{summary.current_allocation.room_type}</dd></div><div><dt className="text-xs text-stone-500">Academic year</dt><dd className="mt-1 font-medium text-stone-800">{summary.current_allocation.academic_year}</dd></div><div><dt className="text-xs text-stone-500">Allocated on</dt><dd className="mt-1 font-medium text-stone-800">{summary.current_allocation.allocation_date}</dd></div></dl> : <p className="mt-5 border-t border-stone-200 pt-5 text-sm text-stone-500">Contact your hostel office if you need an accommodation assignment.</p>}
      </section>}

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        {[
          ["Rooms", isStudent ? "View your current room details." : "Review occupancy, availability, and rent.", "/rooms"],
          ["Hostels", "Browse accommodation blocks and room inventory.", "/hostels"],
          ["Complaints", isStudent ? "Submit and track your maintenance requests." : "Track service issues and resolution work.", "/complaints"],
        ].map(([title, description, href]) => (
          <Link key={href} href={href} className="group rounded-2xl border border-stone-200 bg-white p-5 transition hover:border-blue-300 hover:bg-sky-50">
            <h2 className="font-semibold text-stone-950 group-hover:text-blue-950">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-stone-600">{description}</p>
            <span className="mt-4 inline-block text-sm font-semibold text-blue-900">Open module →</span>
          </Link>
        ))}
      </section>

      {role === "Admin" || role === "Warden" ? (
        <section className="mt-8"><AllocationManager role={role} /></section>
      ) : role === "Maintenance" ? (
        <section className="mt-8"><Notice tone="info">Your assigned maintenance complaints and work locations are available in the Complaints workspace.</Notice></section>
      ) : !isStudent ? (
        <section className="mt-8"><Notice tone="info">Allocation and management actions are restricted to authorized hostel staff.</Notice></section>
      ) : null}

      {!isStudent && <section className="mt-8 rounded-2xl border border-stone-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 px-5 py-4">
          <div><h2 className="font-semibold text-stone-950">Room snapshot</h2><p className="mt-1 text-sm text-stone-500">A quick view of the live room records.</p></div>
          <Link href="/rooms" className="text-sm font-semibold text-blue-900 hover:text-blue-950">View all rooms</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500"><tr><th className="px-5 py-3 font-semibold">Room</th><th className="px-5 py-3 font-semibold">Hostel</th><th className="px-5 py-3 font-semibold">Type</th><th className="px-5 py-3 font-semibold">Occupancy</th><th className="px-5 py-3 font-semibold">Status</th></tr></thead>
            <tbody>
              {rooms.slice(0, 8).map((room) => <tr key={room.room_id} className="border-t border-stone-100"><td className="px-5 py-4 font-semibold text-stone-900">{room.room_number}</td><td className="px-5 py-4 text-stone-600">{room.hostel_name || `Hostel ${room.hostel_id}`}</td><td className="px-5 py-4 text-stone-600">{room.room_type}</td><td className="px-5 py-4 text-stone-600">{room.current_occupancy}/{room.capacity}</td><td className="px-5 py-4"><StatusPill value={room.is_available ? "Available" : room.status} /></td></tr>)}
              {rooms.length === 0 && <tr><td colSpan={5} className="px-5 py-10 text-center text-stone-500">No room records found.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>}
    </>
  );
}

export default function DashboardPage() {
  return (
    <AppShell>
      <PageIntro eyebrow="Operations overview" title="Dashboard" description="A clear view of accommodation capacity and the work that needs attention today." />
      <Suspense fallback={<div className="mt-8 rounded-2xl border border-blue-100 bg-blue-50/70 p-8 text-sm text-stone-500">Loading dashboard…</div>}><DashboardContent /></Suspense>
    </AppShell>
  );
}
