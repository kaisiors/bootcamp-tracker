import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createExpenseFromDraft,
  mergeExpenses,
} from "../src/lib/expense-store.js";
import { expenses } from "../src/lib/mock-data.js";

describe("expense store helpers", () => {
  it("creates a participant expense with an even split", () => {
    const expense = createExpenseFromDraft(
      {
        title: "Makan malam demo day",
        amount: "100001",
        bootcampId: "bc-ui-09",
        expenseDate: "2026-08-21",
        payerId: "ghoni",
        participantIds: ["ghoni", "maya", "ardi"],
      },
      expenses,
    );

    assert.deepEqual(expense, {
      id: "exp-makan-malam-demo-day-2026-08-21",
      title: "Makan malam demo day",
      amount: 100001,
      bootcampId: "bc-ui-09",
      expenseDate: "2026-08-21",
      payerId: "ghoni",
      participants: [
        { userId: "ghoni", shareAmount: 33334 },
        { userId: "maya", shareAmount: 33334 },
        { userId: "ardi", shareAmount: 33333 },
      ],
    });
  });

  it("creates a participant expense with custom split amounts", () => {
    const expense = createExpenseFromDraft(
      {
        title: "Konsumsi workshop",
        amount: "100000",
        bootcampId: "bc-ui-09",
        expenseDate: "2026-08-22",
        payerId: "ghoni",
        participantIds: ["ghoni", "maya", "ardi"],
        participantShares: [
          { userId: "ghoni", shareAmount: "50000" },
          { userId: "maya", shareAmount: "30000" },
          { userId: "ardi", shareAmount: "20000" },
        ],
      },
      expenses,
    );

    assert.deepEqual(expense.participants, [
      { userId: "ghoni", shareAmount: 50000 },
      { userId: "maya", shareAmount: 30000 },
      { userId: "ardi", shareAmount: 20000 },
    ]);
  });

  it("rejects custom split amounts that do not match the expense amount", () => {
    assert.throws(
      () =>
        createExpenseFromDraft(
          {
            title: "Konsumsi workshop",
            amount: "100000",
            bootcampId: "bc-ui-09",
            expenseDate: "2026-08-22",
            payerId: "ghoni",
            participantIds: ["ghoni", "maya", "ardi"],
            participantShares: [
              { userId: "ghoni", shareAmount: "50000" },
              { userId: "maya", shareAmount: "30000" },
              { userId: "ardi", shareAmount: "10000" },
            ],
          },
          expenses,
        ),
      /Total pembayaran peserta harus sama dengan nominal pengeluaran/,
    );
  });

  it("keeps the stored expense snapshot after admin changes", () => {
    const createdExpense = createExpenseFromDraft(
      {
        title: "Makan malam demo day",
        amount: "90000",
        bootcampId: "bc-ui-09",
        expenseDate: "2026-08-21",
        payerId: "ghoni",
        participantIds: ["ghoni", "maya", "ardi"],
      },
      expenses,
    );
    const mergedExpenses = mergeExpenses(expenses, [createdExpense, ...expenses]);

    assert.equal(mergedExpenses.length, expenses.length + 1);
    assert.ok(mergedExpenses.some((item) => item.id === createdExpense.id));
  });
});
