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

/**
 * @param {string | number | null | undefined} amountValue
 * @param {string[]} checkedParticipantIds
 * @param {Record<string, string | number | null | undefined>} shareValues
 * @param {string[]} editedParticipantIds
 * @returns {Record<string, string>}
 */
export function balanceExpenseShareValues(
  amountValue,
  checkedParticipantIds,
  shareValues = {},
  editedParticipantIds = [],
) {
  const participantIds = [...new Set(checkedParticipantIds)].filter(Boolean);
  const participantIdSet = new Set(participantIds);
  const editedIdSet = new Set(
    editedParticipantIds.filter((participantId) =>
      participantIdSet.has(participantId),
    ),
  );
  const amount = parseRupiahInput(amountValue);
  /** @type {Record<string, string>} */
  const balancedValues = {};
  let editedTotal = 0;

  for (const participantId of participantIds) {
    if (!editedIdSet.has(participantId)) {
      continue;
    }

    const value = formatRupiahInput(shareValues[participantId]);
    balancedValues[participantId] = value;
    editedTotal += parseRupiahInput(value);
  }

  const automaticParticipantIds = participantIds.filter(
    (participantId) => !editedIdSet.has(participantId),
  );

  if (!Number.isInteger(amount) || amount <= 0) {
    for (const participantId of automaticParticipantIds) {
      balancedValues[participantId] = "";
    }

    return balancedValues;
  }

  if (automaticParticipantIds.length === 0) {
    return balancedValues;
  }

  const remainingAmount = amount - editedTotal;

  if (remainingAmount <= 0) {
    for (const participantId of automaticParticipantIds) {
      balancedValues[participantId] = "0";
    }

    return balancedValues;
  }

  for (const share of splitExpenseEvenly(
    remainingAmount,
    automaticParticipantIds,
  )) {
    balancedValues[share.userId] = formatRupiahInput(share.shareAmount);
  }

  return balancedValues;
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

export function buildParticipantSettlementGroups(
  settlementRows,
  participantsById,
  participantId,
  mode,
  settlementPayments = [],
) {
  const groupsByParticipant = new Map();
  const paymentIndex = new Map(
    settlementPayments.map((payment) => [createSettlementPaymentKey(payment), payment]),
  );

  for (const row of settlementRows) {
    const isPayable = mode === "payable" && row.debtorId === participantId;
    const isReceivable = mode === "receivable" && row.payerId === participantId;

    if (!isPayable && !isReceivable) {
      continue;
    }

    const counterpartyId = isPayable ? row.payerId : row.debtorId;
    const counterpartyName = isPayable ? row.payerName : row.debtorName;
    const participant = participantsById[counterpartyId];
    const payment = paymentIndex.get(createSettlementPaymentKey(row));
    const item = {
      amount: Number(row.amount),
      debtorId: row.debtorId,
      expenseId: row.expenseId,
      paidAt: payment?.paidAt ?? null,
      payerId: row.payerId,
      status: payment ? "paid" : "unpaid",
      title: row.title,
    };

    if (!groupsByParticipant.has(counterpartyId)) {
      groupsByParticipant.set(counterpartyId, {
        bank: participant?.bank ?? null,
        items: [],
        paidAmount: 0,
        participantId: counterpartyId,
        participantName: participant?.name ?? counterpartyName,
        totalAmount: 0,
        unpaidAmount: 0,
      });
    }

    const group = groupsByParticipant.get(counterpartyId);
    group.items.push(item);
    group.totalAmount += item.amount;

    if (item.status === "paid") {
      group.paidAmount += item.amount;
    } else {
      group.unpaidAmount += item.amount;
    }
  }

  return [...groupsByParticipant.values()];
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

export function formatRupiahInput(value) {
  const digits = String(value ?? "").replace(/\D/g, "");

  if (!digits) {
    return "";
  }

  return new Intl.NumberFormat("id-ID").format(Number(digits));
}

export function parseRupiahInput(value) {
  const digits = String(value ?? "").replace(/\D/g, "");

  return digits ? Number(digits) : 0;
}

function createSettlementPaymentKey(item) {
  return `${item.expenseId}:${item.debtorId}:${item.payerId}`;
}
