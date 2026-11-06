import { redirect } from "next/navigation";
import { Suspense } from "react";

import { AppShell, Notice, PageIntro, StatCard, StatusPill } from "@/components/AppShell";
import ReportExportButton from "@/components/ReportExportButton";
import { djangoFetch } from "@/lib/django";
import type { Complaint } from "@/lib/complaints";
import { listData, type Paginated } from "@/lib/list";
import type { AuthUser, DashboardSummary, Hostel, Room } from "@/lib/types";

async function ReportsContent() {
  const [userResponse, summaryResponse, roomsResponse, hostelsResponse, complaintsResponse] = await Promise.all([
    djangoFetch<AuthUser>("/api/auth/me/"),
    djangoFetch<DashboardSummary>("/api/dashboard/summary/"),
    djangoFetch<Room[] | Paginated<Room>>("/api/rooms/"),
    djangoFetch<Hostel[] | Paginated<Hostel>>("/api/hostels/"),
    djangoFetch<Complaint[] | Paginated<Complaint>>("/api/complaints/"),
  ]);
  if ([userResponse, summaryResponse].some((response) => response.status === 401)) redirect("/login");
  if (!userResponse.data || !["Admin", "Warden"].includes(userResponse.data.role || "")) return <Notice tone="warning">Reports are available to administrators and wardens.</Notice>;
  if (!summaryResponse.data || !roomsResponse.data || !hostelsResponse.data || !complaintsResponse.data) return <Notice tone="error">Unable to load the operational report.</Notice>;

  const summary = summaryResponse.data;
  const rooms = listData(roomsResponse.data);
  const hostels = listData(hostelsResponse.data);
  const complaints = listData(complaintsResponse.data);
  const roomByHostel = new Map(hostels.map((hostel) => [hostel.hostel_id, { hostel, rooms: rooms.filter((room) => room.hostel_id === hostel.hostel_id) }]));
  const occupancyRows = Array.from(roomByHostel.values()).map(({ hostel, rooms: hostelRooms }) => {
    const capacity = hostelRooms.reduce((total, room) => total + Number(room.capacity), 0);
    const occupied = hostelRooms.reduce((total, room) => total + Number(room.current_occupancy), 0);
    return { hostel: hostel.hostel_name, occupied, capacity, occupancy: capacity ? `${Math.round((occupied / capacity) * 100)}%` : "0%" };
  });
  const complaintRows = Array.from(new Set(complaints.map((complaint) => complaint.complaint_type))).map((type) => ({ category: type, complaints: complaints.filter((complaint) => complaint.complaint_type === type).length }));
  const exportRows = complaints.map((complaint) => ({ id: complaint.complaint_id, category: complaint.complaint_type, room: complaint.room_number, hostel: complaint.hostel_name || "", priority: complaint.priority, status: complaint.status }));

  return <><section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><StatCard label="Students" value={summary.total_students} /><StatCard label="Hostel blocks" value={summary.hostels} /><StatCard label="Occupancy" value={`${summary.occupied_beds}/${summary.total_capacity}`} detail={`${summary.available_beds} beds available`} accent /><StatCard label="Total complaints" value={summary.total_complaints} detail={`${summary.urgent_complaints} urgent`} /></section><div className="mt-8 grid gap-8 lg:grid-cols-2"><section className="overflow-hidden rounded-2xl border border-stone-200 bg-white"><div className="flex items-center justify-between gap-3 border-b border-stone-200 px-5 py-5"><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-900">Accommodation</p><h2 className="mt-2 text-xl font-semibold text-stone-950">Hostel occupancy</h2></div><ReportExportButton rows={occupancyRows} /></div>{occupancyRows.length === 0 ? <p className="p-6 text-sm text-stone-500">No occupancy records are available.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500"><tr><th className="px-5 py-3 font-semibold">Hostel</th><th className="px-5 py-3 font-semibold">Occupied</th><th className="px-5 py-3 font-semibold">Capacity</th><th className="px-5 py-3 font-semibold">Rate</th></tr></thead><tbody>{occupancyRows.map((row) => <tr key={row.hostel} className="border-t border-stone-100"><td className="px-5 py-4 font-medium text-stone-800">{row.hostel}</td><td className="px-5 py-4 text-stone-600">{row.occupied}</td><td className="px-5 py-4 text-stone-600">{row.capacity}</td><td className="px-5 py-4 font-semibold text-blue-900">{row.occupancy}</td></tr>)}</tbody></table></div>}</section><section className="overflow-hidden rounded-2xl border border-stone-200 bg-white"><div className="flex items-center justify-between gap-3 border-b border-stone-200 px-5 py-5"><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-900">Service desk</p><h2 className="mt-2 text-xl font-semibold text-stone-950">Complaint categories</h2></div><ReportExportButton rows={complaintRows} /></div>{complaintRows.length === 0 ? <p className="p-6 text-sm text-stone-500">No complaint records are available.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500"><tr><th className="px-5 py-3 font-semibold">Category</th><th className="px-5 py-3 font-semibold">Records</th></tr></thead><tbody>{complaintRows.map((row) => <tr key={row.category} className="border-t border-stone-100"><td className="px-5 py-4 font-medium text-stone-800">{row.category}</td><td className="px-5 py-4 text-stone-600">{row.complaints}</td></tr>)}</tbody></table></div>}</section></div><section className="mt-8 overflow-hidden rounded-2xl border border-stone-200 bg-white"><div className="flex flex-wrap items-end justify-between gap-3 border-b border-stone-200 px-5 py-5"><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-900">Recent activity</p><h2 className="mt-2 text-xl font-semibold text-stone-950">Complaint overview</h2></div><ReportExportButton rows={exportRows} /></div>{complaints.length === 0 ? <p className="p-6 text-sm text-stone-500">No complaint records are available.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500"><tr><th className="px-5 py-3 font-semibold">Complaint</th><th className="px-5 py-3 font-semibold">Location</th><th className="px-5 py-3 font-semibold">Priority</th><th className="px-5 py-3 font-semibold">Status</th></tr></thead><tbody>{complaints.slice(0, 12).map((complaint) => <tr key={complaint.complaint_id} className="border-t border-stone-100"><td className="px-5 py-4"><p className="font-medium text-stone-800">#{complaint.complaint_id} · {complaint.complaint_type}</p><p className="mt-0.5 text-xs text-stone-500">{complaint.description}</p></td><td className="px-5 py-4 text-stone-600">Room {complaint.room_number} · {complaint.hostel_name || "Hostel"}</td><td className="px-5 py-4 text-stone-600">{complaint.priority}</td><td className="px-5 py-4"><StatusPill value={complaint.status} /></td></tr>)}</tbody></table></div>}</section></>;
}

export default function ReportsPage() {
  return <AppShell><PageIntro eyebrow="Insights" title="Reports" description="Review occupancy and maintenance activity for the hostels you manage." /><Suspense fallback={<div className="mt-8 rounded-2xl border border-stone-200 bg-white p-8 text-sm text-stone-500">Loading reports…</div>}><ReportsContent /></Suspense></AppShell>;
}
