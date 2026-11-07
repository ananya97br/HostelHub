import { Suspense } from "react";
import { redirect } from "next/navigation";

import { AppShell, Notice, PageIntro } from "@/components/AppShell";
import StudentManagement from "@/components/StudentManagement";
import StudentsTable from "@/components/StudentsTable";
import { djangoFetch } from "@/lib/django";
import { listData, type Paginated } from "@/lib/list";
import type { Allocation } from "@/lib/complaints";
import type { Student } from "@/lib/types";

async function StudentsContent() {
  const [userResponse, studentsResponse, allocationsResponse] = await Promise.all([
    djangoFetch<{ role: string | null }>("/api/auth/me/"),
    djangoFetch<Student[] | Paginated<Student>>("/api/students/"),
    djangoFetch<Allocation[] | Paginated<Allocation>>("/api/allocations/"),
  ]);
  if (userResponse.status === 401 || studentsResponse.status === 401 || allocationsResponse.status === 401) redirect("/login");
  if (studentsResponse.status === 403) return <Notice tone="warning">You do not have permission to view student records.</Notice>;
  if (!studentsResponse.data || !allocationsResponse.data) return <Notice tone="error">Unable to load student records. Please try again shortly.</Notice>;

  const students = listData(studentsResponse.data);
  const allocations = listData(allocationsResponse.data).filter((allocation) => allocation.status === "Allocated");
  return <>{userResponse.data?.role === "Admin" && <StudentManagement students={students} />}<StudentsTable students={students} allocations={allocations} /></>;
}

export default function StudentsPage() {
  return <AppShell><PageIntro eyebrow="People" title="Students" description="Review student profiles and current accommodation assignments." /><Suspense fallback={<div className="mt-8 rounded-2xl border border-stone-200 bg-white p-8 text-sm text-stone-500">Loading student records…</div>}><StudentsContent /></Suspense></AppShell>;
}
