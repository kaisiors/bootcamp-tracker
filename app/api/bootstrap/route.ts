import {
  getAppStateForSession,
  getSessionFromCookieHeader,
  toErrorResponse,
} from "@/src/lib/backend/data-store.js";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const session = await getSessionFromCookieHeader(request.headers.get("cookie"));

    return Response.json(await getAppStateForSession(session));
  } catch (error) {
    return toErrorResponse(error);
  }
}
