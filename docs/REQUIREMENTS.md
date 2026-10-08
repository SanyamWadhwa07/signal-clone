# Requirements traceability

How each requirement of the assignment brief is met, and where to look in the code.
Paths are relative to the repository root.

## Technical stack

| Required | Used |
|---|---|
| Frontend: Next.js (TypeScript) | Next.js 16, App Router, strict TypeScript (`frontend/`) |
| Backend: Python, FastAPI / Django | FastAPI with async SQLAlchemy (`backend/`) |
| Database: SQLite, own schema | SQLite in WAL mode, 9 tables designed for this app (see README, "Database schema") |
| Real-time: WebSockets | Native WebSockets, `backend/app/api/v1/ws.py` and `frontend/src/lib/realtime/` |

## Core features

### 1. Authentication / onboarding
| Requirement | Implementation |
|---|---|
| Register with phone number or username, mocked OTP | `POST /auth/request-otp`, `/auth/verify-otp` (fixed code `123456`): `backend/app/services/auth.py`. UI: `frontend/src/components/auth/login-flow.tsx`. Username is set in onboarding/settings and is searchable |
| Display name and profile avatar | `frontend/src/components/auth/profile-form.tsx` (name, about, photo upload), `PATCH /users/me` |
| Login / logout, session persistence | JWT per login stored in `auth_sessions`; logout revokes it. Session restored on reload by `stores/auth.ts`; 401 logs out everywhere (`lib/session.ts`); logout syncs across tabs |

### 2. Contacts and conversation list
| Requirement | Implementation |
|---|---|
| Conversations sorted by most recent activity | `ConversationRepository.memberships_for_user` orders by `last_message_at`; `sortConversations` keeps live updates in order |
| Search conversations and contacts | Instant local filter plus debounced server search (`GET /search`): `components/chat-list/` |
| Add a new contact | `components/modals/add-contact-modal.tsx`, `POST /contacts` (phone or username, optional nickname) |
| Unread indicators, last-message preview | Per-member `last_read_message_id`; preview builder `lib/preview.ts` ("You:", sender names in groups, system events) |
| Online / last-seen indicators | `services/presence.py` (online while a socket is open, 5 s grace, then `last_seen_at`); shown as the green dot and header text |

### 3. One-on-one messaging
| Requirement | Implementation |
|---|---|
| Real-time send/receive | `POST /conversations/{id}/messages` + `message.new` over the socket (`services/messages.py`) |
| Message timestamps | Bubble time (`lib/format.ts`), day dividers |
| Delivery / read receipts | `message_receipts` table; status aggregated in `ReceiptRepository.statuses`; icons in `components/ui/icons.tsx` |
| Typing indicators | `hooks/use-typing-broadcast.ts` → `typing` frame → `services/typing.py`; shown in header, list row and timeline |
| Status: sending, sent, delivered, read | `sending`/`failed` are client states (optimistic send, `stores/messages.ts`); the rest are server-computed |
| Messages persist | `messages` table; history is paginated by id |

### 4. Group messaging
| Requirement | Implementation |
|---|---|
| Create a group with name and members | `components/modals/new-group-modal.tsx`, `POST /groups` |
| Send and receive in a group | Same message pipeline; per-recipient receipts give aggregate status |
| View members | `components/chat/conversation-details.tsx`, `GET /groups/{id}/members` |
| Add / remove members (admin controls) | `services/groups.py`: only admins add, remove, promote or demote; the last admin cannot demote themselves; leaving auto-promotes a successor; non-admins get 403 |
| Group data and messages persist | `conversations`, `conversation_members`, `messages`; membership changes are stored as system messages |

### 5. Signal experience
| Requirement | Implementation |
|---|---|
| Navigation and layout (list + chat pane) | `components/layout/` nav rail, `app/(app)/chats/layout.tsx` two-pane layout |
| Message bubbles and threading | `components/chat/message-bubble.tsx` (grouping, corner shapes, inline time, quotes, reactions) |
| Forms, modals, search, filters | `components/modals/`, unread filter, in-chat search |
| Notifications / toasts | `components/ui/toasts.tsx`, tab-title unread count, optional desktop notifications |
| Settings placeholders (privacy, notifications, appearance) | `components/settings/`: Privacy (read receipts and typing toggles work), Notifications, Appearance (theme and chat color) |

## Mocked / placeholder sections
| Item | Where |
|---|---|
| Voice / video calls | Header buttons and `/calls` show "Coming soon" |
| Stories | `/stories` placeholder |
| Linked devices | `settings/linked-devices` placeholder |
| End-to-end encryption | Simulated: mock safety-number screen (`components/modals/safety-number-modal.tsx`), documented in README |

## Bonus (all implemented)
| Bonus | Implementation |
|---|---|
| Attachments (images / files) | `POST /uploads` (type, size and magic-byte checks), composer picker, paste, drag-and-drop, inline image + lightbox, file cards |
| Message reactions | `PUT/DELETE /messages/{id}/reaction`, quick bar and emoji picker, live updates |
| Reply-to / quoted messages | `reply_to_id`, quote block, click to jump to the original |
| Disappearing messages (functional) | Per-chat timer (8 presets), `expires_at`, background purge, countdown badge |
| Dark mode | Light / dark / system, no flash on load (`lib/theme.ts`) |
| Responsive design | Phone: stacked list and chat with a bottom tab bar; tablet and desktop: two panes plus details panel |
| Keyboard shortcuts | `hooks/use-shortcuts.ts`, listed in the in-app shortcuts dialog |
| Extras | Delete for everyone (sender, or group admin), in-chat search, chat color picker, optimistic send with retry, jumbo emoji |

## Important notes
| Note | How it is met |
|---|---|
| UI and UX like Signal | Layout, spacing, radii, colors and status icons were matched against Signal's published design values and official desktop and mobile reference screens |
| Sample data seeded | `backend/app/seed/`: 13 Indian-named users, 12 direct chats and 6 groups with 316 messages, replies, reactions, photos, mixed receipt states, unread badges, a disappearing chat, a Note to Self, nicknames, and illustrated profile pictures. Runs automatically when the database is empty; covered by `tests/test_seed.py` |
| Database design | Normalized schema with constraints and indexes (README, "Database schema") |
| README | Setup, stack, architecture, schema, API overview, assumptions: `README.md` |
| Original work | Written from scratch; the provided example repository (React Native + Stream) was used only as a feature checklist |

## Deliverables
| Deliverable | Status |
|---|---|
| Public GitHub repo with `frontend/` and `backend/` | Layout ready; publish step is the owner's |
| README | `README.md` |
| Hosted demo | `render.yaml` (API) and Vercel settings (frontend) documented in README, "Deployment" |
