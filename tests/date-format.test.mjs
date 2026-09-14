import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatDate,
  formatDeadline,
  isValidDateOnly,
} from "../src/lib/date-format.js";

describe("date formatting helpers", () => {
  it("returns readable fallbacks instead of throwing for invalid dates", () => {
    assert.equal(formatDate("not-a-date"), "Tanggal tidak tersedia");
    assert.equal(formatDate(""), "Tanggal tidak tersedia");
    assert.equal(formatDeadline(null), "Deadline tidak tersedia");
  });

  it("formats valid dates and accepts only real calendar dates for transactions", () => {
    assert.match(formatDate("2026-08-13"), /13.*Agu.*2026/);
    assert.equal(isValidDateOnly("2026-08-13"), true);
    assert.equal(isValidDateOnly("2026-02-31"), false);
    assert.equal(isValidDateOnly("2026-8-1"), false);
  });
});
