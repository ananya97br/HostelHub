import { redirect } from "next/navigation";
import { Suspense } from "react";

import AccountManagement from "@/components/AccountManagement";
import { AppShell, Notice, PageIntro } from "@/components/AppShell";
import { djangoFetch } from "@/lib/django";
import { listData, type Paginated } from "@/lib/list";
import type { DormAccount, Staff, Student } from "@/lib/types";

async function AccountsContent() {
  const [userResponse, accountsResponse, studentsResponse, staffResponse] = await Promise.all([
    djangoFetch<{ role: string | null }>("/api/auth/me/"),
    djangoFetch<DormAccount[] | Paginated<DormAccount>>("/api/accounts/"),
    djangoFetch<Student[] | Paginated<Student>>("/api/students/"),
    djangoFetch<Staff[] | Paginated<Staff>>("/api/staff/"),
  ]);

  if ([userResponse, accountsResponse].some((response) => response.status === 401)) redirect("/login");
  if (userResponse.status === 403 || userResponse.data?.role !== "Admin") {
    return <Notice tone="warning">Only administrators can manage HostelHub accounts.</Notice>;
  }
  if (!accountsResponse.data || !studentsResponse.data || !staffResponse.data) {
    return <Notice tone="error">Unable to load account records. Please try again shortly.</Notice>;
  }

  return (
    <AccountManagement
      initialAccounts={listData(accountsResponse.data)}
      students={listData(studentsResponse.data)}
      staff={listData(staffResponse.data)}
    />
  );
}

export default function AccountsPage() {
  return (
    <AppShell>
      <PageIntro
        eyebrow="Administration"
        title="Accounts"
        description="Provision secure logins and link them to the correct HostelHub identity before users access role-scoped workflows."
      />
      <Suspense fallback={<div className="mt-8 rounded-2xl border border-stone-200 bg-white p-8 text-sm text-stone-500">Loading account directory…</div>}>
        <AccountsContent />
      </Suspense>
    </AppShell>
  );
}
