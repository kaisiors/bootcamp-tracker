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
    participants: splitExpenseEvenly(amount, participantIds),
  };
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
