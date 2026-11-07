"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Notice } from "@/components/AppShell";
import { listData, type Paginated } from "@/lib/list";
import type { Allocation } from "@/lib/complaints";
import type { Room, Student } from "@/lib/types";

function errorText(value: unknown) {
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.error === "string") return record.error;
    if (typeof record.detail === "string") return record.detail;
    const first = Object.values(record).find((item) => typeof item === "string" || Array.isArray(item));
    if (typeof first === "string") return first;
    if (Array.isArray(first) && typeof first[0] === "string") return first[0];
  }
  return "The request could not be completed.";
}

export default function AllocationManager({ role }: { role: "Admin" | "Warden" }) {
  const router = useRouter();
  const [students, setStudents] = useState<Student[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [studentId, setStudentId] = useState("");
  const [roomId, setRoomId] = useState("");
  const [vacateStudentId, setVacateStudentId] = useState("");
  const [reassignStudentId, setReassignStudentId] = useState("");
  const [newRoomId, setNewRoomId] = useState("");
  const [academicYear, setAcademicYear] = useState(() => {
    const year = new Date().getFullYear();
    return `${year}-${year + 1}`;
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const responses = await Promise.all(
        ["students", "rooms", "allocations"].map((resource) => fetch(`/api/allocations?resource=${resource}`, { cache: "no-store" }))
      );
      const payloads = await Promise.all(responses.map(async (response) => ({ ok: response.ok, data: await response.json() as unknown })));
      const failed = payloads.find((payload) => !payload.ok);
      if (failed) throw new Error(errorText(failed.data));
      setStudents(listData(payloads[0].data as Student[] | Paginated<Student>));
      setRooms(listData(payloads[1].data as Room[] | Paginated<Room>));
      setAllocations(listData(payloads[2].data as Allocation[] | Paginated<Allocation>));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load allocation records.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    async function initialise() {
      await load();
    }
    void initialise();
  }, []);

  const activeAllocations = useMemo(() => allocations.filter((allocation) => allocation.status === "Allocated"), [allocations]);
  const allocatedStudentIds = useMemo(() => new Set(activeAllocations.map((allocation) => allocation.student)), [activeAllocations]);
  const unallocatedStudents = students.filter((student) => !allocatedStudentIds.has(student.student_id));
  const selectableRooms = rooms.filter((room) => room.is_available);

  async function submit(action: "create" | "vacate" | "reassign", payload: Record<string, unknown>) {
    setSaving(action);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/allocations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      });
      const data: unknown = await response.json();
      if (!response.ok) throw new Error(errorText(data));
      setMessage(action === "create" ? "Allocation created." : action === "vacate" ? "Room vacated." : "Room reassigned.");
      await load();
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The allocation request failed.");
    } finally {
      setSaving("");
    }
  }

  if (loading) return <div className="rounded-2xl border border-stone-200 bg-white p-6 text-sm text-stone-500">Loading allocation tools…</div>;

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-900">{role} tools</p>
          <h2 className="mt-2 text-xl font-semibold text-stone-950">Room allocation</h2>
          <p className="mt-1 text-sm text-stone-600">Every action is checked before it is saved.</p>
        </div>
        <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-600">{activeAllocations.length} active allocations</span>
      </div>
      {(error || message) && <div className="mt-5"><Notice tone={error ? "error" : "success"}>{error || message}</Notice></div>}

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <form className="rounded-xl border border-stone-200 p-4" onSubmit={(event) => { event.preventDefault(); void submit("create", { student_id: Number(studentId), room_id: Number(roomId), academic_year: academicYear }); }}>
          <h3 className="font-semibold text-stone-900">Allocate a room</h3>
          <div className="mt-4 space-y-3">
            <label className="block text-sm font-medium text-stone-700">Student<select required value={studentId} onChange={(event) => setStudentId(event.target.value)} className="mt-1.5 w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm"><option value="">Select student</option>{unallocatedStudents.map((student) => <option key={student.student_id} value={student.student_id}>{student.name} · #{student.student_id}</option>)}</select></label>
            <label className="block text-sm font-medium text-stone-700">Available room<select required value={roomId} onChange={(event) => setRoomId(event.target.value)} className="mt-1.5 w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm"><option value="">Select room</option>{selectableRooms.map((room) => <option key={room.room_id} value={room.room_id}>{room.room_number} · {room.hostel_name} ({room.vacant_seats} bed{room.vacant_seats === 1 ? "" : "s"})</option>)}</select></label>
            <label className="block text-sm font-medium text-stone-700">Academic year<input required pattern="\d{4}-\d{4}" value={academicYear} onChange={(event) => setAcademicYear(event.target.value)} className="mt-1.5 w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm" /></label>
          </div>
          <button disabled={saving !== "" || unallocatedStudents.length === 0 || selectableRooms.length === 0} className="mt-4 rounded-lg bg-blue-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-50">{saving === "create" ? "Allocating…" : "Allocate"}</button>
        </form>

        <form className="rounded-xl border border-stone-200 p-4" onSubmit={(event) => { event.preventDefault(); void submit("vacate", { student_id: Number(vacateStudentId) }); }}>
          <h3 className="font-semibold text-stone-900">Vacate a room</h3>
          <p className="mt-1 text-xs leading-5 text-stone-500">This keeps the allocation record as history.</p>
          <label className="mt-4 block text-sm font-medium text-stone-700">Active allocation<select required value={vacateStudentId} onChange={(event) => setVacateStudentId(event.target.value)} className="mt-1.5 w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm"><option value="">Select allocation</option>{activeAllocations.map((allocation) => <option key={allocation.allocation_id} value={allocation.student}>{allocation.student_name} · Room {allocation.room_number}</option>)}</select></label>
          <button disabled={saving !== "" || activeAllocations.length === 0} className="mt-4 rounded-lg border border-stone-300 px-4 py-2.5 text-sm font-semibold text-stone-700 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50">{saving === "vacate" ? "Vacating…" : "Vacate"}</button>
        </form>

        <form className="rounded-xl border border-stone-200 p-4" onSubmit={(event) => { event.preventDefault(); void submit("reassign", { student_id: Number(reassignStudentId), new_room_id: Number(newRoomId) }); }}>
          <h3 className="font-semibold text-stone-900">Reassign a room</h3>
          <label className="mt-4 block text-sm font-medium text-stone-700">Student<select required value={reassignStudentId} onChange={(event) => setReassignStudentId(event.target.value)} className="mt-1.5 w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm"><option value="">Select allocation</option>{activeAllocations.map((allocation) => <option key={allocation.allocation_id} value={allocation.student}>{allocation.student_name} · Room {allocation.room_number}</option>)}</select></label>
          <label className="mt-3 block text-sm font-medium text-stone-700">New room<select required value={newRoomId} onChange={(event) => setNewRoomId(event.target.value)} className="mt-1.5 w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm"><option value="">Select room</option>{selectableRooms.map((room) => <option key={room.room_id} value={room.room_id}>{room.room_number} · {room.hostel_name}</option>)}</select></label>
          <button disabled={saving !== "" || activeAllocations.length === 0 || selectableRooms.length === 0} className="mt-4 rounded-lg bg-stone-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-stone-900 disabled:cursor-not-allowed disabled:opacity-50">{saving === "reassign" ? "Reassigning…" : "Reassign"}</button>
        </form>
      </div>
    </section>
  );
}
