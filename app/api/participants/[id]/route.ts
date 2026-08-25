import {
  deleteParticipant,
  requireAdminSession,
  toErrorResponse,
} from "@/src/lib/backend/data-store.js";

export const runtime = "nodejs";

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
