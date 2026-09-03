import {
  deleteExpense,
  getSessionFromCookieHeader,
  requireAdminSession,
  requireParticipantSession,
  toErrorResponse,
  updateExpense,
} from "@/src/lib/backend/data-store.js";

export const runtime = "nodejs";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdminSession(request);

    const { id } = await params;

    return Response.json(await deleteExpense(id));
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSessionFromCookieHeader(request.headers.get("cookie"));
    const { id } = await params;
    const payload = await request.json();

    if (session?.role === "ADMIN") {
      return Response.json(await updateExpense(id, payload));
    }

    const participantSession = await requireParticipantSession(request);

    return Response.json(
      await updateExpense(id, payload, {
        participantId: participantSession.participantId,
      }),
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
