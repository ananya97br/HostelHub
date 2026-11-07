"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import type { Room } from "@/lib/types";
import { StatusPill } from "@/components/AppShell";

type RoomCardProps = {
  room: Room;
  canManageStatus?: boolean;
};

export default function RoomCard({ room, canManageStatus = false }: RoomCardProps) {
  const router = useRouter();
  const [status, setStatus] = useState(room.status);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const capacity = Number(room.capacity) || 0;
  const occupancy = Number(room.current_occupancy) || 0;

  const vacantSeats = Math.max(0, capacity - occupancy);

  const occupancyPercentage =
    capacity > 0
      ? Math.min(100, Math.max(0, (occupancy / capacity) * 100))
      : 0;

  const isAvailable =
    status?.toLowerCase() === "available" &&
    vacantSeats > 0;

  const rent = Number(room.rent_per_semester) || 0;

  return (
    <article className="rounded-2xl border border-stone-200 bg-white p-5 transition hover:border-stone-300">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-stone-950">
            Room {room.room_number}
          </h3>

          <p className="mt-1 text-sm text-stone-500">
            {room.hostel_name || `Hostel ${room.hostel_id}`}
          </p>
        </div>

        <StatusPill value={isAvailable ? "Available" : status} />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-stone-500">Room Type</p>
          <p className="mt-1 text-sm font-medium text-stone-900">
            {room.room_type}
          </p>
        </div>

        <div>
          <p className="text-xs text-stone-500">Floor</p>
          <p className="mt-1 text-sm font-medium text-stone-900">
            {room.floor_number}
          </p>
        </div>

        <div>
          <p className="text-xs text-stone-500">Capacity</p>
          <p className="mt-1 text-sm font-medium text-stone-900">
            {capacity}
          </p>
        </div>

        <div>
          <p className="text-xs text-stone-500">Vacant Beds</p>
          <p className="mt-1 text-sm font-medium text-blue-900">
            {isAvailable ? vacantSeats : 0}
          </p>
        </div>
      </div>

      <div className="mt-6">
          <div className="mb-2 flex justify-between text-xs text-stone-500">
          <span>Occupancy</span>
          <span>
            {occupancy}/{capacity}
          </span>
        </div>

        <div className="h-2 overflow-hidden rounded-full bg-stone-100">
          <div
            className="h-full rounded-full bg-blue-800"
            style={{ width: `${occupancyPercentage}%` }}
          />
        </div>
      </div>

      <div className="mt-6 border-t border-stone-200 pt-4">
        <p className="text-xs text-stone-500">
          Rent per Semester
        </p>

        <p className="mt-1 text-lg font-semibold text-stone-950">
          ₹{rent.toLocaleString("en-IN")}
        </p>
      </div>
      {canManageStatus && <div className="mt-5 border-t border-stone-200 pt-4"><label className="block text-xs font-semibold uppercase tracking-wide text-stone-500">Room status<select value={status} onChange={(event) => setStatus(event.target.value)} className="mt-1.5 w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm font-normal normal-case tracking-normal text-stone-900"><option value="Available">Available</option><option value="Blocked">Blocked</option><option value="Under Maintenance">Under maintenance</option>{status === "Full" && <option value="Full">Full</option>}</select></label><button type="button" disabled={saving || status === room.status} onClick={async () => { setSaving(true); setMessage(""); try { const response = await fetch("/api/rooms", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: room.room_id, status }) }); const data = await response.json() as { detail?: string; error?: string; status?: string }; if (!response.ok) throw new Error(data.detail || data.error || "Unable to update room status."); setMessage("Status updated."); router.refresh(); } catch (caught) { setMessage(caught instanceof Error ? caught.message : "Unable to update room status."); } finally { setSaving(false); } }} className="mt-3 rounded-lg bg-blue-950 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-50">{saving ? "Saving…" : "Save status"}</button>{message && <p className="mt-2 text-xs text-amber-800">{message}</p>}</div>}
    </article>
  );
}
