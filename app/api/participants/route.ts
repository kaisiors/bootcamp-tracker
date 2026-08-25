import {
  createParticipant,
  createParticipantSession,
  getAppStateForSession,
  getSessionFromCookieHeader,
  serializeSessionCookie,
  toErrorResponse,
} from "@/src/lib/backend/data-store.js";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const session = await getSessionFromCookieHeader(request.headers.get("cookie"));

    return Response.json({
      participants: (await getAppStateForSession(session)).participants,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const result = await createParticipant(payload);
    const response = Response.json(result, { status: 201 });
    const session = await getSessionFromCookieHeader(request.headers.get("cookie"));

    if (session?.role !== "ADMIN") {
      const participantLogin = await createParticipantSession({
        bootcampId: payload.bootcampId,
        email: payload.email,
      });

      response.headers.append(
        "Set-Cookie",
        serializeSessionCookie(participantLogin.session),
      );
    }

    return response;
  } catch (error) {
    return toErrorResponse(error);
  }
}
