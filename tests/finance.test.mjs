import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildParticipantSettlementGroups,
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

describe("buildParticipantSettlementGroups", () => {
  const participantsById = {
    dewi: {
      bank: {
        accountHolderName: "Dewi Anggraini",
        accountNumber: "7120088930",
        bankName: "BSI",
      },
      id: "dewi",
      name: "Dewi Anggraini",
    },
    nala: {
      bank: {
        accountHolderName: "Nala Kusuma",
        accountNumber: "1320099912",
        bankName: "Mandiri",
      },
      id: "nala",
      name: "Nala Kusuma",
    },
    raka: {
      bank: {
        accountHolderName: "Raka Wibisana",
        accountNumber: "501003881994",
        bankName: "BRI",
      },
      id: "raka",
      name: "Raka Wibisana",
    },
    sari: {
      bank: {
        accountHolderName: "Sari Maharani",
        accountNumber: "0901843377",
        bankName: "BNI",
      },
      id: "sari",
      name: "Sari Maharani",
    },
  };
  const settlementRows = [
    {
      amount: 25000,
      debtorId: "bima",
      debtorName: "Bima Prasetya",
      expenseId: "exp-1",
      payerId: "nala",
      payerName: "Nala Kusuma",
      title: "Snack",
    },
    {
      amount: 30000,
      debtorId: "bima",
      debtorName: "Bima Prasetya",
      expenseId: "exp-2",
      payerId: "nala",
      payerName: "Nala Kusuma",
      title: "Transport",
    },
    {
      amount: 10000,
      debtorId: "bima",
      debtorName: "Bima Prasetya",
      expenseId: "exp-3",
      payerId: "raka",
      payerName: "Raka Wibisana",
      title: "Modul",
    },
    {
      amount: 50000,
      debtorId: "sari",
      debtorName: "Sari Maharani",
      expenseId: "exp-4",
      payerId: "bima",
      payerName: "Bima Prasetya",
      title: "Ruang diskusi",
    },
    {
      amount: 20000,
      debtorId: "dewi",
      debtorName: "Dewi Anggraini",
      expenseId: "exp-5",
      payerId: "bima",
      payerName: "Bima Prasetya",
      title: "Cetak modul",
    },
  ];
  const settlementPayments = [
    {
      debtorId: "bima",
      expenseId: "exp-1",
      paidAt: "2026-08-26T08:00:00.000Z",
      payerId: "nala",
    },
    {
      debtorId: "sari",
      expenseId: "exp-4",
      paidAt: "2026-08-26T09:00:00.000Z",
      payerId: "bima",
    },
  ];

  it("groups payable rows by recipient participant with totals and paid status", () => {
    const groups = buildParticipantSettlementGroups(
      settlementRows,
      participantsById,
      "bima",
      "payable",
      settlementPayments,
    );

    assert.deepEqual(groups, [
      {
        bank: participantsById.nala.bank,
        items: [
          {
            amount: 25000,
            debtorId: "bima",
            expenseId: "exp-1",
            paidAt: "2026-08-26T08:00:00.000Z",
            payerId: "nala",
            status: "paid",
            title: "Snack",
          },
          {
            amount: 30000,
            debtorId: "bima",
            expenseId: "exp-2",
            paidAt: null,
            payerId: "nala",
            status: "unpaid",
            title: "Transport",
          },
        ],
        paidAmount: 25000,
        participantId: "nala",
        participantName: "Nala Kusuma",
        totalAmount: 55000,
        unpaidAmount: 30000,
      },
      {
        bank: participantsById.raka.bank,
        items: [
          {
            amount: 10000,
            debtorId: "bima",
            expenseId: "exp-3",
            paidAt: null,
            payerId: "raka",
            status: "unpaid",
            title: "Modul",
          },
        ],
        paidAmount: 0,
        participantId: "raka",
        participantName: "Raka Wibisana",
        totalAmount: 10000,
        unpaidAmount: 10000,
      },
    ]);
  });

  it("groups receivable rows by debtor participant without adding actions", () => {
    const groups = buildParticipantSettlementGroups(
      settlementRows,
      participantsById,
      "bima",
      "receivable",
      settlementPayments,
    );

    assert.deepEqual(groups, [
      {
        bank: participantsById.sari.bank,
        items: [
          {
            amount: 50000,
            debtorId: "sari",
            expenseId: "exp-4",
            paidAt: "2026-08-26T09:00:00.000Z",
            payerId: "bima",
            status: "paid",
            title: "Ruang diskusi",
          },
        ],
        paidAmount: 50000,
        participantId: "sari",
        participantName: "Sari Maharani",
        totalAmount: 50000,
        unpaidAmount: 0,
      },
      {
        bank: participantsById.dewi.bank,
        items: [
          {
            amount: 20000,
            debtorId: "dewi",
            expenseId: "exp-5",
            paidAt: null,
            payerId: "bima",
            status: "unpaid",
            title: "Cetak modul",
          },
        ],
        paidAmount: 0,
        participantId: "dewi",
        participantName: "Dewi Anggraini",
        totalAmount: 20000,
        unpaidAmount: 20000,
      },
    ]);
  });
});

describe("formatRupiah", () => {
  it("formats integer rupiah without decimal digits", () => {
    assert.equal(formatRupiah(1250000), "Rp1.250.000");
  });
});
