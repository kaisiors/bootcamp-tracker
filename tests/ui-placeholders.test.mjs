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

describe("empty dropdown fields use placeholders", () => {
  it("does not preselect bootcamp dropdowns in auth forms", () => {
    assert.equal(
      authPages.includes("useState(activeBootcamps[0]?.id"),
      false,
      "auth bootcamp dropdowns should start empty instead of selecting the first bootcamp",
    );

    for (const placeholder of [
      "Pilih bootcamp peserta",
      "Pilih bootcamp yang diikuti",
    ]) {
      assert.equal(
        authPages.includes(placeholder),
        true,
        `${placeholder} should be rendered as a disabled dropdown placeholder`,
      );
    }
  });

  it("does not preselect admin form dropdowns", () => {
    for (const initialValue of [
      'const [newBootcampStatus, setNewBootcampStatus] = useState("");',
      'const [newParticipantBootcampId, setNewParticipantBootcampId] = useState("");',
    ]) {
      assert.equal(
        trackerApp.includes(initialValue),
        true,
        `${initialValue} should keep admin dropdowns empty until selected`,
      );
    }

    for (const placeholder of [
      "Pilih status bootcamp",
      "Pilih bootcamp peserta",
    ]) {
      assert.equal(
        trackerApp.includes(placeholder),
        true,
        `${placeholder} should be rendered as a disabled dropdown placeholder`,
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

describe("dashboard destructive and async states", () => {
  it("uses an in-app confirmation dialog before deleting admin records", () => {
    assert.equal(
      trackerApp.includes("window.confirm"),
      false,
      "delete actions should not use the browser confirmation dialog",
    );

    for (const dialogRequirement of [
      "DeleteConfirmationDialog",
      "deleteConfirmation",
      "confirmDeleteAction",
      'role="dialog"',
      'aria-modal="true"',
      "Hapus bootcamp ini?",
      "Hapus peserta ini?",
      "Hapus transaksi ini?",
      "Batal",
    ]) {
      assert.equal(
        trackerApp.includes(dialogRequirement),
        true,
        `${dialogRequirement} should be represented in the custom delete confirmation UI`,
      );
    }
  });

  it("has visible loading state for async dashboard processes", () => {
    for (const loadingState of [
      "isSavingExpense",
      "isSavingBootcamp",
      "isCreatingParticipant",
      "deletingBootcampId",
      "deletingParticipantId",
      "deletingExpenseId",
      "LoaderCircle",
      "Menyimpan...",
      "Menghapus...",
    ]) {
      assert.equal(
        trackerApp.includes(loadingState),
        true,
        `${loadingState} should be represented in the dashboard UI`,
      );
    }
  });
});

describe("admin session controls", () => {
  it("shows an admin logout button backed by the logout API", () => {
    for (const logoutRequirement of [
      "requestLogout",
      "handleAdminLogout",
      "isLoggingOut",
      "Keluar",
      "Keluar...",
      'router.push("/admin")',
      "LogOut",
    ]) {
      assert.equal(
        trackerApp.includes(logoutRequirement),
        true,
        `${logoutRequirement} should be represented in the admin logout flow`,
      );
    }
  });
});
