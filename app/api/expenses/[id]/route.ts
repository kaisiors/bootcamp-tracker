import {
  deleteExpense,
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

    return Response.json(await deleteExpense(id));
  } catch (error) {
    return toErrorResponse(error);
  }
}
