import {
  createBootcamp,
  getAppStateForSession,
  getSessionFromCookieHeader,
  requireAdminSession,
  toErrorResponse,
} from "@/src/lib/backend/data-store.js";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const session = await getSessionFromCookieHeader(request.headers.get("cookie"));

    return Response.json({ bootcamps: (await getAppStateForSession(session)).bootcamps });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireAdminSession(request);

    return Response.json(await createBootcamp(await request.json()), { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
