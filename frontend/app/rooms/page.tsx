import { Suspense } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";

import { AppShell, Notice, PageIntro, StatCard } from "@/components/AppShell";
import RoomCard from "@/components/RoomCard";
import { djangoFetch } from "@/lib/django";
import { listData, type Paginated } from "@/lib/list";
import type { AuthUser, Room } from "@/lib/types";

type RoomsPageProps = {
  searchParams: Promise<{ hostel_id?: string }>;
};

async function RoomsContent({ searchParams }: RoomsPageProps) {
  const params = await searchParams;
  const hostelId = params.hostel_id;
  const endpoint = hostelId
    ? `/api/rooms/?hostel_id=${encodeURIComponent(hostelId)}`
    : "/api/rooms/";
  const [userResponse, response] = await Promise.all([
    djangoFetch<AuthUser>("/api/auth/me/"),
    djangoFetch<Room[] | Paginated<Room>>(endpoint),
  ]);

  if (userResponse.status === 401 || response.status === 401) redirect("/login");
  if (response.status === 403) return <Notice tone="warning">You do not have permission to view these rooms.</Notice>;
  if (!response.data) return <Notice tone="error">Unable to load rooms. Please try again shortly.</Notice>;

  const rooms = listData(response.data);
  const totalCapacity = rooms.reduce((total, room) => total + Number(room.capacity), 0);
  const occupiedBeds = rooms.reduce((total, room) => total + Number(room.current_occupancy), 0);
  const availableBeds = rooms.reduce((total, room) => total + (room.is_available ? Number(room.vacant_seats) : 0), 0);

  return (
    <>
      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Rooms" value={rooms.length} />
        <StatCard label="Total capacity" value={totalCapacity} />
        <StatCard label="Occupied beds" value={occupiedBeds} />
        <StatCard label="Available beds" value={availableBeds} accent />
      </section>

      <section className="mt-10">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-stone-950">{hostelId ? `Rooms in hostel ${hostelId}` : "All rooms"}</h2>
            <p className="mt-1 text-sm text-stone-500">Review room capacity, occupancy, availability, and semester rent.</p>
          </div>
          {hostelId && <Link href="/rooms" className="text-sm font-semibold text-blue-900 hover:text-blue-950">View all rooms</Link>}
        </div>
        {rooms.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center text-sm text-stone-500">No rooms found for this selection.</div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{rooms.map((room) => <RoomCard key={room.room_id} room={room} canManageStatus={userResponse.data?.role === "Admin" || userResponse.data?.role === "Warden"} />)}</div>
        )}
      </section>
    </>
  );
}

export default function RoomsPage({ searchParams }: RoomsPageProps) {
  return (
    <AppShell>
      <PageIntro eyebrow="Accommodation" title="Rooms" description="Review room type, capacity, occupancy, rent, and available beds." />
      <Suspense fallback={<div className="mt-8 rounded-2xl border border-stone-200 bg-white p-8 text-sm text-stone-500">Loading room records…</div>}>
        <RoomsContent searchParams={searchParams} />
      </Suspense>
    </AppShell>
  );
}
