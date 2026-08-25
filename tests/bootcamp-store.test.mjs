import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createBootcampFromDraft,
  mergeBootcamps,
} from "../src/lib/bootcamp-store.js";
import { bootcamps } from "../src/lib/mock-data.js";

describe("bootcamp store helpers", () => {
  it("creates a new active bootcamp from the admin draft", () => {
    const bootcamp = createBootcampFromDraft(
      {
        name: "Data Analytics Batch 10",
        location: "Surabaya",
        startDate: "2026-10-05",
        endDate: "2026-10-11",
        paymentDeadline: "2026-10-24T23:59",
      },
      bootcamps,
    );

    assert.deepEqual(bootcamp, {
      id: "bc-data-analytics-batch-10-2026-10-05",
      name: "Data Analytics Batch 10",
      location: "Surabaya",
      startDate: "2026-10-05",
      endDate: "2026-10-11",
      paymentDeadline: "2026-10-24T23:59:00+07:00",
      status: "active",
    });
  });

  it("deduplicates stored bootcamps while keeping newly created ones", () => {
    const createdBootcamp = createBootcampFromDraft(
      {
        name: "Data Analytics Batch 10",
        location: "Surabaya",
        startDate: "2026-10-05",
        endDate: "2026-10-11",
        paymentDeadline: "2026-10-24T23:59",
      },
      bootcamps,
    );

    const mergedBootcamps = mergeBootcamps(bootcamps, [
      createdBootcamp,
      ...bootcamps,
    ]);

    assert.equal(mergedBootcamps.length, bootcamps.length + 1);
    assert.ok(
      mergedBootcamps.some((bootcamp) => bootcamp.id === createdBootcamp.id),
    );
  });
});
