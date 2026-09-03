import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import pg from "pg";

import { createBootcampFromDraft } from "../bootcamp-store.js";
import { createExpenseFromDraft } from "../expense-store.js";
import { splitExpenseEvenly } from "../finance.js";
import { bootcamps, expenses, notifications, participants } from "../mock-data.js";
import { createParticipantFromRegistration } from "../participant-store.js";

const { Client } = pg;
const defaultDatabaseUrl = "postgresql://postgres:password@localhost:5432/bootcamp";
const sessionCookieName = "bootcamp_tracker_session";
const sessionTtlMs = 7 * 24 * 60 * 60 * 1000;

loadLocalEnv();

export async function getAppState() {
  return withDatabase((client) => readState(client));
}

export async function getAppStateForSession(session) {
  return withDatabase(async (client) => {
    const state = await readState(client);

    if (!session) {
      return {
        bootcamps: state.bootcamps.filter((bootcamp) => bootcamp.status === "active"),
        expenses: [],
        notifications: [],
        participants: [],
      };
    }

    if (session.role === "ADMIN") {
      return state;
    }

    const participant = state.participants.find(
      (item) => item.id === session.participantId,
    );
    const visibleBootcampIds = new Set(participant?.bootcampIds ?? []);

    return {
      bootcamps: state.bootcamps.filter((bootcamp) =>
        visibleBootcampIds.has(bootcamp.id),
      ),
      expenses: state.expenses.filter((expense) =>
        visibleBootcampIds.has(expense.bootcampId),
      ),
      notifications: state.notifications.filter((notification) =>
        visibleBootcampIds.has(notification.bootcampId),
      ),
      participants: state.participants.filter((item) =>
        item.bootcampIds.some((bootcampId) => visibleBootcampIds.has(bootcampId)),
      ),
    };
  });
}

export async function resetAppState() {
  return withDatabase(async (client) => {
    await dropTables(client);
    await migrate(client);
    await seedInitialData(client);

    return readState(client);
  });
}

export async function authenticateParticipant({ email, bootcampId }) {
  const data = await getAppState();
  const normalizedEmail = String(email ?? "").trim().toLowerCase();
  const participant = data.participants.find(
    (item) => item.email.toLowerCase() === normalizedEmail,
  );
  const bootcamp = data.bootcamps.find((item) => item.id === bootcampId);

  if (!participant) {
    throw createHttpError(404, "Email peserta belum terdaftar.");
  }

  if (!bootcamp || bootcamp.status !== "active") {
    throw createHttpError(404, "Bootcamp aktif tidak ditemukan.");
  }

  if (!participant.bootcampIds.includes(bootcamp.id)) {
    throw createHttpError(403, "Peserta tidak terdaftar di bootcamp ini.");
  }

  return { bootcamp, participant };
}

export async function authenticateAdmin({ email, password }) {
  return withDatabase(async (client) => {
    const admin = await authenticateAdminWithClient(client, { email, password });

    return {
      email: admin.email,
      role: admin.role,
    };
  });
}

export async function createParticipantSession(payload) {
  return withDatabase(async (client) => {
    const { bootcamp, participant } = await authenticateParticipant(payload);
    const user = await client.query(
      "SELECT id FROM users WHERE participant_id = $1 LIMIT 1",
      [participant.id],
    );

    return {
      bootcamp,
      participant,
      session: await createSession(client, {
        participantId: participant.id,
        role: "PARTICIPANT",
        userId: user.rows[0].id,
      }),
    };
  });
}

export async function createAdminSession(payload) {
  return withDatabase(async (client) => {
    const admin = await authenticateAdminWithClient(client, payload);

    return {
      admin: {
        email: admin.email,
        role: admin.role,
      },
      session: await createSession(client, {
        participantId: null,
        role: "ADMIN",
        userId: admin.id,
      }),
    };
  });
}

export async function getSessionByToken(token) {
  if (!token) {
    return null;
  }

  return withDatabase(async (client) => {
    await deleteExpiredSessions(client);

    const session = await client.query(
      `SELECT id, user_id, role, participant_id, expires_at
       FROM sessions
       WHERE token_hash = $1 AND expires_at > $2
       LIMIT 1`,
      [hashToken(token), new Date().toISOString()],
    );

    return session.rows[0]
      ? {
          expiresAt: session.rows[0].expires_at,
          id: session.rows[0].id,
          participantId: session.rows[0].participant_id,
          role: session.rows[0].role,
          userId: session.rows[0].user_id,
        }
      : null;
  });
}

export async function getSessionFromCookieHeader(cookieHeader) {
  return getSessionByToken(parseCookie(cookieHeader)[sessionCookieName]);
}

export function serializeSessionCookie(session) {
  return [
    `${sessionCookieName}=${session.token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Expires=${new Date(session.expiresAt).toUTCString()}`,
    process.env.NODE_ENV === "production" ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

export function serializeLogoutCookie() {
  return [
    `${sessionCookieName}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    process.env.NODE_ENV === "production" ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

export async function requireAdminSession(request) {
  const session = await getSessionFromCookieHeader(request.headers.get("cookie"));

  if (session?.role !== "ADMIN") {
    throw createHttpError(401, "Session admin tidak valid.");
  }

  return session;
}

export async function requireParticipantSession(request) {
  const session = await getSessionFromCookieHeader(request.headers.get("cookie"));

  if (session?.role !== "PARTICIPANT" || !session.participantId) {
    throw createHttpError(401, "Session peserta tidak valid.");
  }

  return session;
}

export async function createBootcamp(payload) {
  return withDatabase(async (client) => {
    const state = await readState(client);
    const bootcamp = createBootcampFromDraft(payload, state.bootcamps);

    await client.query(
      `INSERT INTO bootcamps
       (id, name, location, start_date, end_date, payment_deadline, status, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        bootcamp.id,
        bootcamp.name,
        bootcamp.location,
        bootcamp.startDate,
        bootcamp.endDate,
        bootcamp.paymentDeadline,
        bootcamp.status,
        await getNextSortOrder(client, "bootcamps"),
      ],
    );

    return { bootcamp, state: await readState(client) };
  });
}

export async function updateBootcamp(id, payload) {
  return withDatabase(async (client) => {
    const existing = await client.query("SELECT id FROM bootcamps WHERE id = $1", [id]);

    if (existing.rowCount === 0) {
      throw createHttpError(404, "Bootcamp tidak ditemukan.");
    }

    const bootcamp = {
      endDate: requireString(payload.endDate, "Tanggal selesai"),
      location: requireString(payload.location, "Lokasi"),
      name: requireString(payload.name, "Nama bootcamp"),
      paymentDeadline: normalizeDeadline(
        requireString(payload.paymentDeadline, "Payment deadline"),
      ),
      startDate: requireString(payload.startDate, "Tanggal mulai"),
      status: payload.status === "completed" ? "completed" : "active",
    };

    await client.query(
      `UPDATE bootcamps
       SET name = $1, location = $2, start_date = $3, end_date = $4,
           payment_deadline = $5, status = $6
       WHERE id = $7`,
      [
        bootcamp.name,
        bootcamp.location,
        bootcamp.startDate,
        bootcamp.endDate,
        bootcamp.paymentDeadline,
        bootcamp.status,
        id,
      ],
    );

    return {
      bootcamp: { id, ...bootcamp },
      state: await readState(client),
    };
  });
}

export async function deleteBootcamp(id) {
  return withDatabase(async (client) => {
    await client.query("DELETE FROM bootcamps WHERE id = $1", [id]);

    return readState(client);
  });
}

export async function createParticipant(payload) {
  return withDatabase(async (client) => {
    const state = await readState(client);

    ensureBootcampIsActive(state, payload.bootcampId);

    if (
      state.participants.some(
        (participant) =>
          participant.email.toLowerCase() ===
          String(payload.email ?? "").trim().toLowerCase(),
      )
    ) {
      throw createHttpError(409, "Email peserta sudah terdaftar.");
    }

    const participant = createParticipantFromRegistration(payload, state.participants);
    const userId = `user-${participant.id}`;

    await client.query("BEGIN");

    try {
      await client.query(
        `INSERT INTO users (id, email, name, role, participant_id)
         VALUES ($1, $2, $3, 'PARTICIPANT', $4)`,
        [userId, participant.email, participant.name, participant.id],
      );
      await client.query(
        `INSERT INTO participants (id, user_id, name, email, phone, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          participant.id,
          userId,
          participant.name,
          participant.email,
          participant.phone,
          await getNextSortOrder(client, "participants"),
        ],
      );
      await client.query(
        `INSERT INTO bank_accounts
         (participant_id, bank_name, account_number, account_holder_name)
         VALUES ($1, $2, $3, $4)`,
        [
          participant.id,
          participant.bank.bankName,
          participant.bank.accountNumber,
          participant.bank.accountHolderName,
        ],
      );
      await client.query(
        "INSERT INTO bootcamp_participants (bootcamp_id, participant_id) VALUES ($1, $2)",
        [payload.bootcampId, participant.id],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }

    return { participant, state: await readState(client) };
  });
}

export async function deleteParticipant(id) {
  return withDatabase(async (client) => {
    await client.query("DELETE FROM users WHERE participant_id = $1", [id]);

    return readState(client);
  });
}

export async function createExpense(payload, options = {}) {
  return withDatabase(async (client) => {
    const state = await readState(client);
    const bootcamp = state.bootcamps.find((item) => item.id === payload.bootcampId);
    const payer = state.participants.find((item) => item.id === payload.payerId);
    const bootcampParticipantIds = new Set(
      state.participants
        .filter((participant) => participant.bootcampIds.includes(payload.bootcampId))
        .map((participant) => participant.id),
    );

    if (!bootcamp) {
      throw createHttpError(404, "Bootcamp tidak ditemukan.");
    }

    if (!payer || !payer.bootcampIds.includes(bootcamp.id)) {
      throw createHttpError(403, "Pembayar tidak terdaftar di bootcamp ini.");
    }

    if (
      options.participantId &&
      (payload.payerId !== options.participantId ||
        !payer.bootcampIds.includes(payload.bootcampId))
    ) {
      throw createHttpError(403, "Peserta hanya bisa mencatat pengeluaran sendiri.");
    }

    if (
      !Array.isArray(payload.participantIds) ||
      payload.participantIds.some(
        (participantId) => !bootcampParticipantIds.has(participantId),
      )
    ) {
      throw createHttpError(422, "Peserta split harus berasal dari bootcamp yang sama.");
    }

    const expense = createExpenseFromDraft(payload, state.expenses);

    await client.query("BEGIN");

    try {
      await client.query(
        `INSERT INTO expenses
         (id, title, amount, bootcamp_id, expense_date, payer_id, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          expense.id,
          expense.title,
          expense.amount,
          expense.bootcampId,
          expense.expenseDate,
          expense.payerId,
          await getNextSortOrder(client, "expenses"),
        ],
      );

      for (const split of expense.participants) {
        await client.query(
          `INSERT INTO expense_splits (expense_id, participant_id, share_amount)
           VALUES ($1, $2, $3)`,
          [expense.id, split.userId, split.shareAmount],
        );
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }

    return { expense, state: await readState(client) };
  });
}

export async function updateExpense(id, payload, options = {}) {
  return withDatabase(async (client) => {
    const state = await readState(client);
    const existingExpense = state.expenses.find((item) => item.id === id);
    const nextBootcampId = options.participantId
      ? existingExpense?.bootcampId
      : payload.bootcampId;
    const nextPayerId = options.participantId
      ? options.participantId
      : payload.payerId;
    const bootcamp = state.bootcamps.find((item) => item.id === nextBootcampId);
    const payer = state.participants.find((item) => item.id === nextPayerId);
    const participantIds = Array.isArray(payload.participantIds)
      ? [...new Set(payload.participantIds)].filter(Boolean)
      : [];
    const bootcampParticipantIds = new Set(
      state.participants
        .filter((participant) => participant.bootcampIds.includes(nextBootcampId))
        .map((participant) => participant.id),
    );
    const amount = Number(payload.amount);

    if (!existingExpense) {
      throw createHttpError(404, "Transaksi tidak ditemukan.");
    }

    if (options.participantId && existingExpense.payerId !== options.participantId) {
      throw createHttpError(
        403,
        "Peserta hanya bisa mengedit transaksi yang dibuat sendiri.",
      );
    }

    if (!bootcamp) {
      throw createHttpError(404, "Bootcamp tidak ditemukan.");
    }

    if (!payer || !payer.bootcampIds.includes(bootcamp.id)) {
      throw createHttpError(403, "Pembayar tidak terdaftar di bootcamp ini.");
    }

    if (!Number.isInteger(amount) || amount <= 0) {
      throw createHttpError(422, "Nominal pengeluaran harus lebih dari 0.");
    }

    if (participantIds.length === 0) {
      throw createHttpError(422, "Pilih minimal satu peserta.");
    }

    if (
      participantIds.some((participantId) => !bootcampParticipantIds.has(participantId))
    ) {
      throw createHttpError(422, "Peserta split harus berasal dari bootcamp yang sama.");
    }

    const expense = {
      amount,
      bootcampId: bootcamp.id,
      expenseDate: requireString(payload.expenseDate, "Tanggal transaksi"),
      id,
      participants: splitExpenseEvenly(amount, participantIds),
      payerId: payer.id,
      title: requireString(payload.title, "Judul pengeluaran"),
    };

    await client.query("BEGIN");

    try {
      await client.query(
        `UPDATE expenses
         SET title = $1, amount = $2, bootcamp_id = $3, expense_date = $4,
             payer_id = $5
         WHERE id = $6`,
        [
          expense.title,
          expense.amount,
          expense.bootcampId,
          expense.expenseDate,
          expense.payerId,
          expense.id,
        ],
      );
      await client.query("DELETE FROM expense_splits WHERE expense_id = $1", [
        expense.id,
      ]);

      for (const split of expense.participants) {
        await client.query(
          `INSERT INTO expense_splits (expense_id, participant_id, share_amount)
           VALUES ($1, $2, $3)`,
          [expense.id, split.userId, split.shareAmount],
        );
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }

    return { expense, state: await readState(client) };
  });
}

export async function deleteExpense(id) {
  return withDatabase(async (client) => {
    await client.query("DELETE FROM expenses WHERE id = $1", [id]);

    return readState(client);
  });
}

export function toErrorResponse(error) {
  const status = Number.isInteger(error?.status) ? error.status : 500;
  const message =
    error instanceof Error ? error.message : "Terjadi kesalahan pada server.";

  return Response.json({ message }, { status });
}

async function withDatabase(callback) {
  const client = new Client(resolveDatabaseClientConfig());

  await client.connect();

  try {
    await prepareSchema(client);
    await migrate(client);
    await seedInitialData(client);

    return await callback(client);
  } finally {
    await client.end();
  }
}

async function authenticateAdminWithClient(client, { email, password }) {
  const normalizedEmail = String(email ?? "").trim().toLowerCase();
  const rawPassword = String(password ?? "");

  if (!normalizedEmail || !rawPassword) {
    throw createHttpError(401, "Email atau password admin tidak sesuai.");
  }

  const result = await client.query(
    `SELECT id, email, password_hash
     FROM users
     WHERE role = 'ADMIN'
       AND lower(email) = $1
     LIMIT 1`,
    [normalizedEmail],
  );
  const admin = result.rows[0];

  if (!admin || !verifyPassword(rawPassword, admin.password_hash)) {
    throw createHttpError(401, "Email atau password admin tidak sesuai.");
  }

  return {
    email: admin.email,
    id: admin.id,
    role: "admin",
  };
}

async function prepareSchema(client) {
  const schema = getSchema();

  await client.query(`CREATE SCHEMA IF NOT EXISTS ${quoteIdentifier(schema)}`);
  await client.query(`SET search_path TO ${quoteIdentifier(schema)}, public`);
}

async function migrate(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('ADMIN', 'PARTICIPANT')),
      password_hash TEXT,
      participant_id TEXT UNIQUE
    );

    CREATE TABLE IF NOT EXISTS bootcamps (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      location TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      payment_deadline TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('active', 'completed')),
      sort_order INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS participants (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      phone TEXT NOT NULL,
      sort_order INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bank_accounts (
      participant_id TEXT PRIMARY KEY REFERENCES participants(id) ON DELETE CASCADE,
      bank_name TEXT NOT NULL,
      account_number TEXT NOT NULL,
      account_holder_name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bootcamp_participants (
      bootcamp_id TEXT NOT NULL REFERENCES bootcamps(id) ON DELETE CASCADE,
      participant_id TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
      PRIMARY KEY (bootcamp_id, participant_id)
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      amount INTEGER NOT NULL,
      bootcamp_id TEXT NOT NULL REFERENCES bootcamps(id) ON DELETE CASCADE,
      expense_date TEXT NOT NULL,
      payer_id TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
      sort_order INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS expense_splits (
      expense_id TEXT NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
      participant_id TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
      share_amount INTEGER NOT NULL,
      PRIMARY KEY (expense_id, participant_id)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      bootcamp_id TEXT NOT NULL REFERENCES bootcamps(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      sent_at TEXT NOT NULL,
      is_read BOOLEAN NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      token_hash TEXT NOT NULL UNIQUE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('ADMIN', 'PARTICIPANT')),
      participant_id TEXT,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT");
  await client.query(
    `
    UPDATE users
    SET password_hash = $1
    WHERE role = 'ADMIN' AND password_hash IS NULL
  `,
    [hashPassword("password")],
  );
  await client.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'users_admin_password_hash_required'
          AND connamespace = current_schema()::regnamespace
      ) THEN
        ALTER TABLE users
        ADD CONSTRAINT users_admin_password_hash_required
        CHECK (role <> 'ADMIN' OR password_hash IS NOT NULL);
      END IF;
    END
    $$;
  `);
}

async function dropTables(client) {
  await client.query(`
    DROP TABLE IF EXISTS sessions CASCADE;
    DROP TABLE IF EXISTS expense_splits CASCADE;
    DROP TABLE IF EXISTS expenses CASCADE;
    DROP TABLE IF EXISTS notifications CASCADE;
    DROP TABLE IF EXISTS bootcamp_participants CASCADE;
    DROP TABLE IF EXISTS bank_accounts CASCADE;
    DROP TABLE IF EXISTS participants CASCADE;
    DROP TABLE IF EXISTS bootcamps CASCADE;
    DROP TABLE IF EXISTS users CASCADE;
  `);
}

async function seedInitialData(client) {
  const existing = await client.query(`
    SELECT
      (SELECT COUNT(*)::int FROM users) AS users,
      (SELECT COUNT(*)::int FROM bootcamps) AS bootcamps,
      (SELECT COUNT(*)::int FROM participants) AS participants
  `);
  const existingDataCount =
    existing.rows[0].users +
    existing.rows[0].bootcamps +
    existing.rows[0].participants;

  if (existingDataCount > 0) {
    return;
  }

  await client.query(
    `INSERT INTO users (id, email, name, role, password_hash, participant_id)
     VALUES ($1, $2, $3, 'ADMIN', $4, NULL)
     ON CONFLICT DO NOTHING`,
    ["admin", "admin@bootcamp.test", "Admin Bootcamp", hashPassword("password")],
  );

  for (const [index, bootcamp] of bootcamps.entries()) {
    await client.query(
      `INSERT INTO bootcamps
       (id, name, location, start_date, end_date, payment_deadline, status, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT DO NOTHING`,
      [
        bootcamp.id,
        bootcamp.name,
        bootcamp.location,
        bootcamp.startDate,
        bootcamp.endDate,
        bootcamp.paymentDeadline,
        bootcamp.status,
        index,
      ],
    );
  }

  for (const [index, participant] of participants.entries()) {
    const userId = `user-${participant.id}`;

    await client.query(
      `INSERT INTO users (id, email, name, role, participant_id)
       VALUES ($1, $2, $3, 'PARTICIPANT', $4)
       ON CONFLICT DO NOTHING`,
      [userId, participant.email, participant.name, participant.id],
    );
    await client.query(
      `INSERT INTO participants (id, user_id, name, email, phone, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT DO NOTHING`,
      [participant.id, userId, participant.name, participant.email, participant.phone, index],
    );
    await client.query(
      `INSERT INTO bank_accounts
       (participant_id, bank_name, account_number, account_holder_name)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT DO NOTHING`,
      [
        participant.id,
        participant.bank.bankName,
        participant.bank.accountNumber,
        participant.bank.accountHolderName,
      ],
    );

    for (const bootcampId of participant.bootcampIds) {
      await client.query(
        `INSERT INTO bootcamp_participants (bootcamp_id, participant_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [bootcampId, participant.id],
      );
    }
  }

  for (const [index, expense] of expenses.entries()) {
    await client.query(
      `INSERT INTO expenses
       (id, title, amount, bootcamp_id, expense_date, payer_id, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT DO NOTHING`,
      [
        expense.id,
        expense.title,
        expense.amount,
        expense.bootcampId,
        expense.expenseDate,
        expense.payerId,
        index,
      ],
    );

    for (const split of expense.participants) {
      await client.query(
        `INSERT INTO expense_splits (expense_id, participant_id, share_amount)
         VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING`,
        [expense.id, split.userId, split.shareAmount],
      );
    }
  }

  for (const notification of notifications) {
    await client.query(
      `INSERT INTO notifications
       (id, bootcamp_id, type, title, message, sent_at, is_read)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT DO NOTHING`,
      [
        notification.id,
        notification.bootcampId,
        notification.type,
        notification.title,
        notification.message,
        notification.sentAt,
        notification.isRead,
      ],
    );
  }
}

async function readState(client) {
  const bootcampRows = await client.query(
    `SELECT id, name, location, start_date, end_date, payment_deadline, status
     FROM bootcamps
     ORDER BY sort_order ASC, name ASC`,
  );
  const participantRows = await client.query(
    `SELECT p.id, p.name, p.email, p.phone,
            b.bank_name, b.account_number, b.account_holder_name
     FROM participants p
     JOIN bank_accounts b ON b.participant_id = p.id
     ORDER BY p.sort_order ASC, p.name ASC`,
  );
  const enrollmentRows = await client.query(
    `SELECT bootcamp_id, participant_id
     FROM bootcamp_participants
     ORDER BY bootcamp_id ASC, participant_id ASC`,
  );
  const expenseRows = await client.query(
    `SELECT id, title, amount, bootcamp_id, expense_date, payer_id
     FROM expenses
     ORDER BY sort_order ASC, expense_date DESC`,
  );
  const splitRows = await client.query(
    `SELECT expense_id, participant_id, share_amount
     FROM expense_splits
     ORDER BY expense_id ASC, participant_id ASC`,
  );
  const notificationRows = await client.query(
    `SELECT id, bootcamp_id, type, title, message, sent_at, is_read
     FROM notifications
     ORDER BY sent_at DESC`,
  );

  return {
    bootcamps: bootcampRows.rows.map((row) => ({
      endDate: row.end_date,
      id: row.id,
      location: row.location,
      name: row.name,
      paymentDeadline: row.payment_deadline,
      startDate: row.start_date,
      status: row.status,
    })),
    expenses: expenseRows.rows.map((row) => ({
      amount: row.amount,
      bootcampId: row.bootcamp_id,
      expenseDate: row.expense_date,
      id: row.id,
      participants: splitRows.rows
        .filter((split) => split.expense_id === row.id)
        .map((split) => ({
          shareAmount: split.share_amount,
          userId: split.participant_id,
        })),
      payerId: row.payer_id,
      title: row.title,
    })),
    notifications: notificationRows.rows.map((row) => ({
      bootcampId: row.bootcamp_id,
      id: row.id,
      isRead: row.is_read,
      message: row.message,
      sentAt: row.sent_at,
      title: row.title,
      type: row.type,
    })),
    participants: participantRows.rows.map((row) => ({
      bank: {
        accountHolderName: row.account_holder_name,
        accountNumber: row.account_number,
        bankName: row.bank_name,
      },
      bootcampIds: enrollmentRows.rows
        .filter((enrollment) => enrollment.participant_id === row.id)
        .map((enrollment) => enrollment.bootcamp_id),
      email: row.email,
      id: row.id,
      name: row.name,
      phone: row.phone,
    })),
  };
}

async function createSession(client, { participantId, role, userId }) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + sessionTtlMs).toISOString();

  await client.query(
    `INSERT INTO sessions
     (id, token_hash, user_id, role, participant_id, expires_at, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      randomBytes(16).toString("hex"),
      hashToken(token),
      userId,
      role,
      participantId,
      expiresAt,
      new Date().toISOString(),
    ],
  );

  return {
    expiresAt,
    participantId,
    role,
    token,
    userId,
  };
}

async function deleteExpiredSessions(client) {
  await client.query("DELETE FROM sessions WHERE expires_at <= $1", [
    new Date().toISOString(),
  ]);
}

async function getNextSortOrder(client, table) {
  const result = await client.query(
    `SELECT MIN(sort_order)::int AS sort_order FROM ${table}`,
  );

  return Number.isInteger(result.rows[0].sort_order)
    ? result.rows[0].sort_order - 1
    : 0;
}

function ensureBootcampIsActive(data, bootcampId) {
  const bootcamp = data.bootcamps.find((item) => item.id === bootcampId);

  if (!bootcamp || bootcamp.status !== "active") {
    throw createHttpError(422, "Pilih bootcamp aktif yang tersedia.");
  }
}

function requireString(value, label) {
  const normalized = String(value ?? "").trim();

  if (!normalized) {
    throw createHttpError(422, `${label} wajib diisi.`);
  }

  return normalized;
}

function normalizeDeadline(value) {
  if (value.includes("+")) {
    return value;
  }

  if (value.length === 16) {
    return `${value}:00+07:00`;
  }

  return value;
}

function createHttpError(status, message) {
  const error = new Error(message);

  error.status = status;

  return error;
}

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

export function hashPassword(password, salt = randomBytes(16).toString("base64url")) {
  const key = scryptSync(String(password), salt, 64).toString("base64url");

  return `scrypt$${salt}$${key}`;
}

function verifyPassword(password, storedHash) {
  const [, salt, key] = String(storedHash ?? "").split("$");

  if (!salt || !key) {
    return false;
  }

  const expectedKey = Buffer.from(key, "base64url");
  const actualKey = scryptSync(String(password), salt, expectedKey.length);

  return (
    actualKey.length === expectedKey.length &&
    timingSafeEqual(actualKey, expectedKey)
  );
}

function parseCookie(cookieHeader) {
  return Object.fromEntries(
    String(cookieHeader ?? "")
      .split(";")
      .map((cookie) => cookie.trim().split("="))
      .filter(([key, value]) => key && value)
      .map(([key, value]) => [key, decodeURIComponent(value)]),
  );
}

function quoteIdentifier(value) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    throw new Error("Nama schema PostgreSQL tidak valid.");
  }

  return `"${value}"`;
}

function getSchema() {
  return process.env.BOOTCAMP_TRACKER_PG_SCHEMA ?? "bootcamp_tracker";
}

export function resolveDatabaseUrl() {
  return process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? defaultDatabaseUrl;
}

export function resolveDatabaseClientConfig() {
  const connectionString = resolveDatabaseUrl();
  const ssl = resolveDatabaseSsl(connectionString);

  if (!ssl) {
    return { connectionString };
  }

  return {
    connectionString: removeSslMode(connectionString),
    ssl,
  };
}

function resolveDatabaseSsl(connectionString) {
  const url = parseDatabaseUrl(connectionString);

  if (!url) {
    return false;
  }

  const sslMode = url.searchParams.get("sslmode");
  const ca = getSupabaseSslCa();

  if (sslMode === "disable") {
    return false;
  }

  if (ca && url.hostname.endsWith(".supabase.com")) {
    return {
      ca,
      rejectUnauthorized: true,
    };
  }

  return false;
}

function getSupabaseSslCa() {
  return process.env.SUPABASE_SSL_CA?.replaceAll("\\n", "\n");
}

function removeSslMode(connectionString) {
  const url = parseDatabaseUrl(connectionString);

  if (!url) {
    return connectionString;
  }

  url.searchParams.delete("sslmode");
  return url.toString();
}

function parseDatabaseUrl(connectionString) {
  try {
    return new URL(connectionString);
  } catch {
    return null;
  }
}

function loadLocalEnv() {
  const envPath = join(process.cwd(), ".env.local");

  if (!existsSync(envPath)) {
    return;
  }

  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);

    if (
      match &&
      [
        "DATABASE_URL",
        "POSTGRES_URL",
        "SUPABASE_SSL_CA",
        "BOOTCAMP_TRACKER_PG_SCHEMA",
      ].includes(match[1]) &&
      !process.env[match[1]]
    ) {
      process.env[match[1]] = match[2].replace(/^"|"$/g, "");
    }
  }
}
