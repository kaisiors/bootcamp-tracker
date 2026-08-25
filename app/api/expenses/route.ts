import {
  createExpense,
  getAppStateForSession,
  getSessionFromCookieHeader,
  requireParticipantSession,
  toErrorResponse,
} from "@/src/lib/backend/data-store.js";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const session = await getSessionFromCookieHeader(request.headers.get("cookie"));

    return Response.json({ expenses: (await getAppStateForSession(session)).expenses });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireParticipantSession(request);

    return Response.json(
      await createExpense(await request.json(), {
        participantId: session.participantId,
      }),
      { status: 201 },
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
