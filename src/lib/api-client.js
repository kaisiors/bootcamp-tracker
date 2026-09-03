export function getAppState() {
  return requestJson("/api/bootstrap");
}

export function loginParticipant(payload) {
  return requestJson("/api/auth/participant", {
    body: JSON.stringify(payload),
    method: "POST",
  });
}

export function loginAdmin(payload) {
  return requestJson("/api/auth/admin", {
    body: JSON.stringify(payload),
    method: "POST",
  });
}

export function logout() {
  return requestJson("/api/auth/logout", {
    method: "POST",
  });
}

export function createBootcamp(payload) {
  return requestJson("/api/bootcamps", {
    body: JSON.stringify(payload),
    method: "POST",
  });
}

export function updateBootcamp(id, payload) {
  return requestJson(`/api/bootcamps/${encodeURIComponent(id)}`, {
    body: JSON.stringify(payload),
    method: "PATCH",
  });
}

export function deleteBootcamp(id) {
  return requestJson(`/api/bootcamps/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export function createParticipant(payload) {
  return requestJson("/api/participants", {
    body: JSON.stringify(payload),
    method: "POST",
  });
}

export function deleteParticipant(id) {
  return requestJson(`/api/participants/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export function createExpense(payload) {
  return requestJson("/api/expenses", {
    body: JSON.stringify(payload),
    method: "POST",
  });
}

export function updateExpense(id, payload) {
  return requestJson(`/api/expenses/${encodeURIComponent(id)}`, {
    body: JSON.stringify(payload),
    method: "PATCH",
  });
}

export function deleteExpense(id) {
  return requestJson(`/api/expenses/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export function recordSettlementPayment(payload) {
  return requestJson("/api/settlement-payments", {
    body: JSON.stringify(payload),
    method: "POST",
  });
}

async function requestJson(path, init = {}) {
  const response = await fetch(path, {
    ...init,
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(body.message ?? "Request gagal diproses.");
  }

  return body;
}
