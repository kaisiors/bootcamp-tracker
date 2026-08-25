import {
  createAdminSession,
  serializeSessionCookie,
  toErrorResponse,
} from "@/src/lib/backend/data-store.js";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const result = await createAdminSession(await request.json());
    const response = Response.json({ admin: result.admin });

    response.headers.append("Set-Cookie", serializeSessionCookie(result.session));

    return response;
  } catch (error) {
    return toErrorResponse(error);
  }
}
