import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getSessionFromCookieHeader } from "@/src/lib/backend/data-store.js";
import { AdminWorkspace } from "../../../src/components/bootcamp-tracker-app";

export default async function AdminDashboardPage() {
  const session = await getSessionFromCookieHeader((await cookies()).toString());

  if (session?.role !== "ADMIN") {
    redirect("/admin");
  }

  return (
    <main className="min-h-[100dvh] px-4 py-4 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-[1440px] gap-4">
        <AdminWorkspace />
      </div>
    </main>
  );
}
