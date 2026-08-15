# Domain Glossary — OCSVS (CSO Voting System)

## Concepts

### Voter Account

The combined 1-to-1 domain entity representing a registered voter within the system. It bridges authentication credentials (`accounts` table: username, password hash, email, role, and deletion status) with student academic identity (`users` table: student ID, first/last name, course, and year level).

### VoterAccountStore

The deep persistence module responsible for all database interactions and multi-table atomic transactions concerning Voter Accounts. It presents a single interface for user/account creation, updates, lookup queries, and soft/hard deletion.

### Election Editability

Election configuration is editable only while the election is in `draft` status. The Election lifecycle module owns this policy through `isElectionEditable`; Position, Party, and Candidate lifecycle coordinators retain their resource-specific transactions and error handling while using that shared policy.

### Candidate Persistence

Candidate behavior intentionally remains split across a few modules with distinct ownership:

- `candidateRepo` owns candidate database queries and row projections.
- `candidateLifecycleCoordinator` owns cross-table lifecycle invariants, atomic mutations, and audit logging.
- `b2-client` and its `ImageStorage` implementations own avatar validation, storage, and candidate image URL resolution.

Route handlers compose those interfaces. Do not add a `CandidateStore` that forwards repository calls. Reconsider a deeper candidate seam only when it can absorb meaningful behavior currently split across these modules; a pass-through module has no useful depth or leverage.
