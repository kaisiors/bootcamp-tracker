import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  bootcamps,
  expenses,
  notifications,
  participants,
} from "../src/lib/mock-data.js";

describe("dashboard data scopes", () => {
  it("limits the participant dashboard to the participant bootcamp", () => {
    const currentParticipant = participants.find((participant) => participant.id === "bima");
    const participantBootcamp = bootcamps.find((bootcamp) =>
      currentParticipant.bootcampIds.includes(bootcamp.id),
    );

    const visibleParticipants = participants.filter((participant) =>
      participant.bootcampIds.includes(participantBootcamp.id),
    );
    const visibleExpenses = expenses.filter(
      (expense) => expense.bootcampId === participantBootcamp.id,
    );
    const visibleNotifications = notifications.filter(
      (notification) => notification.bootcampId === participantBootcamp.id,
    );

    assert.equal(participantBootcamp.id, "bc-next-08");
    assert.deepEqual(
      visibleParticipants.map((participant) => participant.id),
      ["bima", "nala", "raka", "sari", "dewi"],
    );
    assert.ok(visibleExpenses.every((expense) => expense.bootcampId === "bc-next-08"));
    assert.ok(
      visibleNotifications.every(
        (notification) => notification.bootcampId === "bc-next-08",
      ),
    );
  });

  it("keeps admin dashboard data global", () => {
    const participantBootcampIds = new Set(
      participants
        .find((participant) => participant.id === "bima")
        .bootcampIds,
    );
    const participantVisibleCount = participants.filter((participant) =>
      participant.bootcampIds.some((bootcampId) =>
        participantBootcampIds.has(bootcampId),
      ),
    ).length;

    assert.equal(bootcamps.length, 3);
    assert.equal(participants.length, 8);
    assert.equal(expenses.length, 6);
    assert.ok(participants.length > participantVisibleCount);
  });
});
