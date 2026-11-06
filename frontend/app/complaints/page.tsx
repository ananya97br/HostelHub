import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { AppShell, Notice, PageIntro, StatCard } from "@/components/AppShell";
import { ComplaintCard, ComplaintForm } from "@/components/ComplaintsClient";
import { djangoFetch } from "@/lib/django";
import type { Complaint, SemanticSearchResponse, Allocation } from "@/lib/complaints";
import { COMPLAINT_PRIORITIES, COMPLAINT_STATUSES, COMPLAINT_TYPES } from "@/lib/complaints";
import { listData, type Paginated } from "@/lib/list";
import type { AuthUser, Hostel, Staff } from "@/lib/types";

type ComplaintsPageProps = { searchParams: Promise<{ q?: string; status?: string; priority?: string; type?: string; hostel_id?: string; date_from?: string; date_to?: string }> };
type ComplaintResponse = Complaint[] | Paginated<Complaint> | SemanticSearchResponse;

function isSemanticResponse(value: ComplaintResponse): value is SemanticSearchResponse {
  return !Array.isArray(value) && "results" in value && "total_results" in value;
}

async function ComplaintsContent({ searchParams }: ComplaintsPageProps) {
  const params = await searchParams;
  const query = (params.q || "").trim();
  const statusFilter = COMPLAINT_STATUSES.includes(params.status as (typeof COMPLAINT_STATUSES)[number]) ? params.status : "";
  const priorityFilter = COMPLAINT_PRIORITIES.includes(params.priority as (typeof COMPLAINT_PRIORITIES)[number]) ? params.priority : "";
  const typeFilter = COMPLAINT_TYPES.includes(params.type as (typeof COMPLAINT_TYPES)[number]) ? params.type : "";
  const hostelFilter = params.hostel_id && /^\d+$/.test(params.hostel_id) ? params.hostel_id : "";
  const dateFromFilter = params.date_from && /^\d{4}-\d{2}-\d{2}$/.test(params.date_from) ? params.date_from : "";
  const dateToFilter = params.date_to && /^\d{4}-\d{2}-\d{2}$/.test(params.date_to) ? params.date_to : "";
  const queryParams = new URLSearchParams();
  if (statusFilter) queryParams.set("status", statusFilter);
  if (priorityFilter) queryParams.set("priority", priorityFilter);
  if (typeFilter) queryParams.set("type", typeFilter);
  if (hostelFilter) queryParams.set("hostel_id", hostelFilter);
  if (dateFromFilter) queryParams.set("date_from", dateFromFilter);
  if (dateToFilter) queryParams.set("date_to", dateToFilter);
  const complaintsEndpoint = query
    ? `/api/complaints/semantic-search/?q=${encodeURIComponent(query)}`
    : `/api/complaints/${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;

  const [userResponse, complaintsResponse, allocationsResponse, staffResponse, hostelsResponse] = await Promise.all([
    djangoFetch<AuthUser>("/api/auth/me/"),
    djangoFetch<ComplaintResponse>(complaintsEndpoint),
    djangoFetch<Allocation[] | Paginated<Allocation>>("/api/allocations/"),
    djangoFetch<Staff[] | Paginated<Staff>>("/api/staff/"),
    djangoFetch<Hostel[] | Paginated<Hostel>>("/api/hostels/"),
  ]);

  if ([userResponse, complaintsResponse].some((response) => response.status === 401)) redirect("/login");
  if (!userResponse.data) return <Notice tone="warning">Your account is not linked to a HostelHub role.</Notice>;
  if (complaintsResponse.status === 403) return <Notice tone="warning">You do not have permission to view complaint records.</Notice>;
  if (!complaintsResponse.data) return <Notice tone="error">Complaint data is temporarily unavailable. Please try again shortly.</Notice>;

  const user = userResponse.data;
  let complaints = isSemanticResponse(complaintsResponse.data) ? complaintsResponse.data.results : listData(complaintsResponse.data);
  if (query) {
    if (statusFilter) complaints = complaints.filter((complaint) => complaint.status === statusFilter);
    if (priorityFilter) complaints = complaints.filter((complaint) => complaint.priority === priorityFilter);
    if (typeFilter) complaints = complaints.filter((complaint) => complaint.complaint_type === typeFilter);
    if (hostelFilter) complaints = complaints.filter((complaint) => complaint.hostel_id === Number(hostelFilter));
    if (dateFromFilter) complaints = complaints.filter((complaint) => !complaint.date_filed || complaint.date_filed >= dateFromFilter);
    if (dateToFilter) complaints = complaints.filter((complaint) => !complaint.date_filed || complaint.date_filed <= dateToFilter);
  }
  const allocations = listData(allocationsResponse.data).filter((allocation) => allocation.status === "Allocated");
  const staff = listData(staffResponse.data);
  const hostels = listData(hostelsResponse.data);
  const openCount = complaints.filter((complaint) => complaint.status === "Open" || complaint.status === "In-Progress").length;
  const completedCount = complaints.filter((complaint) => complaint.status === "Completed").length;
  const resolvedCount = complaints.filter((complaint) => complaint.status === "Resolved").length;
  const highPriorityCount = complaints.filter((complaint) => complaint.priority === "High").length;

  return (
    <>
      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Matching complaints" value={complaints.length} detail={query ? "From semantic results" : "Current filter"} />
        <StatCard label="Open in view" value={openCount} />
        <StatCard label="Work completed" value={completedCount} />
        <StatCard label="Resolved in view" value={resolvedCount} accent />
      </section>
      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(280px,360px)_1fr]">
        <div className="space-y-5">
          {user.role === "Maintenance" ? <Notice tone="info">Your role can update complaints assigned to you. New complaints are submitted by students or authorized hostel staff.</Notice> : <ComplaintForm allocations={allocations} user={user} />}
          <section className="rounded-2xl border border-stone-200 bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-900">Triage shortcuts</p>
            <h2 className="mt-2 font-semibold text-stone-950">Jump to a queue</h2>
            <div className="mt-4 grid gap-2">
              <Link href="/complaints?status=Open" className="flex items-center justify-between rounded-xl border border-stone-200 px-3 py-3 text-sm font-medium text-stone-700 hover:border-blue-900 hover:bg-sky-50"><span>New complaints</span><span className="text-stone-500">{complaints.filter((complaint) => complaint.status === "Open").length}</span></Link>
              <Link href="/complaints?status=In-Progress" className="flex items-center justify-between rounded-xl border border-stone-200 px-3 py-3 text-sm font-medium text-stone-700 hover:border-blue-900 hover:bg-sky-50"><span>In progress</span><span className="text-stone-500">{complaints.filter((complaint) => complaint.status === "In-Progress").length}</span></Link>
              <Link href="/complaints?priority=High" className="flex items-center justify-between rounded-xl border border-stone-200 px-3 py-3 text-sm font-medium text-stone-700 hover:border-blue-900 hover:bg-sky-50"><span>High priority</span><span className="text-stone-500">{highPriorityCount}</span></Link>
              <Link href="/complaints?status=Resolved" className="flex items-center justify-between rounded-xl border border-stone-200 px-3 py-3 text-sm font-medium text-stone-700 hover:border-blue-900 hover:bg-sky-50"><span>Resolved recently</span><span className="text-stone-500">{resolvedCount}</span></Link>
            </div>
          </section>
        </div>
        <section>
          <div className="rounded-2xl border border-stone-200 bg-white p-5">
            <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-semibold text-stone-950">Complaint records</h2><p className="mt-1 text-sm text-stone-500">Browse maintenance issues relevant to your workspace.</p></div>{query && <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-blue-950">Semantic search</span>}</div>
            <form action="/complaints" method="GET" className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="sm:col-span-2 lg:col-span-4"><span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-stone-500">Search complaint text</span><input name="q" type="search" maxLength={500} defaultValue={query} placeholder="e.g. water leaking near the sink" className="w-full rounded-xl border border-stone-300 px-3 py-3 text-sm outline-none placeholder:text-stone-400 focus:border-blue-900 focus:ring-4 focus:ring-blue-100" /></label>
              <label><span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-stone-500">Status</span><select name="status" defaultValue={statusFilter} className="w-full rounded-xl border border-stone-300 bg-white px-3 py-3 text-sm"><option value="">All statuses</option>{COMPLAINT_STATUSES.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
              <label><span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-stone-500">Priority</span><select name="priority" defaultValue={priorityFilter} className="w-full rounded-xl border border-stone-300 bg-white px-3 py-3 text-sm"><option value="">All priorities</option>{COMPLAINT_PRIORITIES.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
              <label><span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-stone-500">Category</span><select name="type" defaultValue={typeFilter} className="w-full rounded-xl border border-stone-300 bg-white px-3 py-3 text-sm"><option value="">All categories</option>{COMPLAINT_TYPES.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
              <label><span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-stone-500">Hostel</span><select name="hostel_id" defaultValue={hostelFilter} className="w-full rounded-xl border border-stone-300 bg-white px-3 py-3 text-sm"><option value="">All hostels</option>{hostels.map((hostel) => <option key={hostel.hostel_id} value={hostel.hostel_id}>{hostel.hostel_name}</option>)}</select></label>
              <label><span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-stone-500">From</span><input name="date_from" type="date" defaultValue={dateFromFilter} className="w-full rounded-xl border border-stone-300 bg-white px-3 py-3 text-sm" /></label>
              <label><span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-stone-500">To</span><input name="date_to" type="date" defaultValue={dateToFilter} className="w-full rounded-xl border border-stone-300 bg-white px-3 py-3 text-sm" /></label>
              <div className="flex items-end gap-2"><button type="submit" className="rounded-xl bg-blue-950 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-900">Apply</button><Link href="/complaints" className="rounded-xl border border-stone-300 px-4 py-3 text-sm font-semibold text-stone-700 hover:bg-sky-50">Reset</Link></div>
            </form>
          </div>
          {complaints.length === 0 ? <div className="mt-5 rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center text-sm text-stone-500">No matching complaints found.</div> : <div className="mt-5 space-y-4">{complaints.map((complaint) => <ComplaintCard key={complaint.complaint_id} complaint={complaint} user={user} staff={staff} />)}</div>}
        </section>
      </div>
    </>
  );
}

export default function ComplaintsPage({ searchParams }: ComplaintsPageProps) {
  return <AppShell><PageIntro eyebrow="Service desk" title="Complaints" description="Submit, search, assign, and resolve maintenance issues without exposing records outside your role." /><Suspense fallback={<div className="mt-8 rounded-2xl border border-stone-200 bg-white p-8 text-sm text-stone-500">Loading complaint records…</div>}><ComplaintsContent searchParams={searchParams} /></Suspense></AppShell>;
}
