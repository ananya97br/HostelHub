"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";

import { Notice } from "@/components/AppShell";
import type { Hostel, Staff } from "@/lib/types";

type FormState = { hostel_name: string; gender_type: string; total_rooms: string; warden_id: string; hostel_address: string };
const blank: FormState = { hostel_name: "", gender_type: "Boys", total_rooms: "1", warden_id: "", hostel_address: "" };

function fromHostel(hostel: Hostel): FormState {
  return { hostel_name: hostel.hostel_name, gender_type: hostel.gender_type, total_rooms: String(hostel.total_rooms), warden_id: hostel.warden_id ? String(hostel.warden_id) : "", hostel_address: hostel.hostel_address || "" };
}

function errorText(value: unknown) {
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.error === "string") return record.error;
    if (typeof record.detail === "string") return record.detail;
    const first = Object.values(record).find((item) => typeof item === "string" || Array.isArray(item));
    if (typeof first === "string") return first;
    if (Array.isArray(first) && typeof first[0] === "string") return first[0];
  }
  return "Unable to save the hostel block.";
}

export default function HostelManagement({ hostels, wardens }: { hostels: Hostel[]; wardens: Staff[] }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState<FormState>(blank);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function setField(field: keyof FormState, value: string) { setForm((current) => ({ ...current, [field]: value })); }
  function edit(hostel: Hostel) { setEditingId(String(hostel.hostel_id)); setForm(fromHostel(hostel)); setMessage(""); setError(""); }
  function reset() { setEditingId(""); setForm(blank); setMessage(""); setError(""); }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setMessage(""); setError("");
    const body = { ...form, total_rooms: Number(form.total_rooms), warden_id: form.warden_id ? Number(form.warden_id) : null };
    try {
      const response = await fetch("/api/hostels", { method: editingId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editingId ? { id: Number(editingId), ...body } : body) });
      const data: unknown = response.status === 204 ? null : await response.json();
      if (!response.ok) throw new Error(errorText(data));
      setMessage(editingId ? "Hostel block updated." : "Hostel block created.");
      reset();
      router.refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to save the hostel block."); }
    finally { setSaving(false); }
  }

  async function remove(hostel: Hostel) {
    if (!window.confirm(`Delete ${hostel.hostel_name}? Blocks with rooms cannot be deleted.`)) return;
    setError(""); setMessage("");
    try {
      const response = await fetch("/api/hostels", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: hostel.hostel_id }) });
      const data: unknown = response.status === 204 ? null : await response.json();
      if (!response.ok) throw new Error(errorText(data));
      setMessage("Hostel block deleted.");
      router.refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to delete the hostel block."); }
  }

  return <section className="mb-8 rounded-2xl border border-blue-100 bg-blue-50/50 p-5"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-900">Administrator tools</p><h2 className="mt-2 text-xl font-semibold text-stone-950">{editingId ? "Update hostel block" : "Add a hostel block"}</h2></div>{editingId && <button type="button" onClick={reset} className="text-sm font-medium text-stone-500 hover:text-stone-800">Cancel edit</button>}</div><form onSubmit={save} className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><input required placeholder="Hostel name" value={form.hostel_name} onChange={(event) => setField("hostel_name", event.target.value)} className="rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm" /><select value={form.gender_type} onChange={(event) => setField("gender_type", event.target.value)} className="rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm"><option>Boys</option><option>Girls</option><option>Mixed</option></select><input required min="1" type="number" placeholder="Total rooms" value={form.total_rooms} onChange={(event) => setField("total_rooms", event.target.value)} className="rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm" /><select value={form.warden_id} onChange={(event) => setField("warden_id", event.target.value)} className="rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm"><option value="">No warden assigned</option>{wardens.map((warden) => <option key={warden.staff_id} value={warden.staff_id}>{warden.name}</option>)}</select><input placeholder="Address" value={form.hostel_address} onChange={(event) => setField("hostel_address", event.target.value)} className="rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm" /><div className="flex items-center gap-3 sm:col-span-2 lg:col-span-5">{error && <Notice tone="error">{error}</Notice>}{message && <Notice tone="success">{message}</Notice>}<button type="submit" disabled={saving} className="ml-auto rounded-lg bg-blue-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-50">{saving ? "Saving…" : editingId ? "Save changes" : "Create hostel"}</button></div></form><div className="mt-5 border-t border-blue-100 pt-4"><p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Manage existing blocks</p><div className="mt-3 flex flex-wrap gap-2">{hostels.map((hostel) => <span key={hostel.hostel_id} className="inline-flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm"><span className="font-medium text-stone-800">{hostel.hostel_name}</span><button type="button" onClick={() => edit(hostel)} className="text-xs font-semibold text-blue-900 hover:text-blue-950">Edit</button><button type="button" onClick={() => void remove(hostel)} className="text-xs font-semibold text-red-700 hover:text-red-800">Delete</button></span>)}</div></div></section>;
}
