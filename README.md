# ChatSpace — Telegram-style chat on the MERN stack (Dockerized)

Real-time messenger: React + Vite + Tailwind + Zustand, Node/Express (MVC),
MongoDB/Mongoose, Socket.io, JWT in HTTP-only cookies, Docker + nginx.

## Features
**Chats** — 1-on-1 and group chats · chat list with last-message preview, time,
unread badges, "typing…" and read ticks · search chats and people ·
browser-tab title shows total unread · drafts reset per chat ·
infinite-scroll history (cursor pagination) · date dividers and grouped bubbles ·
responsive (phone: list ⇄ chat with back button; desktop: list + chat + info panel).

**Messages** — reply (with jump-to-original) · edit (shows "edited") ·
delete for everyone (soft delete) · emoji reactions (1 per user, toggle) ·
image messages · emoji picker · multi-line input (Enter = send, Shift+Enter = newline) ·
✓ sent / ✓✓ read receipts.

**Groups** — admins can rename, add and remove members · anyone can leave ·
if the last admin leaves another member is promoted · admins can delete anyone's message.

**Presence** — online dot, "last seen …", group typing ("Alice, Bob are typing…"),
correct across multiple tabs/devices (a user is offline only when their last socket closes).

**Platform** — signup/login/logout, profile picture, rate-limited and validated auth,
Helmet headers, request logging, reconnect catch-up (missed messages are re-fetched).

## Run with Docker (recommended)
Needs Docker Desktop (or Docker Engine + Compose v2).

```bash
# macOS / Linux
cp .env.example .env
# Windows (cmd):   copy .env.example .env
# Windows (PowerShell): Copy-Item .env.example .env
```
Edit `.env` and set `JWT_SECRET` to any long random string, then:
```bash
docker compose up --build
```
Open **http://localhost:3000**. Open a second browser (or a private window), sign up
as another user and chat. Data persists in the `mongo-data` volume.
`docker compose down` stops it · `docker compose down -v` also wipes the database.

Image messages and profile pictures need free [Cloudinary](https://cloudinary.com)
keys in `.env`. Without them everything else works and uploads return a clear
"not configured" message.

### Docker with live reload (development)
```bash
docker compose -f docker-compose.dev.yml up
```
App on http://localhost:5173, API on :5001, MongoDB on localhost:27017 (connect with
Compass). Edit files in `backend/` or `frontend/` and the containers reload
(polling is enabled so it works on Windows bind mounts). The first start runs
`npm install` inside the containers, so give it a minute.

### Using it from Antigravity (or VS Code, Cursor, …)
Docker doesn't care which editor you use. Open this folder in the IDE, use its
integrated terminal, and run the commands above. For the dev stack, the
IDE's file edits hot-reload through the bind mounts.

## Deploy for free (Render, optionally Vercel)
- **Render only (recommended):** one free web service serves the API, WebSockets and the
  React app. `render.yaml` is included: *New → Blueprint → pick the repo → paste `MONGO_URI`.*
- **Vercel + Render:** static site on Vercel, API on Render (Vercel can't host Socket.io
  servers). `frontend/vercel.json` is included.
- Database: MongoDB Atlas free (M0).

Step-by-step instructions, free-tier caveats (Render sleeps after 15 idle minutes — the
app shows a "waking up" screen and retries) and troubleshooting are in **[DEPLOY.md](DEPLOY.md)**.

## Run without Docker
Needs Node 18+ and a MongoDB (local `mongod` or Atlas).
```bash
cd backend  && npm install && cp .env.example .env   # fill MONGO_URI + JWT_SECRET
npm run dev                                          # http://localhost:5001
cd ../frontend && npm install && npm run dev         # http://localhost:5173
```
(Windows: use `copy` instead of `cp`.) The Vite dev server proxies `/api` and
`/socket.io` to the backend, so the browser only ever talks to one origin.

## Tests
```bash
cd backend  && npm run smoke        # 35 end-to-end checks; start the server first
cd frontend && npm run test:store   # 13 unit tests for the client state logic
```
`smoke` drives a **running** server with real HTTP and real WebSocket clients:
auth, DMs, unread counts, read receipts, reply/edit/delete/react, authorization,
groups and admin rules, typing, multi-device presence, pagination. Point it at
another URL with `BASE_URL=http://localhost:3000 npm run smoke` (e.g. through nginx).

## Architecture
```
browser ──► nginx (frontend container)
             ├─ /            React build (SPA fallback)
             ├─ /api         ─► backend:5001  (Express, MVC)
             └─ /socket.io   ─► backend:5001  (WebSocket upgrade)
                                  └─► mongo:27017
```
- **One origin when possible.** nginx (Docker), the Vite proxy (dev) and Express (Render)
  put the site and API on one origin, so the `SameSite=Strict` HTTP-only cookie just works.
- **Sockets authenticate with a 2-minute token** (`GET /api/auth/socket-token`, accepted only
  by the Socket.io handshake, never as a session) so the same code also works when the
  website and API are on different domains (Vercel + Render), where cookies can't follow.
- **Rooms.** Every socket joins `user:<id>` and `channel:<id>` for each of its
  chats. Emitting to a channel room reaches every member on every device — groups,
  typing, edits, reactions and read receipts all share this one path. New members'
  sockets are joined server-side when a chat is created or someone is added.
- **REST writes, sockets fan out.** Mutations are HTTP requests; the controller
  persists, then emits. The sender gets the same message from the HTTP response
  and the socket echo, and the client reducers are idempotent (de-duped by `_id`).
- **Unread counts** come from a single aggregation over `{channelId, senderId, seenBy}`
  (indexed), and "mark chat read" is one `updateMany` instead of one request per message.
- **Authorization lives in one place** (`utils/channelAccess.js`): every channel or
  message route verifies membership, so a removed member can't touch old messages.
- **Models.** `User`, `Channel` (direct|group, `members`, `admins`, denormalized
  `lastMessage`), `Message` (`replyTo` ref, `seenBy`, `reactions`, `editedAt`, `isDeleted`).

```
backend/src   config/ models/ controllers/ routes/ middleware/ sockets/ utils/
frontend/src  components/ pages/ store/ lib/
```

## API (all under /api, cookie-authenticated except signup/login)
| Method | Path | Purpose |
|---|---|---|
| POST | /auth/signup · /auth/login · /auth/logout | session |
| GET | /auth/check | restore session |
| PUT | /auth/update-profile | profile picture |
| GET | /users | people list |
| GET | /channels | my chats + `unreadCount` |
| POST | /channels/direct · /channels/group | open DM / create group |
| PATCH | /channels/:id | rename group (admin) |
| POST | /channels/:id/members | add members (admin) |
| DELETE | /channels/:id/members/:userId | remove member (admin) / leave (self) |
| GET | /messages/:channelId?before= | history page (30) |
| POST | /messages/:channelId | send `{text, image, replyTo}` |
| PUT · DELETE | /messages/:messageId | edit · delete |
| POST | /messages/:messageId/react | toggle reaction `{emoji}` |
| PUT | /messages/channel/:channelId/read | mark chat read |

Socket events (server → client): `newMessage`, `messageEdited`, `messageDeleted`,
`messageReacted`, `messagesSeen`, `channelCreated`, `channelUpdated`, `channelRemoved`,
`userTyping`, `userStopTyping`, `getOnlineUsers`, `userOffline`.
Client → server: `typing`, `stopTyping`.

## Troubleshooting
- **`JWT_SECRET` error from compose** — you haven't created `.env` (see above).
- **Port 3000 busy** — set `WEB_PORT=8080` in `.env`; the CORS origin follows it.
- **Logged out immediately over HTTPS** — set `COOKIE_SECURE=true`.
- **Dev stack slow on first start** — it's running `npm install` in the containers.
- **Uploads fail with "not configured"** — add the three `CLOUDINARY_*` values.

## Known limits (honest list)
No end-to-end encryption or "secret chats", voice/video calls, message forwarding,
pinned messages, or service messages like "Alice added Bob". Presence and socket
rooms live in one server process; running several backend instances would need the
Socket.io Redis adapter. Deleted images stay on Cloudinary. There are no
browser-level (Playwright/Cypress) UI tests.
