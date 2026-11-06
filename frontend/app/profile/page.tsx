import { redirect } from "next/navigation";
import { Suspense } from "react";
import type { ComponentProps } from "react";

import { AppShell, Notice, PageIntro } from "@/components/AppShell";
import ProfilePanel from "@/components/ProfilePanel";
import { djangoFetch } from "@/lib/django";

type ProfileResponse = ComponentProps<typeof ProfilePanel>["profile"];

async function ProfileContent() {
  const response = await djangoFetch<ProfileResponse>("/api/profile/");
  if (response.status === 401) redirect("/login");
  if (response.status === 403 || !response.data) return <Notice tone="warning">Your profile is not available. Ask an administrator to provision your HostelHub account.</Notice>;
  return <ProfilePanel profile={response.data} />;
}

export default function ProfilePage() {
  return <AppShell><PageIntro eyebrow="Account" title="My profile" description="Review your account identity, accommodation details, and approved personal information." /><Suspense fallback={<div className="mt-8 rounded-2xl border border-stone-200 bg-white p-8 text-sm text-stone-500">Loading profile…</div>}><ProfileContent /></Suspense></AppShell>;
}
