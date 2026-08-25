import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  resolveDatabaseClientConfig,
  resolveDatabaseUrl,
} from "../src/lib/backend/data-store.js";

const originalDatabaseUrl = process.env.DATABASE_URL;
const originalPostgresUrl = process.env.POSTGRES_URL;
const originalSupabaseSslCa = process.env.SUPABASE_SSL_CA;

afterEach(() => {
  restoreEnv("DATABASE_URL", originalDatabaseUrl);
  restoreEnv("POSTGRES_URL", originalPostgresUrl);
  restoreEnv("SUPABASE_SSL_CA", originalSupabaseSslCa);
});

describe("backend environment resolution", () => {
  it("uses POSTGRES_URL when DATABASE_URL is not configured", () => {
    delete process.env.DATABASE_URL;
    process.env.POSTGRES_URL =
      "postgresql://postgres.test:secret@aws-0-region.pooler.supabase.com:5432/postgres?sslmode=require";

    assert.equal(resolveDatabaseUrl(), process.env.POSTGRES_URL);
  });

  it("uses the configured Supabase CA certificate for verified SSL", () => {
    process.env.DATABASE_URL =
      "postgresql://postgres.test:secret@aws-0-region.pooler.supabase.com:5432/postgres?sslmode=verify-full";
    process.env.SUPABASE_SSL_CA =
      "-----BEGIN CERTIFICATE-----\\ncertificate-body\\n-----END CERTIFICATE-----";

    assert.deepEqual(resolveDatabaseClientConfig(), {
      connectionString:
        "postgresql://postgres.test:secret@aws-0-region.pooler.supabase.com:5432/postgres",
      ssl: {
        ca: "-----BEGIN CERTIFICATE-----\ncertificate-body\n-----END CERTIFICATE-----",
        rejectUnauthorized: true,
      },
    });
  });
});

function restoreEnv(key, value) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
