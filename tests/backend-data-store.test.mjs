import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { after, before, describe, it } from "node:test";

import pg from "pg";

const { Client } = pg;
const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://postgres:password@localhost:5432/bootcamp";
const testSchema = `bootcamp_tracker_test_${randomBytes(4).toString("hex")}`;

process.env.DATABASE_URL = databaseUrl;
process.env.BOOTCAMP_TRACKER_PG_SCHEMA = testSchema;

const adminClient = new Client({ connectionString: databaseUrl });

const {
  authenticateAdmin,
  authenticateParticipant,
  createAdminSession,
  createBootcamp,
  createExpense,
  createParticipant,
  createParticipantSession,
  deleteBootcamp,
  deleteParticipant,
  getAppState,
  getAppStateForSession,
  getSessionByToken,
  hashPassword,
  recordSettlementPayment,
  resetAppState,
  updateExpense,
} = await import("../src/lib/backend/data-store.js");

describe("backend data store", () => {
  before(async () => {
    await adminClient.connect();
    await adminClient.query(`CREATE SCHEMA IF NOT EXISTS ${testSchema}`);
    await resetAppState();
  });

  after(async () => {
    await adminClient.query(`DROP SCHEMA IF EXISTS ${testSchema} CASCADE`);
    await adminClient.end();
  });

  it("stores application tables and sessions in PostgreSQL", async () => {
    await createAdminSession({
      email: "admin@bootcamp.test",
      password: "password",
    });

    const tables = await adminClient.query(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = $1
       ORDER BY table_name`,
      [testSchema],
    );
    const sessionCount = await adminClient.query(
      `SELECT COUNT(*)::int AS total FROM ${testSchema}.sessions`,
    );

    assert.deepEqual(
      tables.rows.map((row) => row.table_name),
      [
        "bank_accounts",
        "bootcamp_participants",
        "bootcamps",
        "expense_splits",
        "expenses",
        "notifications",
        "participants",
        "sessions",
        "settlement_payments",
        "users",
      ],
    );
    assert.equal(sessionCount.rows[0].total, 1);
  });

  it("validates participant login by email and selected bootcamp", async () => {
    const result = await authenticateParticipant({
      bootcampId: "bc-next-08",
      email: "bima.prasetya@mail.test",
    });

    assert.equal(result.participant.id, "bima");
    assert.equal(result.bootcamp.id, "bc-next-08");
    await assert.rejects(
      () =>
        authenticateParticipant({
          bootcampId: "bc-ui-09",
          email: "bima.prasetya@mail.test",
        }),
      /tidak terdaftar di bootcamp ini/,
    );
  });

  it("validates database-backed admin credentials", async () => {
    assert.deepEqual(
      await authenticateAdmin({
        email: "admin@bootcamp.test",
        password: "password",
      }),
      {
        email: "admin@bootcamp.test",
        role: "admin",
      },
    );
    await assert.rejects(
      () =>
        authenticateAdmin({
          email: "admin@bootcamp.test",
          password: "salah",
        }),
      /tidak sesuai/,
    );

    await adminClient.query(
      `UPDATE ${testSchema}.users
       SET email = $1,
           password_hash = $2
       WHERE id = 'admin'`,
      ["owner@bootcamp.test", hashPassword("sandi-baru")],
    );

    assert.deepEqual(
      await authenticateAdmin({
        email: "owner@bootcamp.test",
        password: "sandi-baru",
      }),
      {
        email: "owner@bootcamp.test",
        role: "admin",
      },
    );
    await assert.rejects(
      () =>
        authenticateAdmin({
          email: "admin@bootcamp.test",
          password: "password",
        }),
      /tidak sesuai/,
    );

    await adminClient.query(
      `UPDATE ${testSchema}.users
       SET email = $1,
           password_hash = $2
       WHERE id = 'admin'`,
      ["admin@bootcamp.test", hashPassword("password")],
    );
  });

  it("creates real database-backed session tokens for participants and admins", async () => {
    const participantLogin = await createParticipantSession({
      bootcampId: "bc-next-08",
      email: "bima.prasetya@mail.test",
    });
    const adminLogin = await createAdminSession({
      email: "admin@bootcamp.test",
      password: "password",
    });

    assert.match(participantLogin.session.token, /^[A-Za-z0-9_-]{32,}$/);
    assert.match(adminLogin.session.token, /^[A-Za-z0-9_-]{32,}$/);
    assert.equal(
      (await getSessionByToken(participantLogin.session.token)).role,
      "PARTICIPANT",
    );
    assert.equal((await getSessionByToken(adminLogin.session.token)).role, "ADMIN");
  });

  it("scopes bootstrap data by authenticated session role", async () => {
    const publicState = await getAppStateForSession(null);
    const participantLogin = await createParticipantSession({
      bootcampId: "bc-next-08",
      email: "bima.prasetya@mail.test",
    });
    const participantSession = await getSessionByToken(participantLogin.session.token);
    const participantState = await getAppStateForSession(participantSession);
    const adminSession = await getSessionByToken(
      (
        await createAdminSession({
          email: "admin@bootcamp.test",
          password: "password",
        })
      ).session.token,
    );
    const adminState = await getAppStateForSession(adminSession);

    assert.equal(publicState.participants.length, 0);
    assert.equal(publicState.expenses.length, 0);
    assert.ok(
      participantState.participants.every((participant) =>
        participant.bootcampIds.includes("bc-next-08"),
      ),
    );
    assert.ok(
      participantState.expenses.every(
        (expense) => expense.bootcampId === "bc-next-08",
      ),
    );
    assert.equal(adminState.participants.length, (await getAppState()).participants.length);
    assert.equal(adminState.expenses.length, (await getAppState()).expenses.length);
  });

  it("creates bootcamps and participants through backend state", async () => {
    const bootcampResult = await createBootcamp({
      name: "Data Analytics Batch 10",
      location: "Surabaya",
      startDate: "2026-10-05",
      endDate: "2026-10-11",
      paymentDeadline: "2026-10-24T23:59",
      status: "active",
    });
    const participantResult = await createParticipant({
      name: "Peserta Backend",
      email: "peserta.backend@mail.test",
      phone: "0812-1111-2222",
      bootcampId: bootcampResult.bootcamp.id,
      bankName: "BCA",
      accountNumber: "1234567890",
      accountHolderName: "Peserta Backend",
    });

    assert.equal(participantResult.participant.bootcampIds[0], bootcampResult.bootcamp.id);
    assert.ok(
      (await getAppState()).participants.some(
        (participant) => participant.email === "peserta.backend@mail.test",
      ),
    );
  });

  it("creates expenses only for participants in the same bootcamp", async () => {
    const state = await getAppState();
    const bootcampId = "bc-next-08";
    const participantIds = state.participants
      .filter((participant) => participant.bootcampIds.includes(bootcampId))
      .map((participant) => participant.id)
      .slice(0, 2);
    const expenseResult = await createExpense({
      title: "Backend snack",
      amount: "120000",
      bootcampId,
      expenseDate: "2026-08-25",
      payerId: participantIds[0],
      participantIds,
    });

    assert.equal(expenseResult.expense.amount, 120000);
    assert.equal(expenseResult.expense.participants.length, 2);
    await assert.rejects(
      () =>
        createExpense({
          title: "Salah batch",
          amount: "120000",
          bootcampId,
          expenseDate: "2026-08-25",
          payerId: participantIds[0],
          participantIds: [participantIds[0], "maya"],
        }),
      /bootcamp yang sama/,
    );
  });

  it("creates expenses with editable split amounts per selected participant", async () => {
    const state = await getAppState();
    const bootcampId = "bc-next-08";
    const participantIds = state.participants
      .filter((participant) => participant.bootcampIds.includes(bootcampId))
      .map((participant) => participant.id)
      .slice(0, 3);
    const expenseResult = await createExpense({
      title: "Backend custom split",
      amount: "150000",
      bootcampId,
      expenseDate: "2026-08-25",
      payerId: participantIds[0],
      participantIds,
      participantShares: [
        { userId: participantIds[0], shareAmount: "70000" },
        { userId: participantIds[1], shareAmount: "50000" },
        { userId: participantIds[2], shareAmount: "30000" },
      ],
    });

    assert.deepEqual(expenseResult.expense.participants, [
      { userId: participantIds[0], shareAmount: 70000 },
      { userId: participantIds[1], shareAmount: 50000 },
      { userId: participantIds[2], shareAmount: 30000 },
    ]);
    assert.ok(
      expenseResult.state.expenses.some(
        (expense) =>
          expense.id === expenseResult.expense.id &&
          expense.participants.some(
            (participant) =>
              participant.userId === participantIds[1] &&
              participant.shareAmount === 50000,
          ),
      ),
    );
  });

  it("updates expense details and recalculates splits", async () => {
    const state = await getAppState();
    const bootcampId = "bc-next-08";
    const participantIds = state.participants
      .filter((participant) => participant.bootcampIds.includes(bootcampId))
      .map((participant) => participant.id)
      .slice(0, 3);
    const created = await createExpense({
      title: "Backend edit awal",
      amount: "90000",
      bootcampId,
      expenseDate: "2026-08-25",
      payerId: participantIds[0],
      participantIds: participantIds.slice(0, 2),
    });
    const updated = await updateExpense(created.expense.id, {
      title: "Backend edit final",
      amount: "150000",
      bootcampId,
      expenseDate: "2026-08-26",
      payerId: participantIds[1],
      participantIds,
    });

    assert.equal(updated.expense.id, created.expense.id);
    assert.equal(updated.expense.title, "Backend edit final");
    assert.equal(updated.expense.amount, 150000);
    assert.equal(updated.expense.expenseDate, "2026-08-26");
    assert.equal(updated.expense.payerId, participantIds[1]);
    assert.deepEqual(
      updated.expense.participants.map((participant) => participant.userId),
      participantIds,
    );
    assert.deepEqual(
      updated.expense.participants.map((participant) => participant.shareAmount),
      [50000, 50000, 50000],
    );
    assert.ok(
      updated.state.expenses.some(
        (expense) =>
          expense.id === created.expense.id &&
          expense.title === "Backend edit final" &&
          expense.participants.length === 3,
      ),
    );
  });

  it("lets participants update only expenses they created", async () => {
    const state = await getAppState();
    const bootcampId = "bc-next-08";
    const participantIds = state.participants
      .filter((participant) => participant.bootcampIds.includes(bootcampId))
      .map((participant) => participant.id)
      .slice(0, 2);
    const created = await createExpense({
      title: "Peserta edit awal",
      amount: "80000",
      bootcampId,
      expenseDate: "2026-08-25",
      payerId: participantIds[0],
      participantIds,
    });
    const updated = await updateExpense(
      created.expense.id,
      {
        title: "Peserta edit final",
        amount: "60000",
        bootcampId,
        expenseDate: "2026-08-27",
        payerId: participantIds[0],
        participantIds: [participantIds[0]],
      },
      { participantId: participantIds[0] },
    );

    assert.equal(updated.expense.title, "Peserta edit final");
    assert.equal(updated.expense.amount, 60000);
    assert.equal(updated.expense.payerId, participantIds[0]);
    assert.deepEqual(updated.expense.participants, [
      {
        shareAmount: 60000,
        userId: participantIds[0],
      },
    ]);

    await assert.rejects(
      () =>
        updateExpense(
          created.expense.id,
          {
            title: "Peserta lain edit",
            amount: "60000",
            bootcampId,
            expenseDate: "2026-08-27",
            payerId: participantIds[1],
            participantIds: [participantIds[1]],
          },
          { participantId: participantIds[1] },
        ),
      /dibuat sendiri/,
    );
  });

  it("records participant settlement payments only for their own debts", async () => {
    const result = await recordSettlementPayment(
      {
        payments: [
          {
            debtorId: "bima",
            expenseId: "exp-001",
            payerId: "nala",
          },
          {
            debtorId: "bima",
            expenseId: "exp-004",
            payerId: "sari",
          },
        ],
      },
      { participantId: "bima" },
    );

    assert.deepEqual(
      result.settlementPayments.map((payment) => ({
        debtorId: payment.debtorId,
        expenseId: payment.expenseId,
        payerId: payment.payerId,
      })),
      [
        {
          debtorId: "bima",
          expenseId: "exp-001",
          payerId: "nala",
        },
        {
          debtorId: "bima",
          expenseId: "exp-004",
          payerId: "sari",
        },
      ],
    );
    assert.ok(
      result.state.settlementPayments.some(
        (payment) =>
          payment.debtorId === "bima" &&
          payment.expenseId === "exp-001" &&
          payment.payerId === "nala",
      ),
    );
    assert.ok(
      result.state.settlementPayments.some(
        (payment) =>
          payment.debtorId === "bima" &&
          payment.expenseId === "exp-004" &&
          payment.payerId === "sari",
      ),
    );

    await assert.rejects(
      () =>
        recordSettlementPayment(
          {
            payments: [
              {
                debtorId: "bima",
                expenseId: "exp-001",
                payerId: "nala",
              },
            ],
          },
          { participantId: "dewi" },
        ),
      /tagihan peserta sendiri/,
    );
  });

  it("deletes bootcamps with related expenses and enrollment links", async () => {
    const state = await getAppState();
    const targetBootcamp = state.bootcamps.find(
      (bootcamp) => bootcamp.status === "active",
    );
    const nextState = await deleteBootcamp(targetBootcamp.id);

    assert.ok(!nextState.bootcamps.some((bootcamp) => bootcamp.id === targetBootcamp.id));
    assert.ok(!nextState.expenses.some((expense) => expense.bootcampId === targetBootcamp.id));
    assert.ok(
      nextState.participants.every(
        (participant) => !participant.bootcampIds.includes(targetBootcamp.id),
      ),
    );
  });

  it("allows participant email reuse after admin deletes the participant", async () => {
    const created = await createParticipant({
      name: "Peserta Hapus",
      email: "peserta.hapus@mail.test",
      phone: "0812-3333-4444",
      bootcampId: "bc-ui-09",
      bankName: "BCA",
      accountNumber: "99112233",
      accountHolderName: "Peserta Hapus",
    });

    await deleteParticipant(created.participant.id);

    const recreated = await createParticipant({
      name: "Peserta Hapus",
      email: "peserta.hapus@mail.test",
      phone: "0812-3333-4444",
      bootcampId: "bc-ui-09",
      bankName: "BCA",
      accountNumber: "99112233",
      accountHolderName: "Peserta Hapus",
    });

    assert.equal(recreated.participant.email, "peserta.hapus@mail.test");
  });

  it("does not reseed default users when bootcamps are empty but users still exist", async () => {
    await resetAppState();

    const state = await getAppState();
    const participantId = state.participants[0].id;

    await adminClient.query(`DELETE FROM ${testSchema}.bootcamps`);

    const nextState = await deleteParticipant(participantId);

    assert.equal(nextState.bootcamps.length, 0);
    assert.ok(
      !nextState.participants.some((participant) => participant.id === participantId),
    );
  });
});
