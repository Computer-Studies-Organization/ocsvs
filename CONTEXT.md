# Domain Glossary — OCSVS (CSO Voting System)

## Concepts

### Voter Account

The combined 1-to-1 domain entity representing a registered voter within the system. It bridges authentication credentials (`accounts` table: username, password hash, email, role, and deletion status) with student academic identity (`users` table: student ID, first/last name, course, and year level).

### VoterAccountStore

The deep persistence module responsible for all database interactions and multi-table atomic transactions concerning Voter Accounts. It presents a single interface for user/account creation, updates, lookup queries, and soft/hard deletion.

### CandidateStore

The deep domain module responsible for Candidate persistence, avatar image storage, magic-byte validation, dynamic URL resolution, atomic audit logging, and lifecycle state invariants. It consolidates database queries, Backblaze B2 image operations, and URL signing behind a unified seam.
