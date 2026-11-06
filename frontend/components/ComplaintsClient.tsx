"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";

import { Notice, StatusPill } from "@/components/AppShell";
import type { Allocation, Complaint } from "@/lib/complaints";
import { COMPLAINT_PRIORITIES, COMPLAINT_STATUSES, COMPLAINT_TYPES } from "@/lib/complaints";
import type { AuthUser, Staff } from "@/lib/types";

function getErrorMessage(data: unknown): string {
  if (data && typeof data === "object") {
    const result = data as Record<string, unknown>;
    if (typeof result.error === "string") return result.error;
    if (typeof result.detail === "string") return result.detail;
    const first = Object.values(result).find((value) => typeof value === "string" || Array.isArray(value));
    if (typeof first === "string") return first;
    if (Array.isArray(first) && typeof first[0] === "string") return first[0];
  }
  return "Request failed.";
}

export function ComplaintForm({ allocations, user }: { allocations: Allocation[]; user: AuthUser }) {
  const router = useRouter();
  const isStudent = user.role === "Student";
  const [allocationId, setAllocationId] = useState("");
  const [complaintType, setComplaintType] = useState<string>("Electrical");
  const [priority, setPriority] = useState<string>("Medium");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const currentAllocation = isStudent ? allocations[0] : null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!description.trim()) {
      setError("Complaint description is required.");
      return;
    }
    const allocation = allocations.find((item) => String(item.allocation_id) === allocationId);
    if (!isStudent && !allocation) {
      setError("Select an active student-room allocation.");
      return;
    }

    const body: Record<string, unknown> = { complaint_type: complaintType, description: description.trim() };
    if (!isStudent && allocation) {
      body.student = allocation.student;
      body.room = allocation.room;
      body.priority = priority;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/complaints", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data: unknown = await response.json();
      if (!response.ok) throw new Error(getErrorMessage(data));
      setMessage("Complaint submitted.");
      setDescription("");
      setAllocationId("");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to submit complaint.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-900">Service desk</p>
      <h2 className="mt-2 text-xl font-semibold text-stone-950">Register a complaint</h2>
      <p className="mt-2 text-sm leading-6 text-stone-600">{isStudent ? "This request will be linked to your current accommodation." : "Choose the active allocation this issue belongs to."}</p>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        {isStudent && currentAllocation && <div className="rounded-xl border border-blue-100 bg-sky-50/60 px-4 py-3 text-sm"><p className="font-semibold text-blue-950">{currentAllocation.student_name}</p><p className="mt-1 text-stone-600">Room {currentAllocation.room_number}{currentAllocation.hostel_name ? ` · ${currentAllocation.hostel_name}` : ""}</p></div>}
        {!isStudent && <label className="block text-sm font-medium text-stone-700">Student and room<select required value={allocationId} onChange={(event) => setAllocationId(event.target.value)} className="mt-1.5 w-full rounded-xl border border-stone-300 bg-white px-3 py-3 text-sm"><option value="">Select allocation</option>{allocations.map((allocation) => <option key={allocation.allocation_id} value={allocation.allocation_id}>{allocation.student_name} · Room {allocation.room_number}</option>)}</select></label>}
        <label className="block text-sm font-medium text-stone-700">Category<select value={complaintType} onChange={(event) => setComplaintType(event.target.value)} className="mt-1.5 w-full rounded-xl border border-stone-300 bg-white px-3 py-3 text-sm">{COMPLAINT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</select></label>
        {!isStudent && <label className="block text-sm font-medium text-stone-700">Priority<select value={priority} onChange={(event) => setPriority(event.target.value)} className="mt-1.5 w-full rounded-xl border border-stone-300 bg-white px-3 py-3 text-sm">{COMPLAINT_PRIORITIES.map((level) => <option key={level} value={level}>{level}</option>)}</select></label>}
        <label className="block text-sm font-medium text-stone-700">Description<textarea required maxLength={1000} rows={5} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe what needs attention…" className="mt-1.5 w-full resize-y rounded-xl border border-stone-300 px-3 py-3 text-sm outline-none placeholder:text-stone-400 focus:border-blue-900 focus:ring-4 focus:ring-blue-100" /></label>
        {error && <Notice tone="error">{error}</Notice>}
        {message && <Notice tone="success">{message}</Notice>}
        <button type="submit" disabled={loading || allocations.length === 0} className="rounded-xl bg-blue-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-50">{loading ? "Submitting…" : "Submit complaint"}</button>
        {allocations.length === 0 && <p className="text-xs text-amber-800">{isStudent ? "A current room allocation is required before submitting a complaint." : "No active allocations are available in your scope."}</p>}
      </form>
    </section>
  );
}

export function ComplaintActions({ complaint, user, staff }: { complaint: Complaint; user: AuthUser; staff: Staff[] }) {
  const router = useRouter();
  const maintenance = user.role === "Maintenance";
  const [complaintStatus, setComplaintStatus] = useState(complaint.status);
  const [priority, setPriority] = useState(complaint.priority);
  const [assignedTo, setAssignedTo] = useState(complaint.assigned_to ? String(complaint.assigned_to) : "");
  const [remarks, setRemarks] = useState(complaint.resolution_remarks || "");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  if (user.role === "Student") return null;

  const availableStatuses = maintenance
    ? COMPLAINT_STATUSES.filter((status) => status === "Open" || status === "In-Progress" || status === "Completed")
    : COMPLAINT_STATUSES;
  const maintenanceStaff = staff.filter((member) => member.role === "Maintenance");

  if (maintenance && (complaint.status === "Resolved" || complaint.status === "Rejected")) return null;

  async function handleUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if ((complaintStatus === "Completed" || complaintStatus === "Resolved" || complaintStatus === "Rejected") && !remarks.trim()) {
      setMessage("Remarks are required when completing, resolving, or rejecting a complaint.");
      return;
    }
    const payload: Record<string, unknown> = { complaint_id: complaint.complaint_id, status: complaintStatus, resolution_remarks: remarks.trim() };
    if (!maintenance) {
      payload.priority = priority;
      payload.assigned_to = assignedTo ? Number(assignedTo) : null;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/complaints", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data: unknown = await response.json();
      if (!response.ok) throw new Error(getErrorMessage(data));
      setMessage("Complaint updated.");
      router.refresh();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Unable to update complaint.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <details className="mt-5 border-t border-stone-200 pt-4">
      <summary className="cursor-pointer text-sm font-semibold text-blue-900">Manage complaint</summary>
      <form onSubmit={handleUpdate} className="mt-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-xs font-semibold uppercase tracking-wide text-stone-500">Status<select value={complaintStatus} onChange={(event) => setComplaintStatus(event.target.value)} className="mt-1.5 w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm font-normal normal-case tracking-normal text-stone-900">{availableStatuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
          {!maintenance && <label className="block text-xs font-semibold uppercase tracking-wide text-stone-500">Priority<select value={priority} onChange={(event) => setPriority(event.target.value)} className="mt-1.5 w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm font-normal normal-case tracking-normal text-stone-900">{COMPLAINT_PRIORITIES.map((level) => <option key={level} value={level}>{level}</option>)}</select></label>}
        </div>
        {!maintenance && <label className="block text-xs font-semibold uppercase tracking-wide text-stone-500">Assigned maintenance staff<select value={assignedTo} onChange={(event) => setAssignedTo(event.target.value)} className="mt-1.5 w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm font-normal normal-case tracking-normal text-stone-900"><option value="">Unassigned</option>{maintenanceStaff.map((member) => <option key={member.staff_id} value={member.staff_id}>{member.name}{member.hostel_name ? ` · ${member.hostel_name}` : ""}</option>)}</select></label>}
        <label className="block text-xs font-semibold uppercase tracking-wide text-stone-500">Work or resolution remarks<textarea value={remarks} onChange={(event) => setRemarks(event.target.value)} maxLength={500} rows={3} placeholder={maintenance ? "Add progress notes or completion details…" : "Required when resolving or rejecting…"} className="mt-1.5 w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm font-normal normal-case tracking-normal text-stone-900 placeholder:text-stone-400" /></label>
        {message && <p role="status" className="text-sm text-amber-800">{message}</p>}
        <button type="submit" disabled={loading} className="rounded-lg bg-stone-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-stone-900 disabled:cursor-not-allowed disabled:opacity-50">{loading ? "Saving…" : "Save changes"}</button>
      </form>
    </details>
  );
}

export function ComplaintCard({ complaint, user, staff }: { complaint: Complaint; user: AuthUser; staff: Staff[] }) {
  return (
    <article className="rounded-2xl border border-stone-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-xs text-stone-500">Complaint #{complaint.complaint_id}{complaint.date_filed ? ` · ${complaint.date_filed}` : ""}</p><h3 className="mt-1 text-lg font-semibold text-stone-950">{complaint.complaint_type}</h3><p className="mt-1 text-sm text-stone-500">Room {complaint.room_number}{complaint.hostel_name ? ` · ${complaint.hostel_name}` : ""}{complaint.student_name ? ` · ${complaint.student_name}` : ""}</p></div>
        <StatusPill value={complaint.status} />
      </div>
      <p className="mt-5 whitespace-pre-wrap text-sm leading-6 text-stone-700">{complaint.description}</p>
      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-stone-200 pt-4 text-sm text-stone-500"><span>Priority: <strong className="text-stone-800">{complaint.priority}</strong></span>{complaint.assigned_staff_name && <span>Assigned to: <strong className="text-stone-800">{complaint.assigned_staff_name}</strong></span>}{typeof complaint.similarity_score === "number" && <span className="text-blue-900">Relevance {complaint.similarity_score.toFixed(3)}</span>}</div>
      {complaint.resolution_remarks && <div className="mt-4 rounded-xl bg-emerald-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">{complaint.status === "Resolved" ? "Resolution" : "Work notes"}</p><p className="mt-2 text-sm leading-6 text-emerald-950">{complaint.resolution_remarks}</p></div>}
      <ComplaintActions complaint={complaint} user={user} staff={staff} />
    </article>
  );
}
