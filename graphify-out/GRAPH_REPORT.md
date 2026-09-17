# Graph Report - .  (2026-09-17)

## Corpus Check
- Corpus is ~30,731 words - fits in a single context window. You may not need a graph.

## Summary
- 407 nodes · 789 edges · 23 communities (14 shown, 9 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 17 edges (avg confidence: 0.76)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Dashboard UI
- Data Store and Auth
- API Route Handlers
- Auth and Registration Pages
- Runtime Dependencies
- TypeScript Configuration
- Bootcamp Join Approval
- Project Tooling
- Component Library Config
- Client Bootcamp Store
- Client Participant Store
- Root Layout and Fonts
- Logout API
- UI Regression Tests
- Agent Instructions
- ESLint Configuration
- Next.js Configuration
- Generated Next Types
- PostCSS Configuration
- Tailwind Configuration
- Backend Data Store Tests
- Agent Rules Reference
- Bootcamp Deadline Status

## God Nodes (most connected - your core abstractions)
1. `toErrorResponse()` - 29 edges
2. `withDatabase()` - 25 edges
3. `getSessionFromCookieHeader()` - 20 edges
4. `compilerOptions` - 19 edges
5. `requestJson()` - 16 edges
6. `readState()` - 16 edges
7. `createHttpError()` - 15 edges
8. `requireAdminSession()` - 14 edges
9. `BootcampTrackerApp()` - 12 edges
10. `getAppStateForSession()` - 11 edges

## Surprising Connections (you probably didn't know these)
- `AdminDashboardPage()` --calls--> `getSessionFromCookieHeader()`  [EXTRACTED]
  app/admin/dashboard/page.tsx → src/lib/backend/data-store.js
- `POST()` --calls--> `createAdminSession()`  [EXTRACTED]
  app/api/auth/admin/route.ts → src/lib/backend/data-store.js
- `POST()` --calls--> `createParticipantSession()`  [EXTRACTED]
  app/api/auth/participant/route.ts → src/lib/backend/data-store.js
- `PATCH()` --calls--> `reviewBootcampJoinRequest()`  [EXTRACTED]
  app/api/bootcamp-join-requests/[id]/route.ts → src/lib/backend/data-store.js
- `PATCH()` --calls--> `updateBootcamp()`  [EXTRACTED]
  app/api/bootcamps/[id]/route.ts → src/lib/backend/data-store.js

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Participant Request to Approved Membership** — docs_superpowers_specs_2026_09_17_bootcamp_join_approval_requests, docs_superpowers_specs_2026_09_17_bootcamp_join_approval_request_lifecycle, docs_superpowers_specs_2026_09_17_bootcamp_join_approval_membership_model, docs_superpowers_specs_2026_09_17_bootcamp_join_approval_transactional_review [EXTRACTED 1.00]
- **Approval Backend and Admin Surface** — docs_superpowers_plans_2026_09_17_bootcamp_join_approval_admin_review_endpoint, docs_superpowers_plans_2026_09_17_bootcamp_join_approval_tab, docs_superpowers_specs_2026_09_17_bootcamp_join_approval_api, docs_superpowers_specs_2026_09_17_bootcamp_join_approval_ui [INFERRED 0.85]
- **Approval Workflow Quality Gate** — docs_superpowers_plans_2026_09_17_bootcamp_join_approval_verification_suite, docs_superpowers_specs_2026_09_17_bootcamp_join_approval_verification, docs_superpowers_specs_2026_09_17_bootcamp_join_approval_security_constraints [INFERRED 0.85]

## Communities (23 total, 9 thin omitted)

### Community 0 - "Dashboard UI"
Cohesion: 0.06
Nodes (45): AdminPaymentDetailRow, AdminView, AdminWorkspace(), BootcampRecord, BootcampTrackerApp(), createExpenseShareValuesFromSplits(), DeleteConfirmation, ExpenseRecord (+37 more)

### Community 1 - "Data Store and Auth"
Cohesion: 0.10
Nodes (50): escapedEmail, escapedHash, authenticateAdmin(), authenticateAdminWithClient(), authenticateParticipant(), authenticateParticipantWithClient(), createAdminSession(), createBootcamp() (+42 more)

### Community 2 - "API Route Handlers"
Cohesion: 0.09
Nodes (36): AdminDashboardPage(), POST(), runtime, POST(), runtime, PATCH(), runtime, DELETE() (+28 more)

### Community 3 - "Auth and Registration Pages"
Cohesion: 0.11
Nodes (24): Button(), buttonVariants, cn(), AdminLoginPage(), BootcampRecord, ParticipantLoginPage(), ParticipantRegistrationPage(), FullPageLoadingOverlay() (+16 more)

### Community 4 - "Runtime Dependencies"
Cohesion: 0.06
Nodes (35): autoprefixer, @base-ui/react, class-variance-authority, clsx, hermes-parser, language-subtag-registry, lucide-react, next (+27 more)

### Community 5 - "TypeScript Configuration"
Cohesion: 0.06
Nodes (30): dom, dom.iterable, es2022, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules, **/*.ts (+22 more)

### Community 6 - "Bootcamp Join Approval"
Cohesion: 0.11
Nodes (25): Protected Admin Review Endpoint, Bootcamp Join Approval Implementation Plan, Approved Membership Source of Truth, Participant Approval Warning, Transactional Approval State Change, Bootcamp Join Requests, Admin Approval Tab, Approval Workflow Verification (+17 more)

### Community 7 - "Project Tooling"
Cohesion: 0.09
Nodes (22): eslint, eslint-config-next, devDependencies, eslint, eslint-config-next, @types/node, @types/react, @types/react-dom (+14 more)

### Community 8 - "Component Library Config"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 9 - "Client Bootcamp Store"
Cohesion: 0.17
Nodes (14): bootcampStorageKey, createBootcampFromDraft(), isValidBootcamp(), loadSelectedBootcampId(), loadStoredBootcamps(), mergeBootcamps(), normalizeDeadline(), selectedBootcampStorageKey (+6 more)

### Community 10 - "Client Participant Store"
Cohesion: 0.24
Nodes (9): createParticipantFromRegistration(), isValidParticipant(), loadSelectedParticipantId(), loadStoredParticipants(), mergeParticipants(), participantStorageKey, saveSelectedParticipantId(), selectedParticipantStorageKey (+1 more)

### Community 11 - "Root Layout and Fonts"
Cohesion: 0.40
Nodes (3): geistMono, geistSans, metadata

### Community 12 - "Logout API"
Cohesion: 0.67
Nodes (3): POST(), runtime, serializeLogoutCookie()

### Community 13 - "UI Regression Tests"
Cohesion: 0.50
Nodes (3): authPages, dataStore, trackerApp

## Knowledge Gaps
- **124 isolated node(s):** `runtime`, `runtime`, `runtime`, `runtime`, `runtime` (+119 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `Runtime Dependencies` to `Project Tooling`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **Why does `bootcamps` connect `Client Bootcamp Store` to `Dashboard UI`, `Data Store and Auth`, `Auth and Registration Pages`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **Why does `toErrorResponse()` connect `API Route Handlers` to `Data Store and Auth`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **What connects `runtime`, `runtime`, `runtime` to the rest of the system?**
  _124 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Dashboard UI` be split into smaller, more focused modules?**
  _Cohesion score 0.057971014492753624 - nodes in this community are weakly interconnected._
- **Should `Data Store and Auth` be split into smaller, more focused modules?**
  _Cohesion score 0.09696969696969697 - nodes in this community are weakly interconnected._
- **Should `API Route Handlers` be split into smaller, more focused modules?**
  _Cohesion score 0.09183673469387756 - nodes in this community are weakly interconnected._