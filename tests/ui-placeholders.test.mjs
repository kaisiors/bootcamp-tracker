import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const authPages = readFileSync("src/components/auth-pages.tsx", "utf8");
const trackerApp = readFileSync("src/components/bootcamp-tracker-app.tsx", "utf8");

describe("empty text fields use placeholders", () => {
  it("does not prefill auth form text fields with demo values", () => {
    for (const demoValue of [
      "bima.prasetya@mail.test",
      "peserta.baru@mail.test",
      "0812-0000-0000",
      "1234567890",
      "admin@bootcamp.test",
    ]) {
      assert.equal(
        authPages.includes(`useState("${demoValue}")`),
        false,
        `${demoValue} should be a placeholder, not an initial text field value`,
      );
    }
  });

  it("does not prefill dashboard text fields with demo values", () => {
    for (const demoValue of [
      "100000",
      "Kopi dan snack review project",
      "Data Analytics Batch 10",
      "Surabaya",
      "Peserta Baru",
      "0812-0000-0000",
      "1234567890",
    ]) {
      assert.equal(
        trackerApp.includes(`useState("${demoValue}")`),
        false,
        `${demoValue} should be a placeholder, not an initial text field value`,
      );
    }
  });
});

describe("production-safe admin password SQL", () => {
  it("does not depend on pgcrypto helper functions", () => {
    const backend = readFileSync("src/lib/backend/data-store.js", "utf8");
    const readme = readFileSync("README.md", "utf8");

    assert.equal(backend.includes("gen_salt("), false);
    assert.equal(backend.includes("crypt("), false);
    assert.equal(readme.includes("gen_salt("), false);
    assert.equal(readme.includes("crypt("), false);
  });
});
