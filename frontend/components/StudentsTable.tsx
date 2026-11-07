"use client";

import { useMemo, useState } from "react";

import type { Allocation } from "@/lib/complaints";
import type { Student } from "@/lib/types";

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export default function StudentsTable({
  students,
  allocations,
}: {
  students: Student[];
  allocations: Allocation[];
}) {
  const [query, setQuery] = useState("");
  const allocationByStudent = useMemo(
    () => new Map(allocations.map((allocation) => [allocation.student, allocation])),
    [allocations],
  );
  const filteredStudents = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return students;

    return students.filter((student) => {
      const allocation = allocationByStudent.get(student.student_id);
      const searchable = [
        student.name,
        student.email,
        student.department,
        `year ${student.year_of_study}`,
        allocation?.room_number,
        allocation?.hostel_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return searchable.includes(normalizedQuery);
    });
  }, [allocationByStudent, query, students]);

  return (
    <section className="mt-8 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-[0_12px_30px_rgba(30,64,175,0.04)]">
      <div className="flex flex-col gap-4 border-b border-stone-200 px-5 py-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-900">Student directory</p>
          <h2 className="mt-2 text-xl font-semibold text-stone-950">Student records</h2>
          <p className="mt-1 text-sm text-stone-500">Review profiles and current accommodation assignments.</p>
        </div>
        <span className="w-fit rounded-full bg-sky-50 px-3 py-1.5 text-xs font-semibold text-blue-900">
          {filteredStudents.length} of {students.length} record{students.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="border-b border-stone-200 bg-sky-50/40 px-5 py-4">
        <label className="block text-xs font-semibold uppercase tracking-wide text-stone-500" htmlFor="student-search">
          Find a student
        </label>
        <div className="relative mt-1.5">
          <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="m14.25 14.25 3.5 3.5m-1.75-8a6.25 6.25 0 1 1-12.5 0 6.25 6.25 0 0 1 12.5 0Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <input
            id="student-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name, department, email, or room"
            className="w-full rounded-xl border border-stone-300 bg-white py-3 pl-10 pr-4 text-sm text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-blue-900 focus:ring-4 focus:ring-blue-100"
          />
        </div>
      </div>

      {filteredStudents.length === 0 ? (
        <div className="px-6 py-14 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-blue-900">
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="m14.25 14.25 3.5 3.5m-1.75-8a6.25 6.25 0 1 1-12.5 0 6.25 6.25 0 0 1 12.5 0Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </div>
          <h3 className="mt-4 font-semibold text-stone-900">No matching students</h3>
          <p className="mt-1 text-sm text-stone-500">Try a different name, department, email address, or room number.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] text-left text-sm">
            <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-5 py-3.5 font-semibold">Student</th>
                <th className="px-5 py-3.5 font-semibold">Department</th>
                <th className="px-5 py-3.5 font-semibold">Year</th>
                <th className="px-5 py-3.5 font-semibold">Contact</th>
                <th className="px-5 py-3.5 font-semibold">Accommodation</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((student) => {
                const allocation = allocationByStudent.get(student.student_id);
                return (
                  <tr key={student.student_id} className="border-t border-stone-100 transition hover:bg-sky-50/40">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-950 text-xs font-bold text-white" aria-hidden="true">{initials(student.name)}</span>
                        <div>
                          <p className="font-semibold text-stone-900">{student.name}</p>
                          <p className="mt-0.5 text-xs text-stone-500">Student #{student.student_id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-stone-600">{student.department}</td>
                    <td className="px-5 py-4"><span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-700">Year {student.year_of_study}</span></td>
                    <td className="px-5 py-4 text-stone-600">{student.email}</td>
                    <td className="px-5 py-4">
                      {allocation ? (
                        <div>
                          <p className="font-medium text-stone-800">Room {allocation.room_number}</p>
                          <p className="mt-0.5 text-xs text-stone-500">{allocation.hostel_name || "Assigned hostel"}</p>
                        </div>
                      ) : <span className="text-stone-400">Not allocated</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
