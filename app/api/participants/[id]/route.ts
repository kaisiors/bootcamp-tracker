import {
  deleteParticipant,
  requireAdminSession,
  requireParticipantSession,
  toErrorResponse,
  updateParticipantProfile,
} from "@/src/lib/backend/data-store.js";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireParticipantSession(request);
    const { id } = await params;

    return Response.json(
      await updateParticipantProfile(id, await request.json(), {
        participantId: session.participantId,
      }),
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdminSession(request);

    const { id } = await params;

    return Response.json(await deleteParticipant(id));
  } catch (error) {
    return toErrorResponse(error);
  }
}
