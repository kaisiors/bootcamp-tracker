# Bootcamp Join Approval Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow registered participants to request access to additional active bootcamps and let admins approve or reject those requests before login access is granted.

**Architecture:** Keep `bootcamp_participants` as the only source of approved membership. Store new access attempts in `bootcamp_join_requests` with one row per participant and bootcamp, and promote an approved request into the membership table in one PostgreSQL transaction. Keep the existing cookie session model and bootstrap state flow; add a protected admin review endpoint and an Approval tab in the existing admin workspace.

**Tech Stack:** Next.js 16 App Router, React client components, TypeScript/TSX, Node.js PostgreSQL client (`pg`), PostgreSQL-compatible Supabase database, Node built-in test runner, ESLint.

**Spec:** `docs/superpowers/specs/2026-09-17-bootcamp-join-approval-design.md`

## Global Constraints

- The existing membership table remains the source of truth for dashboard access; pending and rejected requests must not be added to it.
- Initial registrations continue to insert an approved membership directly, so a new participant can enter the selected bootcamp immediately.
- Only active bootcamps can be requested because participant login already rejects non-active bootcamps.
- The participant cannot self-approve, create a membership, or review another participant's request.
- No service-role key, client-side database credentials, or static admin data is introduced.
- Use PostgreSQL constraints and transactions for request uniqueness and approval state changes.
- Use the existing full-page loading overlay for approval/rejection operations.
- Run `npm test`, `npm run lint`, and `npm run build` before completion.

## Files and Responsibilities

- Modify `src/lib/backend/data-store.js`: create and read join requests, authenticate requests against membership status, review requests transactionally, and include request data in bootstrap state.
- Modify `src/lib/api-client.js`: add the client wrapper for the protected review endpoint.
- Create `app/api/bootcamp-join-requests/[id]/route.ts`: enforce admin session and validate the review payload at the HTTP boundary.
- Modify `src/components/auth-pages.tsx`: show backend pending/rejected/request-created warnings through the existing login feedback area.
- Modify `src/components/bootcamp-tracker-app.tsx`: add the admin Approval menu, request table, review actions, state synchronization, and blocking loading state.
- Modify `tests/backend-data-store.test.mjs`: cover the database lifecycle, access behavior, request uniqueness, scopes, and admin authorization.
- Modify `tests/ui-placeholders.test.mjs`: cover the Approval menu, status copy, controls, loading state, and participant warning copy.

### Task 1: Define failing backend approval tests

**Files:**
- Modify: `tests/backend-data-store.test.mjs`
- Modify: `tests/ui-placeholders.test.mjs`

**Interfaces:**
- Consumes the existing `resetAppState`, `createParticipantSession`, `getAppState`, `getAppStateForSession`, and session helpers.
- Produces failing expectations for the public function `reviewBootcampJoinRequest` and state property `joinRequests` that later implementation tasks must satisfy.

- [ ] **Step 1: Extend the data-store import and migrated table assertion.**

Add `reviewBootcampJoinRequest` to the destructured import from `data-store.js`. Add `bootcamp_join_requests` to the exact sorted table list in the PostgreSQL table test.

- [ ] **Step 2: Write the first-attempt, duplicate-attempt, and pending-login test.**

Add this test after the existing participant login validation test:

```js
it("creates one pending request when a participant tries another bootcamp", async () => {
  await assert.rejects(
    () =>
      createParticipantSession({
        bootcampId: "bc-ui-09",
        email: "bima.prasetya@mail.test",
      }),
    /menunggu approval admin|approval admin/i,
  );

  const firstState = await getAppState();
  const firstRequests = firstState.joinRequests.filter(
    (request) =>
      request.participantId === "bima" && request.bootcampId === "bc-ui-09",
  );

  assert.equal(firstRequests.length, 1);
  assert.equal(firstRequests[0].status, "pending");

  await assert.rejects(
    () =>
      createParticipantSession({
        bootcampId: "bc-ui-09",
        email: "bima.prasetya@mail.test",
      }),
    /menunggu approval admin/i,
  );

  const secondState = await getAppState();
  assert.equal(
    secondState.joinRequests.filter(
      (request) =>
        request.participantId === "bima" && request.bootcampId === "bc-ui-09",
    ).length,
    1,
  );
});
```

- [ ] **Step 3: Write the approval, rejection, and access-scope tests.**

After the pending test, add a test that finds Bima's pending request, creates an admin session, calls `reviewBootcampJoinRequest(request.id, "approved", adminSession.userId)`, asserts status `approved`, asserts Bima now has `bc-ui-09` in `bootcampIds`, and then asserts `createParticipantSession` succeeds for Bima and `bc-ui-09`.

Add a separate rejection test that calls `resetAppState()` first, creates Bima's pending request through `createParticipantSession`, reviews it as `rejected`, then asserts a later login rejects with `/ditolak admin/i` and Bima's `bootcampIds` still excludes `bc-ui-09`.

- [ ] **Step 4: Write the admin-only and bootstrap-scope tests.**

Create one pending request, assert the admin state contains it, and assert public and participant states return `joinRequests: []`. Verify the review function rejects a missing reviewer ID and rejects a second review of an already processed request.

- [ ] **Step 5: Add UI source requirements before implementation.**

Add a `describe("bootcamp join approval UI", ...)` block in `tests/ui-placeholders.test.mjs` that requires these strings in the appropriate source files:

```js
for (const requirement of [
  'id: "approvals"',
  'label: "Approval"',
  "joinRequests",
  "Menyetujui pengajuan",
  "Tolak",
  "pending",
  "approved",
  "rejected",
  "Memproses approval bootcamp...",
  "menunggu approval admin",
  "ditolak admin",
]) {
  assert.equal(
    source.includes(requirement),
    true,
    `${requirement} should be represented in the bootcamp join approval flow`,
  );
}
```

- [ ] **Step 6: Run the focused tests and confirm the expected red state.**

Run:

```bash
npm test -- tests/backend-data-store.test.mjs tests/ui-placeholders.test.mjs
```

Expected result: failure because `bootcamp_join_requests`, `reviewBootcampJoinRequest`, and the Approval UI do not exist yet. Fix only test syntax/setup problems if encountered; do not weaken the assertions.

### Task 2: Implement request storage and participant authentication

**Files:**
- Modify: `src/lib/backend/data-store.js`
- Test: `tests/backend-data-store.test.mjs`

**Interfaces:**
- Consumes the existing `bootcamp_participants` membership and session model.
- Produces `state.joinRequests` and participant login behavior for pending/rejected requests. Task 3 consumes this state and adds the admin review function.

- [ ] **Step 1: Add the join-request table and index to `migrate(client)`.**

Add this SQL after `bootcamp_participants` and before dependent request reads:

```sql
CREATE TABLE IF NOT EXISTS bootcamp_join_requests (
  id TEXT PRIMARY KEY,
  bootcamp_id TEXT NOT NULL REFERENCES bootcamps(id) ON DELETE CASCADE,
  participant_id TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_at TEXT NOT NULL,
  reviewed_at TEXT,
  reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE (participant_id, bootcamp_id)
);

CREATE INDEX IF NOT EXISTS bootcamp_join_requests_status_requested_at_idx
  ON bootcamp_join_requests (status, requested_at DESC);
```

Include the table in `dropTables(client)` so test resets remove request data.

- [ ] **Step 2: Add `joinRequests` to every session-scoped state shape.**

The unauthenticated and participant returns from `getAppStateForSession` must include `joinRequests: []`. The admin return remains the complete `readState` result.

In `readState(client)`, query request rows joined with participants and bootcamps:

```sql
SELECT r.id, r.bootcamp_id, r.participant_id, r.status,
       r.requested_at, r.reviewed_at, r.reviewed_by,
       p.name AS participant_name, p.email AS participant_email,
       b.name AS bootcamp_name
FROM bootcamp_join_requests r
JOIN participants p ON p.id = r.participant_id
JOIN bootcamps b ON b.id = r.bootcamp_id
ORDER BY CASE WHEN r.status = 'pending' THEN 0 ELSE 1 END,
         r.requested_at DESC, r.id ASC
```

Map each row to `{ bootcampId, bootcampName, id, participantEmail, participantId, participantName, requestedAt, reviewedAt, reviewedBy, status }` and add that array to the returned state.

- [ ] **Step 3: Split participant authentication into a client-local helper.**

Implement `authenticateParticipantWithClient(client, payload, options = {})`. It must query the participant by normalized email and the selected active bootcamp, then check membership with:

```sql
SELECT 1
FROM bootcamp_participants
WHERE bootcamp_id = $1 AND participant_id = $2
LIMIT 1
```

Return `{ bootcamp, participant }` for an existing membership. For a missing membership, read the unique request and apply these exact outcomes:

- No request and `options.createJoinRequest === true`: insert a deterministic request ID with status `pending`, then throw HTTP 403 with `Permintaan bergabung sudah dikirim dan menunggu approval admin.`
- Existing `pending`: throw HTTP 403 with `Permintaan bergabung masih menunggu approval admin.`
- Existing `rejected`: throw HTTP 403 with `Permintaan bergabung ditolak admin. Anda tidak dapat masuk ke bootcamp ini.`
- No request and `createJoinRequest` is false: preserve `Peserta tidak terdaftar di bootcamp ini.`

Use `INSERT ... ON CONFLICT (participant_id, bootcamp_id) DO NOTHING` and read the request again so concurrent attempts cannot create duplicates.

- [ ] **Step 4: Route both public authentication entry points through the helper.**

Keep `authenticateParticipant(payload)` as a direct validation helper with `createJoinRequest: false`. Update `createParticipantSession(payload)` to call the same helper with `createJoinRequest: true` inside its existing database client, then create the session only after authentication succeeds. Do not call the public `authenticateParticipant` from inside `createParticipantSession`.

- [ ] **Step 5: Run the backend focused tests.**

Run:

```bash
npm test -- tests/backend-data-store.test.mjs
```

Expected result: all backend join-approval tests pass, including migration, pending creation, duplicate prevention, rejection, and approval access.

### Task 3: Implement transactional admin review API

**Files:**
- Modify: `src/lib/backend/data-store.js`
- Modify: `src/lib/api-client.js`
- Create: `app/api/bootcamp-join-requests/[id]/route.ts`
- Test: `tests/backend-data-store.test.mjs`

**Interfaces:**
- Consumes `requireAdminSession(request)` and `state.joinRequests` from Task 2.
- Produces `reviewBootcampJoinRequest(id, status, reviewerId)` and `reviewBootcampJoinRequest(id, status)` API-client wrapper.

- [ ] **Step 1: Implement the data-store review function validation.**

Add `reviewBootcampJoinRequest(id, status, reviewerId)` to `data-store.js`. Validate that status is `approved` or `rejected`, load the request by ID, return 404 when it does not exist, return 409 when it is not pending, and return 401 when the reviewer ID is absent.

For an approved request, insert the requested pair into `bootcamp_participants` with `ON CONFLICT DO NOTHING`. Then update the request with its new status, `reviewed_at = new Date().toISOString()`, and `reviewed_by`, guarding the update with `WHERE id = $4 AND status = 'pending'`. Wrap the insert and update in `BEGIN`/`COMMIT`, roll back on errors, and return `{ state: await readState(client) }`.

Use this SQL shape:

```sql
INSERT INTO bootcamp_participants (bootcamp_id, participant_id)
VALUES ($1, $2)
ON CONFLICT DO NOTHING;

UPDATE bootcamp_join_requests
SET status = $1, reviewed_at = $2, reviewed_by = $3
WHERE id = $4 AND status = 'pending';
```

- [ ] **Step 2: Add the API-client method.**

Add to `src/lib/api-client.js`:

```js
export function reviewBootcampJoinRequest(id, status) {
  return requestJson(`/api/bootcamp-join-requests/${encodeURIComponent(id)}`, {
    body: JSON.stringify({ status }),
    method: "PATCH",
  });
}
```

- [ ] **Step 3: Create the protected route.**

Create `app/api/bootcamp-join-requests/[id]/route.ts`:

```ts
import {
  requireAdminSession,
  reviewBootcampJoinRequest,
  toErrorResponse,
} from "@/src/lib/backend/data-store.js";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAdminSession(request);
    const { id } = await params;
    const payload = await request.json();

    return Response.json(
      await reviewBootcampJoinRequest(id, payload.status, session.userId),
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
```

- [ ] **Step 4: Add direct authorization regression tests.**

Verify that a missing reviewer ID fails, an invalid status fails, and a second review of an already processed request fails with a conflict. Keep `requireAdminSession` as the only route entry guard; no participant route or client method may call the review endpoint.

- [ ] **Step 5: Run backend and type checks.**

Run:

```bash
npm test -- tests/backend-data-store.test.mjs
npm run lint
```

Expected result: backend tests pass and lint reports no errors or warnings.

### Task 4: Add the admin Approval workspace

**Files:**
- Modify: `src/components/bootcamp-tracker-app.tsx`
- Modify: `src/lib/api-client.js`
- Test: `tests/ui-placeholders.test.mjs`

**Interfaces:**
- Consumes `state.joinRequests`, `reviewBootcampJoinRequest(id, status)`, and the existing `FullPageLoadingOverlay`.
- Produces a visible admin Approval tab with actions for pending requests and read-only history for processed requests.

- [ ] **Step 1: Add types, navigation, state, and state synchronization.**

Add:

```tsx
type JoinRequestStatus = "pending" | "approved" | "rejected";
type JoinRequestRecord = {
  bootcampId: string;
  bootcampName: string;
  id: string;
  participantEmail: string;
  participantId: string;
  participantName: string;
  requestedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  status: JoinRequestStatus;
};
```

Extend `AdminView` with `"approvals"`, add `{ id: "approvals", label: "Approval", icon: UserCheck }`, add `joinRequests` state, and add `reviewingJoinRequestId` plus `reviewingJoinRequestStatus` state. Set `joinRequests` on initial bootstrap and on every existing admin mutation result that replaces bootcamp, participant, expense, or settlement state.

- [ ] **Step 2: Add blocking review state and handler.**

Implement `handleReviewJoinRequest(requestId, status)` so it ignores concurrent clicks, calls the API-client method, replaces all returned admin state, shows `Pengajuan peserta disetujui.` or `Pengajuan peserta ditolak.`, and clears the review state in `finally`. Include `Boolean(reviewingJoinRequestId)` in `isAdminBlockingProcess` and use `Memproses approval bootcamp...` as the overlay message while reviewing.

- [ ] **Step 3: Render the Approval table.**

Add an `activeAdminView === "approvals"` section adjacent to the existing admin sections. Render a loading-safe empty state when `joinRequests.length === 0`. For each request render participant name/email, bootcamp name, formatted `requestedAt`, status labels `Menunggu approval`, `Disetujui`, or `Ditolak`, and pending-only actions:

```tsx
{request.status === "pending" ? (
  <div className="flex flex-wrap justify-end gap-2">
    <button
      disabled={Boolean(reviewingJoinRequestId)}
      onClick={() => handleReviewJoinRequest(request.id, "approved")}
      type="button"
    >
      Setujui
    </button>
    <button
      disabled={Boolean(reviewingJoinRequestId)}
      onClick={() => handleReviewJoinRequest(request.id, "rejected")}
      type="button"
    >
      Tolak
    </button>
  </div>
) : (
  <span className="text-sm text-muted-foreground">Sudah diproses</span>
)}
```

Use the project's existing button classes/icons and format dates with `formatDeadline` so malformed dates render a safe fallback.

- [ ] **Step 4: Run the focused UI test.**

Run:

```bash
npm test -- tests/ui-placeholders.test.mjs
```

Expected result: all UI source requirements pass.

### Task 5: Complete participant warning behavior and full verification

**Files:**
- Modify: `src/components/auth-pages.tsx`
- Modify: `tests/ui-placeholders.test.mjs`
- Test: all existing test files

**Interfaces:**
- Consumes the backend 403 messages from Task 2 through the existing `requestJson` error path.
- Produces clear participant-facing warning copy without redirecting to the dashboard when no session was created.

- [ ] **Step 1: Normalize warning copy in the participant login feedback.**

Keep `loginError` driven by the caught backend error and ensure the visible message contains the backend phrases `menunggu approval admin` and `ditolak admin`. Add a small UI test requirement for the participant login page if the existing generic feedback box does not expose these strings in its source; do not create a second auth flow or store a client-side membership override.

- [ ] **Step 2: Run the complete test suite.**

Run:

```bash
npm test
```

Expected result: all backend, finance, scope, UI, and approval tests pass with zero failures.

- [ ] **Step 3: Run lint and production build.**

Run:

```bash
npm run lint
npm run build
```

Expected result: ESLint exits successfully and Next.js completes TypeScript, page generation, and route output. The known Windows SWC native-binary warning may appear; Next.js can continue with its WASM fallback, but any compilation, TypeScript, or route-generation error must be fixed before completion.

- [ ] **Step 4: Inspect the final diff and database-sensitive SQL.**

Run:

```bash
git diff --check
git status --short
git diff -- src/lib/backend/data-store.js app/api/bootcamp-join-requests/[id]/route.ts src/components/auth-pages.tsx src/components/bootcamp-tracker-app.tsx
```

Confirm that the diff contains only the approved request lifecycle, protected review endpoint, approval UI, warning behavior, tests, and the design/plan documents. Confirm no password, database URL, service-role key, or client-side authorization shortcut was introduced.

- [ ] **Step 5: Commit implementation in focused units.**

After all verification is green, use these commits:

```bash
git add tests/backend-data-store.test.mjs tests/ui-placeholders.test.mjs src/lib/backend/data-store.js
git commit -m "feat: add bootcamp join approval workflow"

git add app/api/bootcamp-join-requests/[id]/route.ts src/lib/api-client.js src/components/auth-pages.tsx src/components/bootcamp-tracker-app.tsx
git commit -m "feat: add admin bootcamp approval UI"
```

If repository Git permissions prevent a commit, report the exact Git error and leave the verified working tree intact.
