import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getSessionFromCookieHeader } from "@/src/lib/backend/data-store.js";
import { BootcampTrackerApp } from "../../src/components/bootcamp-tracker-app";

export default async function DashboardPage() {
  const session = await getSessionFromCookieHeader((await cookies()).toString());

  if (session?.role !== "PARTICIPANT") {
    redirect("/");
  }

  return <BootcampTrackerApp />;
}
