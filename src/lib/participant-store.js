export const participantStorageKey = "bootcamp-spending-tracker:participants";
export const selectedParticipantStorageKey =
  "bootcamp-spending-tracker:selected-participant";

export function createParticipantFromRegistration(draft, existingParticipants = []) {
  const idBase = slugify(draft.email || draft.name);
  const usedIds = new Set(existingParticipants.map((participant) => participant.id));
  let id = idBase;
  let index = 2;

  while (usedIds.has(id)) {
    id = `${idBase}-${index}`;
    index += 1;
  }

  return {
    id,
    name: draft.name.trim(),
    email: draft.email.trim(),
    phone: draft.phone.trim(),
    bootcampIds: [draft.bootcampId],
    bank: {
      bankName: draft.bankName.trim(),
      accountNumber: draft.accountNumber.trim(),
      accountHolderName: draft.accountHolderName.trim(),
    },
  };
}

export function mergeParticipants(baseParticipants, storedParticipants) {
  const participantsById = new Map();
  const validStoredParticipants = storedParticipants.filter(isValidParticipant);

  if (validStoredParticipants.length > 0) {
    for (const participant of validStoredParticipants) {
      participantsById.set(participant.id, participant);
    }

    return Array.from(participantsById.values());
  }

  for (const participant of baseParticipants) {
    if (isValidParticipant(participant)) {
      participantsById.set(participant.id, participant);
    }
  }

  return Array.from(participantsById.values());
}

export function loadStoredParticipants() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const value = window.localStorage.getItem(participantStorageKey);
    const parsed = value ? JSON.parse(value) : [];

    return Array.isArray(parsed) ? parsed.filter(isValidParticipant) : [];
  } catch {
    return [];
  }
}

export function saveStoredParticipants(participants) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(participantStorageKey, JSON.stringify(participants));
}

export function loadSelectedParticipantId() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(selectedParticipantStorageKey);
}

export function saveSelectedParticipantId(participantId) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(selectedParticipantStorageKey, participantId);
}

function slugify(value) {
  const slug = value
    .toLowerCase()
    .replace(/@.*/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return slug || "peserta";
}

function isValidParticipant(value) {
  return Boolean(
    value &&
      typeof value.id === "string" &&
      typeof value.name === "string" &&
      typeof value.email === "string" &&
      typeof value.phone === "string" &&
      Array.isArray(value.bootcampIds) &&
      value.bank &&
      typeof value.bank.bankName === "string" &&
      typeof value.bank.accountNumber === "string" &&
      typeof value.bank.accountHolderName === "string",
  );
}
