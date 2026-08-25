import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { participants } from "../src/lib/mock-data.js";
import {
  createParticipantFromRegistration,
  mergeParticipants,
} from "../src/lib/participant-store.js";

describe("participant store helpers", () => {
  it("creates a new participant with selected bootcamp and bank account", () => {
    const participant = createParticipantFromRegistration(
      {
        name: "Peserta Baru",
        email: "peserta.baru@mail.test",
        phone: "0812-0000-0000",
        bootcampId: "bc-ui-09",
        bankName: "BCA",
        accountNumber: "1234567890",
        accountHolderName: "Peserta Baru",
      },
      participants,
    );

    assert.deepEqual(participant, {
      id: "peserta-baru",
      name: "Peserta Baru",
      email: "peserta.baru@mail.test",
      phone: "0812-0000-0000",
      bootcampIds: ["bc-ui-09"],
      bank: {
        bankName: "BCA",
        accountNumber: "1234567890",
        accountHolderName: "Peserta Baru",
      },
    });
  });

  it("keeps the stored participant snapshot for admin lists", () => {
    const participant = createParticipantFromRegistration(
      {
        name: "Peserta Baru",
        email: "peserta.baru@mail.test",
        phone: "0812-0000-0000",
        bootcampId: "bc-ui-09",
        bankName: "BCA",
        accountNumber: "1234567890",
        accountHolderName: "Peserta Baru",
      },
      participants,
    );
    const mergedParticipants = mergeParticipants(participants, [
      participant,
      ...participants,
    ]);

    assert.equal(mergedParticipants.length, participants.length + 1);
    assert.ok(
      mergedParticipants.some((item) => item.bank.accountNumber === "1234567890"),
    );
  });
});
