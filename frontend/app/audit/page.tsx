import { redirect } from "next/navigation";
import { Suspense } from "react";

import { AppShell, Notice, PageIntro } from "@/components/AppShell";
import { djangoFetch } from "@/lib/django";
import { listData, type Paginated } from "@/lib/list";
import type { AuditLog, AuthUser } from "@/lib/types";

const resourceLabels: Record<string, string> = {
  AccountProfile: "Account",
  Student: "Student record",
  Hostel: "Hostel",
  Room: "Room",
  Staff: "Staff record",
  Allocation: "Allocation",
  Complaint: "Complaint",
  Profile: "Profile",
};

const actionLabels: Record<string, string> = {
  created: "created",
  updated: "updated",
  deleted: "deleted",
  vacated: "vacated",
  reassigned: "reassigned",
};

function readableAction(action: string) {
  const [resource, verb] = action.split(".");
  const label = resourceLabels[resource] || resource.replaceAll("_", " ");
  const readableVerb = verb ? actionLabels[verb] || verb.replaceAll("_", " ") : "changed";
  return `${label} ${readableVerb}`;
}

function readableResource(resource: string) {
  return resourceLabels[resource] || resource.replaceAll("_", " ");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

async function AuditContent() {
  const [userResponse, auditResponse] = await Promise.all([
    djangoFetch<AuthUser>("/api/auth/me/"),
    djangoFetch<AuditLog[] | Paginated<AuditLog>>("/api/audit/"),
  ]);

  if (userResponse.status === 401 || auditResponse.status === 401) redirect("/login");
  if (!userResponse.data || !["Admin", "Warden"].includes(userResponse.data.role || "")) {
    return <Notice tone="warning">Activity history is available to administrators and wardens.</Notice>;
  }
  if (!auditResponse.data) return <Notice tone="error">Unable to load activity history.</Notice>;

  const events = listData(auditResponse.data);
  return (
    <section className="mt-8 overflow-hidden rounded-2xl border border-stone-200 bg-white">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-stone-200 px-5 py-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-900">Accountability</p>
          <h2 className="mt-2 text-xl font-semibold text-stone-950">Recent activity</h2>
          <p className="mt-1 text-sm text-stone-500">Administrative and workflow changes relevant to your access.</p>
        </div>
        <span className="rounded-full bg-sky-50 px-3 py-1.5 text-xs font-semibold text-blue-900">{events.length} event{events.length === 1 ? "" : "s"}</span>
      </div>
      {events.length === 0 ? (
        <div className="px-6 py-14 text-center text-sm text-stone-500">No activity has been recorded yet.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-5 py-3.5 font-semibold">Activity</th>
                <th className="px-5 py-3.5 font-semibold">Record</th>
                <th className="px-5 py-3.5 font-semibold">By</th>
                <th className="px-5 py-3.5 font-semibold">When</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.event_id} className="border-t border-stone-100">
                  <td className="px-5 py-4 font-medium text-stone-800">{readableAction(event.action)}</td>
                  <td className="px-5 py-4 text-stone-600">{readableResource(event.resource_type)}{event.resource_id ? ` #${event.resource_id}` : ""}</td>
                  <td className="px-5 py-4 text-stone-600">{event.actor_username || "System"}</td>
                  <td className="px-5 py-4 text-stone-500">{formatDate(event.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default function AuditPage() {
  return (
    <AppShell>
      <PageIntro eyebrow="Governance" title="Activity history" description="Review recent administrative and workflow changes within your access scope." />
      <Suspense fallback={<div className="mt-8 rounded-2xl border border-stone-200 bg-white p-8 text-sm text-stone-500">Loading activity history…</div>}>
        <AuditContent />
      </Suspense>
    </AppShell>
  );
}
