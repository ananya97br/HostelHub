"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";

import { Notice } from "@/components/AppShell";
import type { Student } from "@/lib/types";

type StudentForm = {
  name: string;
  gender: string;
  date_of_birth: string;
  department: string;
  year_of_study: string;
  contact_number: string;
  email: string;
  guardian_name: string;
  guardian_contact: string;
  special_requirements: string;
  admission_date: string;
};

const emptyForm: StudentForm = {
  name: "", gender: "Male", date_of_birth: "", department: "", year_of_study: "1", contact_number: "", email: "", guardian_name: "", guardian_contact: "", special_requirements: "", admission_date: new Date().toISOString().slice(0, 10),
};

function fromStudent(student: Student): StudentForm {
  return {
    name: student.name,
    gender: student.gender,
    date_of_birth: student.date_of_birth || "",
    department: student.department,
    year_of_study: String(student.year_of_study),
    contact_number: student.contact_number || "",
    email: student.email,
    guardian_name: student.guardian_name || "",
    guardian_contact: student.guardian_contact || "",
    special_requirements: student.special_requirements || "",
    admission_date: student.admission_date || emptyForm.admission_date,
  };
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
  return "Unable to save the student record.";
}

export default function StudentManagement({ students }: { students: Student[] }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState<StudentForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function setField(field: keyof StudentForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function selectStudent(value: string) {
    setEditingId(value);
    setForm(value ? fromStudent(students.find((student) => String(student.student_id) === value) as Student) : emptyForm);
    setMessage("");
    setError("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");
    const body = { ...form, year_of_study: Number(form.year_of_study) };
    try {
      const response = await fetch("/api/students", { method: editingId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editingId ? { id: Number(editingId), ...body } : body) });
      const data: unknown = await response.json();
      if (!response.ok) throw new Error(errorText(data));
      setMessage(editingId ? "Student record updated." : "Student registered successfully.");
      if (!editingId) setForm(emptyForm);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save the student record.");
    } finally {
      setSaving(false);
    }
  }

  return <section className="mb-8 rounded-2xl border border-blue-100 bg-blue-50/50 p-5"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-900">Administrator tools</p><h2 className="mt-2 text-xl font-semibold text-stone-950">{editingId ? "Update student record" : "Register a student"}</h2></div><select value={editingId} onChange={(event) => selectStudent(event.target.value)} className="rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm"><option value="">New student</option>{students.map((student) => <option key={student.student_id} value={student.student_id}>Edit {student.name}</option>)}</select></div><form onSubmit={handleSubmit} className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><input required placeholder="Full name" value={form.name} onChange={(event) => setField("name", event.target.value)} className="rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm" /><select value={form.gender} onChange={(event) => setField("gender", event.target.value)} className="rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm"><option>Male</option><option>Female</option><option>Other</option></select><input required type="date" value={form.date_of_birth} onChange={(event) => setField("date_of_birth", event.target.value)} className="rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm" /><input required placeholder="Department" value={form.department} onChange={(event) => setField("department", event.target.value)} className="rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm" /><select value={form.year_of_study} onChange={(event) => setField("year_of_study", event.target.value)} className="rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm"><option value="1">Year 1</option><option value="2">Year 2</option><option value="3">Year 3</option><option value="4">Year 4</option><option value="5">Year 5</option></select><input required placeholder="Phone number" value={form.contact_number} onChange={(event) => setField("contact_number", event.target.value)} className="rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm" /><input required type="email" placeholder="Email address" value={form.email} onChange={(event) => setField("email", event.target.value)} className="rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm" /><input required type="date" value={form.admission_date} onChange={(event) => setField("admission_date", event.target.value)} className="rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm" /><input placeholder="Guardian name" value={form.guardian_name} onChange={(event) => setField("guardian_name", event.target.value)} className="rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm" /><input placeholder="Guardian contact" value={form.guardian_contact} onChange={(event) => setField("guardian_contact", event.target.value)} className="rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm" /><input placeholder="Special requirements" value={form.special_requirements} onChange={(event) => setField("special_requirements", event.target.value)} className="rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm sm:col-span-2" /><div className="flex items-center gap-3 sm:col-span-2 lg:col-span-4">{error && <Notice tone="error">{error}</Notice>}{message && <Notice tone="success">{message}</Notice>}<button type="submit" disabled={saving} className="ml-auto rounded-lg bg-blue-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-50">{saving ? "Saving…" : editingId ? "Save student" : "Register student"}</button></div></form></section>;
}
