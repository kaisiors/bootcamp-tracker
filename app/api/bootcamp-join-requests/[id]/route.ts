import {
  requireAdminSession,
  reviewBootcampJoinRequest,
  toErrorResponse,
} from "@/src/lib/backend/data-store.js";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAdminSession(request);
    const { id } = await params;
    const { status } = await request.json();

    return Response.json(
      await reviewBootcampJoinRequest(id, status, session.userId),
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
