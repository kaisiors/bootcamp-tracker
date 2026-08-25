import {
  deleteBootcamp,
  requireAdminSession,
  toErrorResponse,
  updateBootcamp,
} from "@/src/lib/backend/data-store.js";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdminSession(request);

    const { id } = await params;

    return Response.json(await updateBootcamp(id, await request.json()));
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

    return Response.json(await deleteBootcamp(id));
  } catch (error) {
    return toErrorResponse(error);
  }
}
