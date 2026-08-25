import { serializeLogoutCookie } from "@/src/lib/backend/data-store.js";

export const runtime = "nodejs";

export async function POST() {
  const response = Response.json({ ok: true });

  response.headers.append("Set-Cookie", serializeLogoutCookie());

  return response;
}
