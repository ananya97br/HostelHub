"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";

import { Notice, StatusPill } from "@/components/AppShell";
import type { DormRole } from "@/lib/types";

type ProfileData = {
  username: string;
  role: DormRole | null;
  student_id: number | null;
  staff_id: number | null;
  student: {
    name: string;
    department: string;
    year_of_study: number;
    contact_number: string;
    email: string;
    guardian_name?: string | null;
    guardian_contact?: string | null;
    special_requirements?: string | null;
  } | null;
  staff: {
    name: string;
    role: string;
    email?: string | null;
    hostel_name?: string | null;
  } | null;
  current_allocation: {
    room_number: string;
    room_type: string;
    hostel_name?: string;
    academic_year: string;
    allocation_date?: string;
    status: string;
  } | null;
};

function errorText(value: unknown) {
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.error === "string") return record.error;
    if (typeof record.detail === "string") return record.detail;
    const first = Object.values(record).find((item) => typeof item === "string" || Array.isArray(item));
    if (typeof first === "string") return first;
    if (Array.isArray(first) && typeof first[0] === "string") return first[0];
  }
  return "Unable to save your profile.";
}

export default function ProfilePanel({ profile }: { profile: ProfileData }) {
  const router = useRouter();
  const student = profile.student;
  const [contactNumber, setContactNumber] = useState(student?.contact_number || "");
  const [email, setEmail] = useState(student?.email || "");
  const [guardianName, setGuardianName] = useState(student?.guardian_name || "");
  const [guardianContact, setGuardianContact] = useState(student?.guardian_contact || "");
  const [specialRequirements, setSpecialRequirements] = useState(student?.special_requirements || "");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");
    const payload: Record<string, string> = {};
    if (password) payload.password = password;
    if (profile.role === "Student") {
      payload.contact_number = contactNumber.trim();
      payload.email = email.trim();
      payload.guardian_name = guardianName.trim();
      payload.guardian_contact = guardianContact.trim();
      payload.special_requirements = specialRequirements.trim();
    }
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data: unknown = await response.json();
      if (!response.ok) throw new Error(errorText(data));
      setPassword("");
      setMessage("Profile updated successfully.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save your profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(300px,380px)_1fr]">
      <section className="rounded-2xl border border-stone-200 bg-white p-6">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-950 text-lg font-bold text-white">{profile.username.slice(0, 1).toUpperCase()}</div>
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.14em] text-blue-900">Account</p>
        <h2 className="mt-2 text-2xl font-semibold text-stone-950">{student?.name || profile.staff?.name || profile.username}</h2>
        <p className="mt-1 text-sm text-stone-500">@{profile.username}</p>
        <span className="mt-5 inline-flex rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800">{profile.role || "Unassigned"}</span>

        <dl className="mt-6 space-y-4 border-t border-stone-200 pt-5 text-sm">
          {profile.student_id && <div className="flex justify-between gap-4"><dt className="text-stone-500">Student ID</dt><dd className="font-medium text-stone-800">#{profile.student_id}</dd></div>}
          {profile.staff_id && <div className="flex justify-between gap-4"><dt className="text-stone-500">Staff ID</dt><dd className="font-medium text-stone-800">#{profile.staff_id}</dd></div>}
          {profile.staff?.hostel_name && <div className="flex justify-between gap-4"><dt className="text-stone-500">Assigned hostel</dt><dd className="text-right font-medium text-stone-800">{profile.staff.hostel_name}</dd></div>}
          {student && <div className="flex justify-between gap-4"><dt className="text-stone-500">Department</dt><dd className="font-medium text-stone-800">{student.department}</dd></div>}
          {student && <div className="flex justify-between gap-4"><dt className="text-stone-500">Year</dt><dd className="font-medium text-stone-800">Year {student.year_of_study}</dd></div>}
        </dl>
      </section>

      <div className="space-y-6">
        {student && <section className="rounded-2xl border border-stone-200 bg-white p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-900">Personal information</p>
          <h2 className="mt-2 text-xl font-semibold text-stone-950">Keep your details current</h2>
          <form onSubmit={handleSubmit} className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium text-stone-700">Phone number<input required value={contactNumber} onChange={(event) => setContactNumber(event.target.value)} className="mt-1.5 w-full rounded-xl border border-stone-300 px-3 py-3 text-sm" /></label>
            <label className="block text-sm font-medium text-stone-700">Email address<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1.5 w-full rounded-xl border border-stone-300 px-3 py-3 text-sm" /></label>
            <label className="block text-sm font-medium text-stone-700">Guardian name<input value={guardianName} onChange={(event) => setGuardianName(event.target.value)} className="mt-1.5 w-full rounded-xl border border-stone-300 px-3 py-3 text-sm" /></label>
            <label className="block text-sm font-medium text-stone-700">Guardian contact<input value={guardianContact} onChange={(event) => setGuardianContact(event.target.value)} className="mt-1.5 w-full rounded-xl border border-stone-300 px-3 py-3 text-sm" /></label>
            <label className="block text-sm font-medium text-stone-700 sm:col-span-2">Special requirements<textarea maxLength={200} rows={3} value={specialRequirements} onChange={(event) => setSpecialRequirements(event.target.value)} className="mt-1.5 w-full resize-y rounded-xl border border-stone-300 px-3 py-3 text-sm" /></label>
            <PasswordField password={password} setPassword={setPassword} />
            {error && <div className="sm:col-span-2"><Notice tone="error">{error}</Notice></div>}
            {message && <div className="sm:col-span-2"><Notice tone="success">{message}</Notice></div>}
            <div className="sm:col-span-2"><button type="submit" disabled={saving} className="rounded-xl bg-blue-950 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-60">{saving ? "Saving…" : "Save profile"}</button></div>
          </form>
        </section>}

        {!student && <section className="rounded-2xl border border-stone-200 bg-white p-6"><Notice tone="info">Your role and staff assignment are managed by an administrator. You can use the form below to change your password.</Notice><form onSubmit={handleSubmit} className="mt-5 max-w-md"><PasswordField password={password} setPassword={setPassword} /><button type="submit" disabled={saving} className="mt-4 rounded-xl bg-blue-950 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-60">{saving ? "Saving…" : "Change password"}</button>{error && <div className="mt-4"><Notice tone="error">{error}</Notice></div>}{message && <div className="mt-4"><Notice tone="success">{message}</Notice></div>}</form></section>}

        {profile.current_allocation && <section className="rounded-2xl border border-stone-200 bg-white p-6"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-900">Accommodation</p><h2 className="mt-2 text-xl font-semibold text-stone-950">{profile.current_allocation.hostel_name} · Room {profile.current_allocation.room_number}</h2></div><StatusPill value={profile.current_allocation.status} /></div><dl className="mt-5 grid gap-4 border-t border-stone-200 pt-5 sm:grid-cols-3"><div><dt className="text-xs text-stone-500">Room type</dt><dd className="mt-1 font-medium text-stone-800">{profile.current_allocation.room_type}</dd></div><div><dt className="text-xs text-stone-500">Academic year</dt><dd className="mt-1 font-medium text-stone-800">{profile.current_allocation.academic_year}</dd></div><div><dt className="text-xs text-stone-500">Allocation date</dt><dd className="mt-1 font-medium text-stone-800">{profile.current_allocation.allocation_date || "—"}</dd></div></dl></section>}
      </div>
    </div>
  );
}

function PasswordField({ password, setPassword }: { password: string; setPassword: (value: string) => void }) {
  return <label className="block text-sm font-medium text-stone-700 sm:col-span-2">New password <span className="font-normal text-stone-500">(optional)</span><input minLength={8} type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Leave blank to keep your current password" autoComplete="new-password" className="mt-1.5 w-full rounded-xl border border-stone-300 px-3 py-3 text-sm" /></label>;
}
