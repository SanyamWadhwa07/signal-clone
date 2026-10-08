# Design decisions

The principles this codebase is built on, where each one shows up, and what was traded away.

## Structure and responsibility

| Principle | How it is applied |
|---|---|
| **Single responsibility** | Backend layers each do one job: routers translate HTTP, services hold rules, repositories hold queries, schemas define the wire format. Services are split by capability: `MessageService` (send, history, delete, purge), `ReceiptService` (read/delivered state), `ReactionService`, `GroupService`, `PresenceService`, `AttachmentService`, `SearchService` |
| **Open / closed** | Realtime events are named constants dispatched through one table (`realtime/events.py`, `lib/realtime/handlers.ts`); adding an event means adding a handler, not editing existing ones |
| **Liskov substitution** | Anything implementing the `Realtime` protocol can replace the WebSocket manager: the tests use a recording fake through exactly the same seam |
| **Interface segregation** | Services depend on the narrow `EventPublisher` and `PresenceTracker` protocols, never on the connection manager |
| **Dependency inversion** | `services/container.py` is the single composition root. Repositories, the publisher and storage are injected through constructors; nothing imports a concrete infrastructure class from inside business logic |
| **DRY** | One membership guard (`services/access.py`), one DTO mapper (`services/presenters.py`), one error type (`AppError`) and one error JSON shape. Frontend: pure helpers in `lib/` shared by components and tests |
| **KISS / YAGNI** | Plain SQLite, no message queue, no cache layer, no ORM migrations tool: each is a known upgrade path, not a present need |
| **Separation of concerns (frontend)** | `lib/` pure logic and API, `stores/` state, `hooks/` behaviour, `components/` rendering. Components never call `fetch`; stores never import components |

## Correctness and data

| Principle | How it is applied |
|---|---|
| **Single source of truth** | A message's status is never stored; it is the aggregate of per-recipient receipts, so it cannot drift out of sync |
| **Idempotency** | Sends carry a client id with a `UNIQUE(sender_id, client_id)` constraint: retries after a timeout can't duplicate. Contact adds and DM creation are get-or-create |
| **Constraints in the database** | Foreign keys on, `CHECK` constraints for enums and self-contacts, unique keys for one DM per pair, composite primary keys for membership/receipts/reactions |
| **Transactions and ordering** | State changes commit first, events publish after: a client never hears about something that was rolled back. Ordering and pagination use the monotonic message id, never clocks |
| **Monotonic state** | Read markers and message statuses only move forward, on both server and client, so late or duplicate events can't undo progress |
| **No N+1** | List endpoints load in a fixed number of queries (grouped aggregates for unread counts, batched receipt and attachment loads) |
| **Least information** | Non-members get 404 not 403; `request-otp` answers identically for every number; new group members never see earlier history |

## Security (defence in depth)

| Control | Where |
|---|---|
| Server-side validation of every input (Pydantic), including first names (one word, no digits) | `backend/app/schemas/` |
| Upload allow-list by extension **and** MIME **and** magic bytes; size cap; sanitised filenames; unguessable storage keys | `services/attachments.py` |
| Rate limiting: sliding window per client IP for auth, per user for sending and uploading; `429` with `Retry-After` | `core/rate_limit.py` |
| Sessions: JWT with a server-side revocable `jti`; logout revokes that one session | `services/auth.py` |
| WebSocket auth by first frame (token never in URLs/logs), 5 s auth timeout, idle timeout, membership checks on every event | `api/v1/ws.py` |
| No `innerHTML` anywhere: message text and links are rendered from tokens; only http(s) links are produced | `lib/linkify.ts` |
| Security headers on every response (`nosniff`, `X-Frame-Options`, `Referrer-Policy`, `no-store` on the API); the frontend sets its own via `next.config.ts` | `main.py`, `next.config.ts` |
| Fail fast: production refuses to start with the default JWT secret | `main.py` |
| Errors never leak internals: unexpected failures return a generic JSON 500 and log the detail | `core/errors.py` |

## Reliability and operations

| Concern | Approach |
|---|---|
| Real-time resilience | Client reconnects with exponential backoff and jitter, then re-fetches the list and gap-fills each open chat by message id. Presence has a grace period so refreshes don't flicker |
| Graceful degradation | Optimistic send with retry/discard; offline banner; cold-start tolerant login and loading states |
| Observability | Access logs, a real `/health` that checks the database, errors logged with stack traces |
| Configuration | Environment variables only (12-factor); `.env.example` files document every knob |
| Testing | API-level integration tests over a real SQLite DB, real WebSocket tests, unit tests for all pure frontend logic, seed-data integrity tests; CI runs everything plus lint, types and a production build |

## Known limits (and the upgrade path)

- **Single process.** Live connections and rate-limit counters are in memory. Scaling out means a Redis-backed `EventPublisher` and a shared limiter; both are behind interfaces.
- **SQLite** is a deliberate assignment constraint. Writes serialise, which is fine here; Postgres is a connection-string change plus migrations.
- **Mocked auth and encryption** by design (the OTP is fixed; the safety number is a stand-in).
- **Uploads on local disk.** Object storage (S3/R2) would replace `FileStorage` without touching callers.
- **Disappearing messages** start their timer on send, not on read.
- **No content security policy** header: the theme bootstrap script is inline. A nonce-based CSP is the next hardening step.
