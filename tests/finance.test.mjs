import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  calculateParticipantSummary,
  formatRupiah,
  splitExpenseEvenly,
} from "../src/lib/finance.js";

describe("splitExpenseEvenly", () => {
  it("splits an expense only to checked participants", () => {
    const shares = splitExpenseEvenly(100000, ["bima", "nala", "raka", "sari"]);

    assert.deepEqual(shares, [
      { userId: "bima", shareAmount: 25000 },
      { userId: "nala", shareAmount: 25000 },
      { userId: "raka", shareAmount: 25000 },
      { userId: "sari", shareAmount: 25000 },
    ]);
  });

  it("does not include the payer unless the payer is checked", () => {
    const shares = splitExpenseEvenly(90000, ["nala", "raka"]);

    assert.deepEqual(shares, [
      { userId: "nala", shareAmount: 45000 },
      { userId: "raka", shareAmount: 45000 },
    ]);
  });

  it("distributes leftover rupiah to the first checked participants", () => {
    const shares = splitExpenseEvenly(100000, ["bima", "nala", "raka"]);

    assert.deepEqual(shares, [
      { userId: "bima", shareAmount: 33334 },
      { userId: "nala", shareAmount: 33333 },
      { userId: "raka", shareAmount: 33333 },
    ]);
  });
});

describe("calculateParticipantSummary", () => {
  it("calculates total paid, owed, receivable, and net balance", () => {
    const summary = calculateParticipantSummary("bima", [
      {
        payerId: "bima",
        amount: 120000,
        participants: [
          { userId: "bima", shareAmount: 40000 },
          { userId: "nala", shareAmount: 40000 },
          { userId: "raka", shareAmount: 40000 },
        ],
      },
      {
        payerId: "nala",
        amount: 90000,
        participants: [
          { userId: "bima", shareAmount: 45000 },
          { userId: "nala", shareAmount: 45000 },
        ],
      },
    ]);

    assert.deepEqual(summary, {
      totalPaid: 120000,
      totalOwed: 85000,
      totalReceivable: 80000,
      netBalance: -5000,
    });
  });
});

describe("formatRupiah", () => {
  it("formats integer rupiah without decimal digits", () => {
    assert.equal(formatRupiah(1250000), "Rp1.250.000");
  });
});
