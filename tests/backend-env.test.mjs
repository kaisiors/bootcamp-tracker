import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { resolveDatabaseUrl } from "../src/lib/backend/data-store.js";

const originalDatabaseUrl = process.env.DATABASE_URL;
const originalPostgresUrl = process.env.POSTGRES_URL;

afterEach(() => {
  restoreEnv("DATABASE_URL", originalDatabaseUrl);
  restoreEnv("POSTGRES_URL", originalPostgresUrl);
});

describe("backend environment resolution", () => {
  it("uses POSTGRES_URL when DATABASE_URL is not configured", () => {
    delete process.env.DATABASE_URL;
    process.env.POSTGRES_URL =
      "postgresql://postgres.test:secret@aws-0-region.pooler.supabase.com:5432/postgres?sslmode=require";

    assert.equal(resolveDatabaseUrl(), process.env.POSTGRES_URL);
  });
});

function restoreEnv(key, value) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
