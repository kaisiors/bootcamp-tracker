import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";

const authPages = readFileSync("src/components/auth-pages.tsx", "utf8");
const trackerApp = readFileSync("src/components/bootcamp-tracker-app.tsx", "utf8");
const fullPageOverlayPath = "src/components/full-page-loading-overlay.tsx";
const fullPageOverlay = existsSync(fullPageOverlayPath)
  ? readFileSync(fullPageOverlayPath, "utf8")
  : "";

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

describe("admin expense editing", () => {
  it("shows controls for editing admin transactions", () => {
    for (const editRequirement of [
      "requestUpdateExpense",
      "editingExpenseId",
      "startEditExpense",
      "handleSubmitExpenseEdit",
      "resetExpenseEditForm",
      "isSavingExpenseEdit",
      "Menyimpan perubahan transaksi...",
      "Edit transaksi",
      "Batal edit transaksi",
    ]) {
      assert.equal(
        trackerApp.includes(editRequirement),
        true,
        `${editRequirement} should be represented in the admin expense edit flow`,
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

  it("shows a participant logout button in the sidebar backed by the logout API", () => {
    for (const participantLogoutRequirement of [
      "handleParticipantLogout",
      "isLoggingOutParticipant",
      "Memproses logout peserta...",
      'router.push("/")',
      "Keluar dari dashboard peserta",
    ]) {
      assert.equal(
        trackerApp.includes(participantLogoutRequirement),
        true,
        `${participantLogoutRequirement} should be represented in the participant logout flow`,
      );
    }
  });
});

describe("blocking process loading overlays", () => {
  it("defines a full-page loading overlay component", () => {
    for (const overlayRequirement of [
      "FullPageLoadingOverlay",
      "fixed inset-0",
      "aria-busy",
      'role="status"',
      "LoaderCircle",
    ]) {
      assert.equal(
        fullPageOverlay.includes(overlayRequirement),
        true,
        `${overlayRequirement} should exist in the full-page loading overlay`,
      );
    }
  });

  it("covers auth pages during login and registration processes", () => {
    for (const authRequirement of [
      "FullPageLoadingOverlay",
      "Memproses login peserta...",
      "Menyimpan pendaftaran peserta...",
      "Memproses login admin...",
      "isSubmitting",
    ]) {
      assert.equal(
        authPages.includes(authRequirement),
        true,
        `${authRequirement} should be used by auth process overlays`,
      );
    }
  });

  it("covers dashboard pages during save, edit, and logout processes", () => {
    for (const dashboardRequirement of [
      "FullPageLoadingOverlay",
      "isDashboardBlockingProcess",
      "isAdminBlockingProcess",
      "Menyimpan pengeluaran...",
      "Menyimpan perubahan bootcamp...",
      "Memproses logout admin...",
    ]) {
      assert.equal(
        trackerApp.includes(dashboardRequirement),
        true,
        `${dashboardRequirement} should be used by dashboard process overlays`,
      );
    }
  });
});

describe("initial data loading states", () => {
  it("does not show dummy dashboard data while the API state is loading", () => {
    for (const emptyState of [
      "useState<BootcampRecord[]>([])",
      "useState<ParticipantRecord[]>([])",
      "useState<ExpenseRecord[]>([])",
      "useState<NotificationRecord[]>([])",
      "DashboardDataShimmer",
      "isLoadingDashboardData",
      "isLoadingAdminData",
    ]) {
      assert.equal(
        trackerApp.includes(emptyState),
        true,
        `${emptyState} should be represented so dashboard data loads through shimmer instead of mock rows`,
      );
    }

    for (const dummyInitialState of [
      "useState(bootcamps)",
      "useState(participants)",
      "useState(expenses)",
      "useState(notifications)",
    ]) {
      assert.equal(
        trackerApp.includes(dummyInitialState),
        false,
        `${dummyInitialState} should not seed visible dashboard data before API loading finishes`,
      );
    }
  });

  it("does not show dummy bootcamp dropdown data while auth data is loading", () => {
    for (const authLoadingRequirement of [
      "useState<BootcampRecord[]>([])",
      "BootcampSelectShimmer",
      "isLoadingBootcamps",
    ]) {
      assert.equal(
        authPages.includes(authLoadingRequirement),
        true,
        `${authLoadingRequirement} should keep auth bootcamp data in shimmer state until fetched`,
      );
    }

    assert.equal(
      authPages.includes("useState(bootcamps)"),
      false,
      "auth pages should not seed bootcamp dropdowns with mock data before API loading finishes",
    );
  });
});

describe("expense participant selection", () => {
  it("does not preselect expense participants or fall back to all visible participants", () => {
    assert.equal(
      trackerApp.includes('useState(["nala", "raka", "sari", "dewi"])'),
      false,
      "expense participant checkboxes should start empty",
    );
    assert.equal(
      trackerApp.includes(": bootcampParticipants.map((participant) => participant.id)"),
      false,
      "an empty expense participant selection should stay empty instead of selecting every participant",
    );
  });

  it("clears expense date and checked participants after a saved expense", () => {
    const successIndex = trackerApp.indexOf(
      'setExpenseFormMessage("Pengeluaran tersimpan dan langsung masuk rekap.")',
    );

    assert.notEqual(successIndex, -1, "expense save success branch should exist");

    const saveSuccessBlock = trackerApp.slice(
      Math.max(0, successIndex - 500),
      successIndex + 500,
    );

    for (const resetCall of ['setExpenseDate("");', "setCheckedIds([]);"]) {
      assert.equal(
        saveSuccessBlock.includes(resetCall),
        true,
        `${resetCall} should run after the expense is saved`,
      );
    }
  });
});
