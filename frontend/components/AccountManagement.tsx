"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";

import { Notice } from "@/components/AppShell";
import type { DormAccount, DormRole, Staff, Student } from "@/lib/types";

const roleOptions: DormRole[] = ["Student", "Warden", "Maintenance", "Admin"];

function errorText(value: unknown): string {
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.error === "string") return record.error;
    if (typeof record.detail === "string") return record.detail;
    const first = Object.entries(record).find(([, item]) => typeof item === "string" || Array.isArray(item));
    if (first) {
      const item = first[1];
      if (typeof item === "string") return item;
      if (Array.isArray(item) && typeof item[0] === "string") return item[0];
    }
  }
  return "The account could not be created.";
}

function roleStyle(role: DormRole) {
  if (role === "Admin") return "bg-amber-50 text-amber-800";
  if (role === "Warden") return "bg-sky-50 text-sky-800";
  if (role === "Maintenance") return "bg-emerald-50 text-emerald-800";
  return "bg-stone-100 text-stone-700";
}

export default function AccountManagement({
  initialAccounts,
  students,
  staff,
}: {
  initialAccounts: DormAccount[];
  students: Student[];
  staff: Staff[];
}) {
  const router = useRouter();
  const [accounts, setAccounts] = useState(initialAccounts);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<DormRole>("Student");
  const [linkedId, setLinkedId] = useState("");
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingRole, setEditingRole] = useState<DormRole>("Student");
  const [editingLinkedId, setEditingLinkedId] = useState("");
  const [editingPassword, setEditingPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const matchingStaff = staff.filter((member) => member.role === role);
  const requiresLink = role === "Student" || role === "Warden" || role === "Maintenance";

  function changeRole(value: DormRole) {
    setRole(value);
    setLinkedId("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");

    if (requiresLink && !linkedId) {
      setError(`Select the ${role === "Student" ? "student" : "staff"} record for this account.`);
      return;
    }

    const payload: Record<string, unknown> = {
      username: username.trim(),
      password,
      role,
    };
    if (role === "Student") payload.student_id = Number(linkedId);
    if (role === "Warden" || role === "Maintenance") payload.staff_id = Number(linkedId);

    setSaving(true);
    try {
      const response = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data: unknown = await response.json();
      if (!response.ok) throw new Error(errorText(data));

      const account = data as DormAccount;
      setAccounts((current) => [account, ...current]);
      setUsername("");
      setPassword("");
      setLinkedId("");
      setMessage(`${role} account created successfully.`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The account could not be created.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleAccount(account: DormAccount) {
    setUpdatingId(account.id);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/accounts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: account.id, is_active: !account.is_active }),
      });
      const data: unknown = await response.json();
      if (!response.ok) throw new Error(errorText(data));
      const updated = data as DormAccount;
      setAccounts((current) => current.map((item) => item.id === updated.id ? updated : item));
      setMessage(`${account.username} is now ${updated.is_active ? "active" : "inactive"}.`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update account status.");
    } finally {
      setUpdatingId(null);
    }
  }

  function beginEdit(account: DormAccount) {
    setEditingId(account.id);
    setEditingRole(account.role);
    setEditingLinkedId(account.student_id ? String(account.student_id) : account.staff_id ? String(account.staff_id) : "");
    setEditingPassword("");
    setMessage("");
    setError("");
  }

  async function saveAccess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingId) return;
    const needsLink = editingRole !== "Admin";
    if (needsLink && !editingLinkedId) {
      setError(`Select the ${editingRole === "Student" ? "student" : "staff"} record for this account.`);
      return;
    }
    setUpdatingId(editingId);
    setMessage("");
    setError("");
    const payload: Record<string, unknown> = {
      id: editingId,
      role: editingRole,
      student_id: editingRole === "Student" ? Number(editingLinkedId) : null,
      staff_id: editingRole === "Warden" || editingRole === "Maintenance" ? Number(editingLinkedId) : null,
    };
    if (editingPassword) payload.password = editingPassword;
    try {
      const response = await fetch("/api/accounts", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data: unknown = await response.json();
      if (!response.ok) throw new Error(errorText(data));
      const updated = data as DormAccount;
      setAccounts((current) => current.map((item) => item.id === updated.id ? updated : item));
      setEditingId(null);
      setEditingPassword("");
      setMessage(`${updated.username}'s access was updated.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update account access.");
    } finally {
      setUpdatingId(null);
    }
  }

  const editingAccount = accounts.find((account) => account.id === editingId);
  const editingStaff = staff.filter((member) => member.role === editingRole);

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(300px,380px)_1fr]">
      <section className="rounded-2xl border border-stone-200 bg-white p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-900">Administrator tools</p>
        <h2 className="mt-2 text-xl font-semibold text-stone-950">Provision an account</h2>
        <p className="mt-2 text-sm leading-6 text-stone-600">
          Link each login to the existing student or staff record so role permissions and complaint ownership work correctly.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="block text-sm font-medium text-stone-700">
            Username
            <input
              required
              minLength={1}
              maxLength={150}
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              className="mt-1.5 w-full rounded-xl border border-stone-300 px-3 py-3 text-sm outline-none focus:border-blue-900 focus:ring-4 focus:ring-blue-100"
            />
          </label>
          <label className="block text-sm font-medium text-stone-700">
            Temporary password
            <input
              required
              minLength={8}
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              className="mt-1.5 w-full rounded-xl border border-stone-300 px-3 py-3 text-sm outline-none focus:border-blue-900 focus:ring-4 focus:ring-blue-100"
            />
            <span className="mt-1.5 block text-xs font-normal text-stone-500">At least 8 characters. Passwords are never displayed after creation.</span>
          </label>
          <label className="block text-sm font-medium text-stone-700">
            HostelHub role
            <select
              value={role}
              onChange={(event) => changeRole(event.target.value as DormRole)}
              className="mt-1.5 w-full rounded-xl border border-stone-300 bg-white px-3 py-3 text-sm"
            >
              {roleOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>

          {role === "Student" && (
            <label className="block text-sm font-medium text-stone-700">
              Student record
              <select required value={linkedId} onChange={(event) => setLinkedId(event.target.value)} className="mt-1.5 w-full rounded-xl border border-stone-300 bg-white px-3 py-3 text-sm">
                <option value="">Select student</option>
                {students.map((student) => <option key={student.student_id} value={student.student_id}>{student.name} · #{student.student_id}</option>)}
              </select>
            </label>
          )}

          {(role === "Warden" || role === "Maintenance") && (
            <label className="block text-sm font-medium text-stone-700">
              Staff record
              <select required value={linkedId} onChange={(event) => setLinkedId(event.target.value)} className="mt-1.5 w-full rounded-xl border border-stone-300 bg-white px-3 py-3 text-sm">
                <option value="">Select {role.toLowerCase()}</option>
                {matchingStaff.map((member) => <option key={member.staff_id} value={member.staff_id}>{member.name} · #{member.staff_id}{member.hostel_name ? ` · ${member.hostel_name}` : ""}</option>)}
              </select>
              {matchingStaff.length === 0 && <span className="mt-1.5 block text-xs font-normal text-amber-800">No matching {role.toLowerCase()} staff records are available.</span>}
            </label>
          )}

          {role === "Admin" && <Notice tone="info">Administrator accounts are global and do not link to a student or staff record.</Notice>}
          {error && <Notice tone="error">{error}</Notice>}
          {message && <Notice tone="success">{message}</Notice>}
          <button type="submit" disabled={saving || (requiresLink && !linkedId)} className="rounded-xl bg-blue-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-50">
            {saving ? "Creating account…" : "Create account"}
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-900">Access directory</p>
            <h2 className="mt-2 text-xl font-semibold text-stone-950">Provisioned accounts</h2>
          </div>
          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">{accounts.length} account{accounts.length === 1 ? "" : "s"}</span>
        </div>
        {editingAccount && <form onSubmit={saveAccess} className="mt-5 rounded-xl border border-blue-100 bg-sky-50/50 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-blue-900">Edit access</p><h3 className="mt-1 font-semibold text-stone-900">{editingAccount.username}</h3></div><button type="button" onClick={() => setEditingId(null)} className="text-sm font-medium text-stone-500 hover:text-stone-800">Cancel</button></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <label className="block text-sm font-medium text-stone-700">Role<select value={editingRole} onChange={(event) => { setEditingRole(event.target.value as DormRole); setEditingLinkedId(""); }} className="mt-1.5 w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm">{roleOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
            {editingRole === "Student" && <label className="block text-sm font-medium text-stone-700">Student record<select required value={editingLinkedId} onChange={(event) => setEditingLinkedId(event.target.value)} className="mt-1.5 w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm"><option value="">Select student</option>{students.map((student) => <option key={student.student_id} value={student.student_id}>{student.name} · #{student.student_id}</option>)}</select></label>}
            {(editingRole === "Warden" || editingRole === "Maintenance") && <label className="block text-sm font-medium text-stone-700">Staff record<select required value={editingLinkedId} onChange={(event) => setEditingLinkedId(event.target.value)} className="mt-1.5 w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm"><option value="">Select staff</option>{editingStaff.map((member) => <option key={member.staff_id} value={member.staff_id}>{member.name} · #{member.staff_id}</option>)}</select></label>}
            <label className="block text-sm font-medium text-stone-700">Reset password <span className="font-normal text-stone-500">(optional)</span><input minLength={8} type="password" value={editingPassword} onChange={(event) => setEditingPassword(event.target.value)} placeholder="Leave unchanged" className="mt-1.5 w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm" /></label>
          </div>
          <button type="submit" disabled={updatingId === editingId} className="mt-4 rounded-lg bg-blue-950 px-3 py-2.5 text-sm font-semibold text-white hover:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-50">{updatingId === editingId ? "Saving…" : "Save access"}</button>
        </form>}
        {(error || message) && <div className="mt-4">{error ? <Notice tone="error">{error}</Notice> : <Notice tone="success">{message}</Notice>}</div>}

        {accounts.length === 0 ? (
          <div className="mt-5 rounded-xl border border-dashed border-stone-300 p-8 text-center text-sm text-stone-500">No HostelHub accounts have been provisioned yet.</div>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
                <tr><th className="px-4 py-3 font-semibold">Account</th><th className="px-4 py-3 font-semibold">Role</th><th className="px-4 py-3 font-semibold">Linked record</th><th className="px-4 py-3 font-semibold">Status</th><th className="px-4 py-3 font-semibold">Action</th></tr>
              </thead>
              <tbody>
                {accounts.map((account) => {
                  const linkedRecord = account.student_id
                    ? `${account.student_name || "Student"} · #${account.student_id}`
                    : account.staff_id
                      ? `${account.staff_name || "Staff"} · #${account.staff_id}`
                      : "Global access";
                  return (
                    <tr key={account.id} className="border-t border-stone-100">
                      <td className="px-4 py-4 font-semibold text-stone-900">{account.username}</td>
                      <td className="px-4 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${roleStyle(account.role)}`}>{account.role}</span></td>
                      <td className="px-4 py-4 text-stone-600">{linkedRecord}</td>
                      <td className="px-4 py-4"><span className={account.is_active ? "text-emerald-700" : "text-red-700"}>{account.is_active ? "Active" : "Inactive"}</span></td>
                      <td className="space-x-2 px-4 py-4"><button type="button" onClick={() => beginEdit(account)} className="whitespace-nowrap rounded-lg border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-900 hover:bg-sky-50">Edit access</button><button type="button" onClick={() => void toggleAccount(account)} disabled={updatingId === account.id} className="whitespace-nowrap rounded-lg border border-stone-300 px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50">{updatingId === account.id ? "Saving…" : account.is_active ? "Deactivate" : "Activate"}</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
