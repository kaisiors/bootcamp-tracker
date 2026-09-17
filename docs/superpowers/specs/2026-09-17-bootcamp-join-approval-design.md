# Bootcamp Join Approval Design

## Goal

Allow an existing participant to request access to another active bootcamp. The
request must be approved by an admin before the participant can log in to that
bootcamp. A rejected request must remain inaccessible.

## Existing Model

`bootcamp_participants` represents an approved participant-to-bootcamp
membership. Participant `bootcampIds` are derived from this table, and all
participant dashboard and expense authorization checks use that approved
membership.

The existing participant login accepts an email and an active `bootcampId`.
When the participant is not a member of the selected bootcamp, it currently
rejects the login.

## Data Model

Add a `bootcamp_join_requests` table in the configured PostgreSQL schema:

- `id TEXT PRIMARY KEY`
- `bootcamp_id TEXT NOT NULL REFERENCES bootcamps(id) ON DELETE CASCADE`
- `participant_id TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE`
- `status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected'))`
- `requested_at TEXT NOT NULL`
- `reviewed_at TEXT`
- `reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL`
- `UNIQUE (participant_id, bootcamp_id)`

Create an index on `(status, requested_at)` for the admin approval list. The
existing membership table remains the source of truth for dashboard access;
pending and rejected requests must not be added to it.

Initial registrations continue to insert an approved membership directly, so a
new participant can enter the selected bootcamp immediately. Existing data is
unchanged and receives no synthetic requests.

## Request Lifecycle

1. The participant selects an active bootcamp and submits the existing login
   form.
2. If the participant is already in `bootcamp_participants`, authentication
   succeeds and a normal participant session is created.
3. If no membership exists, the backend looks up the unique join request:
   - No request: insert `pending`, then reject login with a message that the
     request was sent and awaits admin approval.
   - `pending`: reject login with a message that approval is still pending.
   - `rejected`: reject login with a message that access was rejected.
4. If an admin approves a pending request, insert the membership with
   `ON CONFLICT DO NOTHING`, then update the request to `approved` with review
   metadata in one transaction.
5. If an admin rejects a pending request, update it to `rejected` with review
   metadata in one transaction. No membership is created.

Approval and rejection are idempotent at the database boundary. Only pending
requests expose review actions in the UI. Approved and rejected requests remain
visible as history; they do not create another participant or account.

## Backend API

Add the following data-store operations:

- `createParticipantSession(payload)`: use a client-local authentication helper
  so the membership/request check and session creation share one database
  connection. A new request is committed before the expected 403 response.
- `reviewBootcampJoinRequest(id, status, reviewerId)`: validate the request,
  perform the approved/rejected transition transactionally, and return the
  updated state.
- `readState(client)`: return `joinRequests` with participant and bootcamp
  display names, identifiers, status, request time, and review time.

Add `reviewBootcampJoinRequest(id, status)` to the API client and expose:

`PATCH /api/bootcamp-join-requests/[id]`

The route requires an `ADMIN` session and accepts only `approved` or `rejected`.
Unauthenticated users and participant sessions receive the existing standard
error response. Public and participant bootstrap responses expose an empty
`joinRequests` collection; admin bootstrap receives the complete list.

## Frontend

Add an `Approval` item to the admin navigation. The approval view is a table
with:

- Participant name and email
- Target bootcamp
- Requested date
- Status
- Actions for pending requests

Pending rows have **Setujui** and **Tolak** actions. Each action disables the
other actions and displays the existing full-page loading overlay. On success,
the state is refreshed from the API and the admin sees a concise success
message. Approved and rejected rows show history only.

The participant login page keeps the existing form and active-bootcamp list.
Backend warning messages for newly-created, pending, and rejected requests are
shown in the existing login feedback area. A participant is redirected to the
dashboard only after the backend creates a valid session.

## Error Handling and Security

- Only active bootcamps can be requested because participant login already
  rejects non-active bootcamps.
- The participant cannot self-approve, create a membership, or review another
  participant's request.
- Admin review validates both request identity and requested status.
- Foreign keys cascade requests when a bootcamp or participant is deleted.
- A unique constraint and `ON CONFLICT` prevent duplicate requests or duplicate
  memberships during repeated login attempts or concurrent review.
- No service-role key, client-side database credentials, or static admin data is
  introduced.

## Verification

Add backend tests for:

- The new request table being migrated.
- A first login attempt creating one pending request and returning a warning.
- Repeated attempts preserving one request and keeping login blocked.
- Admin approval creating membership and enabling participant login.
- Admin rejection keeping login blocked.
- Participant and unauthenticated sessions being unable to review requests.
- Admin bootstrap including requests while participant bootstrap does not.

Add UI source tests for the Approval menu, status labels, action controls,
loading state, and participant warning copy. Run `npm test`, `npm run lint`, and
`npm run build` before completion.
