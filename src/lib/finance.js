export function splitExpenseEvenly(amount, checkedParticipantIds) {
  const participantIds = [...new Set(checkedParticipantIds)].filter(Boolean);

  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error("Nominal pengeluaran harus lebih dari 0.");
  }

  if (participantIds.length === 0) {
    return [];
  }

  const baseShare = Math.floor(amount / participantIds.length);
  const remainder = amount % participantIds.length;

  return participantIds.map((userId, index) => ({
    userId,
    shareAmount: baseShare + (index < remainder ? 1 : 0),
  }));
}

export function calculateParticipantSummary(userId, expenses) {
  return expenses.reduce(
    (summary, expense) => {
      const ownShare =
        expense.participants.find((participant) => participant.userId === userId)
          ?.shareAmount ?? 0;
      const paidByUser = expense.payerId === userId ? expense.amount : 0;
      const receivable =
        expense.payerId === userId
          ? expense.participants
              .filter((participant) => participant.userId !== userId)
              .reduce((total, participant) => total + participant.shareAmount, 0)
          : 0;

      const next = {
        totalPaid: summary.totalPaid + paidByUser,
        totalOwed: summary.totalOwed + ownShare,
        totalReceivable: summary.totalReceivable + receivable,
        netBalance: 0,
      };

      next.netBalance = next.totalReceivable - next.totalOwed;

      return next;
    },
    {
      totalPaid: 0,
      totalOwed: 0,
      totalReceivable: 0,
      netBalance: 0,
    },
  );
}

export function calculateSettlementRows(expenses, usersById) {
  const rows = [];

  for (const expense of expenses) {
    for (const participant of expense.participants) {
      if (participant.userId === expense.payerId) {
        continue;
      }

      rows.push({
        expenseId: expense.id,
        title: expense.title,
        debtorId: participant.userId,
        debtorName: usersById[participant.userId]?.name ?? participant.userId,
        payerId: expense.payerId,
        payerName: usersById[expense.payerId]?.name ?? expense.payerId,
        amount: participant.shareAmount,
      });
    }
  }

  return rows;
}

export function formatRupiah(value) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  })
    .format(value)
    .replace(/\s/g, "");
}
