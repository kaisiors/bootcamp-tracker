import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";

const authPages = readFileSync("src/components/auth-pages.tsx", "utf8");
const trackerApp = readFileSync("src/components/bootcamp-tracker-app.tsx", "utf8");
const globalStyles = readFileSync("app/globals.css", "utf8");
const rootLayout = readFileSync("app/layout.tsx", "utf8");
const bankFieldPath = "src/components/bank-select-field.tsx";
const bankField = existsSync(bankFieldPath) ? readFileSync(bankFieldPath, "utf8") : "";

describe("responsive dashboard design", () => {
  it("keeps participant navigation compact and the content column shrinkable on mobile", () => {
    for (const requirement of [
      "lg:grid-cols-[280px_minmax(0,1fr)]",
      "grid-cols-[minmax(0,1fr)]",
      'aside className="min-w-0 rounded-lg',
      'aria-label="Navigasi peserta"',
      "overflow-x-auto",
      "lg:grid",
      "grid min-w-0 content-start gap-4",
      "[&>*]:min-w-0",
    ]) {
      assert.equal(
        trackerApp.includes(requirement),
        true,
        `${requirement} should be present in the responsive participant shell`,
      );
    }
  });

  it("gives wide tables their own horizontal scrolling region", () => {
    assert.equal(
      trackerApp.includes("overflow-hidden rounded-lg border border-border"),
      false,
      "wide tables should not be clipped by overflow-hidden wrappers",
    );

    assert.equal(
      trackerApp.match(/overflow-x-auto rounded-lg border border-border/g)?.length >= 8,
      true,
      "participant and admin tables should use local horizontal scrolling",
    );
  });

  it("keeps the admin navigation in a horizontally scrollable mobile row", () => {
    assert.equal(trackerApp.includes('aria-label="Navigasi admin"'), true);
    assert.equal(
      trackerApp.includes("xl:grid-cols-7 xl:overflow-visible"),
      true,
    );
  });
});

describe("action clarity and accessibility", () => {
  it("connects account management to the participant profile", () => {
    for (const requirement of [
      "onManageBankAccount",
      'onManageBankAccount={() => setActiveView("profile")}',
      "Kelola rekening",
    ]) {
      assert.equal(trackerApp.includes(requirement), true);
    }
  });

  it("uses a visibly neutral disabled primary action", () => {
    for (const requirement of [
      "disabled:bg-muted",
      "disabled:text-muted-foreground",
      "disabled:opacity-100",
    ]) {
      assert.equal(trackerApp.includes(requirement), true);
    }
  });

  it("gives transaction search an accessible name", () => {
    assert.equal(trackerApp.includes('aria-label="Cari transaksi"'), true);
  });

  it("offers a direct route from registration back to participant login", () => {
    assert.equal(authPages.includes("Sudah punya akun? Login peserta"), true);
  });
});

describe("shared bank selection", () => {
  it("uses one bank selector with common Indonesian banks and a custom option", () => {
    assert.equal(existsSync(bankFieldPath), true, "shared bank selector should exist");

    for (const requirement of [
      "BankSelectField",
      "Pilih bank",
      "BCA",
      "Mandiri",
      "BSI",
      "Bank lainnya",
    ]) {
      assert.equal(bankField.includes(requirement), true);
    }

    assert.equal(authPages.includes("<BankSelectField"), true);
    assert.equal(trackerApp.includes("<BankSelectField"), true);
  });
});

describe("visual hierarchy and typography", () => {
  it("removes repeated non-actionable participant status badges", () => {
    assert.equal(trackerApp.includes("Email login"), false);
    assert.equal(trackerApp.includes("Akses terbuka"), false);
  });

  it("uses the loaded Geist variables instead of an unavailable Inter font", () => {
    assert.equal(globalStyles.includes("--font-sans: var(--font-geist-sans)"), true);
    assert.equal(globalStyles.includes("--font-mono: var(--font-geist-mono)"), true);
    assert.equal(globalStyles.includes("Inter, system-ui"), false);
  });

  it("defines the Geist variables on the root element that consumes them", () => {
    assert.equal(
      rootLayout.includes(
        '<html className={`${geistSans.variable} ${geistMono.variable}`} lang="id">',
      ),
      true,
    );
    assert.equal(rootLayout.includes('<body className="antialiased">'), true);
  });
});
