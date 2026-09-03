import {
  recordSettlementPayment,
  requireParticipantSession,
  toErrorResponse,
} from "@/src/lib/backend/data-store.js";

export async function POST(request: Request) {
  try {
    const session = await requireParticipantSession(request);

    return Response.json(
      await recordSettlementPayment(await request.json(), {
        participantId: session.participantId,
      }),
      { status: 201 },
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
