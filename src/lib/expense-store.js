import { splitExpenseEvenly } from "./finance.js";

export const expenseStorageKey = "bootcamp-spending-tracker:expenses";

export function createExpenseFromDraft(draft, existingExpenses = []) {
  const amount = Number(draft.amount);
  const participantIds = [...new Set(draft.participantIds)].filter(Boolean);

  if (!draft.title.trim()) {
    throw new Error("Judul pengeluaran wajib diisi.");
  }

  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error("Nominal pengeluaran harus lebih dari 0.");
  }

  if (participantIds.length === 0) {
    throw new Error("Pilih minimal satu peserta.");
  }

  const idBase = slugify(`${draft.title}-${draft.expenseDate}`);
  const usedIds = new Set(existingExpenses.map((expense) => expense.id));
  let id = `exp-${idBase}`;
  let index = 2;

  while (usedIds.has(id)) {
    id = `exp-${idBase}-${index}`;
    index += 1;
  }

  return {
    id,
    title: draft.title.trim(),
    amount,
    bootcampId: draft.bootcampId,
    expenseDate: draft.expenseDate,
    payerId: draft.payerId,
    participants: resolveExpenseParticipantShares(
      amount,
      participantIds,
      draft.participantShares,
    ),
  };
}

export function resolveExpenseParticipantShares(
  amount,
  participantIds,
  participantShares,
) {
  if (!Array.isArray(participantShares)) {
    return splitExpenseEvenly(amount, participantIds);
  }

  const selectedParticipantIds = new Set(participantIds);
  const sharesByParticipant = new Map();

  for (const share of participantShares) {
    const userId = share?.userId;
    const shareAmount = Number(share?.shareAmount);

    if (
      !userId ||
      !selectedParticipantIds.has(userId) ||
      sharesByParticipant.has(userId)
    ) {
      throw new Error("Nominal peserta harus sesuai peserta yang dipilih.");
    }

    if (!Number.isInteger(shareAmount) || shareAmount <= 0) {
      throw new Error("Nominal setiap peserta harus lebih dari 0.");
    }

    sharesByParticipant.set(userId, shareAmount);
  }

  const shares = participantIds.map((userId) => {
    const shareAmount = sharesByParticipant.get(userId);

    if (!Number.isInteger(shareAmount)) {
      throw new Error("Nominal setiap peserta yang dipilih wajib diisi.");
    }

    return { userId, shareAmount };
  });

  const totalShare = shares.reduce(
    (total, share) => total + share.shareAmount,
    0,
  );

  if (totalShare !== amount) {
    throw new Error(
      "Total pembayaran peserta harus sama dengan nominal pengeluaran.",
    );
  }

  return shares;
}

export function mergeExpenses(baseExpenses, storedExpenses) {
  const expensesById = new Map();
  const validStoredExpenses = storedExpenses.filter(isValidExpense);

  if (validStoredExpenses.length > 0) {
    for (const expense of validStoredExpenses) {
      expensesById.set(expense.id, expense);
    }

    return Array.from(expensesById.values());
  }

  for (const expense of baseExpenses) {
    if (isValidExpense(expense)) {
      expensesById.set(expense.id, expense);
    }
  }

  return Array.from(expensesById.values());
}

export function loadStoredExpenses() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const value = window.localStorage.getItem(expenseStorageKey);
    const parsed = value ? JSON.parse(value) : [];

    return Array.isArray(parsed) ? parsed.filter(isValidExpense) : [];
  } catch {
    return [];
  }
}

export function saveStoredExpenses(expenses) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(expenseStorageKey, JSON.stringify(expenses));
}

function slugify(value) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return slug || "pengeluaran";
}

function isValidExpense(value) {
  return Boolean(
    value &&
      typeof value.id === "string" &&
      typeof value.title === "string" &&
      Number.isInteger(value.amount) &&
      typeof value.bootcampId === "string" &&
      typeof value.expenseDate === "string" &&
      typeof value.payerId === "string" &&
      Array.isArray(value.participants) &&
      value.participants.every(
        (participant) =>
          participant &&
          typeof participant.userId === "string" &&
          Number.isInteger(participant.shareAmount),
      ),
  );
}
